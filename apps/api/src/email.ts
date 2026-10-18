import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { mkdir, writeFile, readdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Prisma } from "@prisma/client";
import { db } from "./db.js";
import { HttpError } from "./errors.js";
type Message = { to: string; subject: string; text: string };
export function emailConfigured() {
  return (
    (process.env.APP_SIGNING_SECRET?.length ?? 0) >= 32 &&
    ((process.env.NODE_ENV !== "production" &&
      process.env.MAIL_TRANSPORT === "local") ||
      (!!process.env.RESEND_API_KEY &&
        !!process.env.MAIL_FROM &&
        process.env.MAIL_PROVIDER_APPROVED === "true"))
  );
}
function encryptionKey() {
  const secret = process.env.APP_SIGNING_SECRET;
  if (!secret || secret.length < 32)
    throw new HttpError(
      503,
      "MAIL_CONFIG",
      "Configure email delivery and a signing secret to enable recovery.",
    );
  return createHash("sha256").update(secret).digest();
}
export function encryptMessage(message: Message) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(message), "utf8"),
    cipher.final(),
  ]);
  return [nonce, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("base64"))
    .join(".");
}
export function decryptMessage(payload: string): Message {
  const [nonce, tag, ciphertext] = payload
    .split(".")
    .map((part) => Buffer.from(part, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), nonce!);
  cipher.setAuthTag(tag!);
  return JSON.parse(
    Buffer.concat([cipher.update(ciphertext!), cipher.final()]).toString(
      "utf8",
    ),
  );
}
export async function queueEmail(
  tx: Prisma.TransactionClient,
  message: Message,
  expiresAt: Date,
) {
  return tx.emailMessage.create({
    data: { payload: encryptMessage(message), expiresAt },
  });
}
export async function runEmails() {
  const directory = fileURLToPath(
    new URL("../../../.local/emails", import.meta.url),
  );
  // Only generated files inside this dedicated directory are eligible for expiry.
  for (const name of await readdir(directory).catch(() => [] as string[])) {
    if (!/^[a-z0-9-]+\.json$/.test(name)) continue;
    const path = resolve(directory, name);
    const message = await readFile(path, "utf8")
      .then((value) => JSON.parse(value))
      .catch(() => null);
    if (!message) continue;
    if (message.expiresAt && new Date(message.expiresAt) <= new Date())
      await rm(path);
  }
  await db.emailMessage.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  if (!emailConfigured()) return;
  const messages = await db.emailMessage.findMany({
    where: {
      expiresAt: { gt: new Date() },
      attempts: { lt: 5 },
      OR: [
        { status: "QUEUED" },
        { status: "SENDING", leaseUntil: { lt: new Date() } },
      ],
    },
    take: 10,
    orderBy: { createdAt: "asc" },
  });
  for (const message of messages) {
    const claimed = await db.emailMessage.updateMany({
      where: {
        id: message.id,
        status: message.status,
        leaseUntil: message.leaseUntil,
      },
      data: {
        status: "SENDING",
        attempts: { increment: 1 },
        leaseUntil: new Date(Date.now() + 60000),
      },
    });
    if (!claimed.count) continue;
    try {
      const data = decryptMessage(message.payload);
      let providerId = "local";
      if (
        process.env.MAIL_TRANSPORT === "local" &&
        process.env.NODE_ENV !== "production"
      ) {
        await mkdir(directory, { recursive: true });
        await writeFile(
          resolve(directory, `${message.id}.json`),
          JSON.stringify({ ...data, expiresAt: message.expiresAt }, null, 2),
          { mode: 0o600 },
        );
      } else {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `innovia-email-${message.id}`,
          },
          body: JSON.stringify({ ...data, from: process.env.MAIL_FROM }),
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw new Error("MAIL_DELIVERY");
        providerId = ((await response.json()) as { id: string }).id;
      }
      await db.emailMessage.update({
        where: { id: message.id },
        data: { status: "SENT", providerId, leaseUntil: null, payload: "" },
      });
    } catch {
      // The provider's idempotency key makes an uncertain retry safe within this one-hour window.
      await db.emailMessage.update({
        where: { id: message.id },
        data: {
          status: message.attempts >= 4 ? "FAILED" : "SENDING",
          leaseUntil: new Date(
            Date.now() + Math.min(600000, 60000 * 2 ** message.attempts),
          ),
        },
      });
    }
  }
}
