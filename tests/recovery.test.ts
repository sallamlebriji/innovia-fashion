import { expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep, basename } from "node:path";
import {
  databaseTarget,
  encryptionKey,
  seal,
  unseal,
} from "../scripts/recovery.mjs";
async function cleanRecoveryFixture(folder: string) {
  const absolute = resolve(folder);
  if (
    !absolute.startsWith(resolve(tmpdir()) + sep) ||
    !basename(absolute).startsWith("innovia-recovery-test-")
  )
    throw new Error("Refusing unrelated recovery fixture cleanup.");
  await rm(absolute, { recursive: true, force: true });
}
it("requires an isolated restore target and rejects malformed keys", () => {
  expect(() =>
    databaseTarget("mysql://user:secret@localhost/innovia", true),
  ).toThrow("_restore_test");
  expect(() =>
    databaseTarget("mysql://user:secret@localhost/innovia_restore_test", true),
  ).not.toThrow();
  expect(() => encryptionKey("short")).toThrow("32-byte");
});
it("authenticates encrypted backups and detects tampered ciphertext before restore", async () => {
  const folder = await mkdtemp(join(tmpdir(), "innovia-recovery-test-")),
    key = randomBytes(32),
    sealed = join(folder, "sample.enc");
  try {
    const hash = await seal(
      Readable.from(["customer data is private"]),
      sealed,
      key,
    );
    expect(
      (await readFile(sealed)).includes(Buffer.from("customer data")),
    ).toBe(false);
    await unseal(sealed, join(folder, "plain"), key, hash);
    expect(await readFile(join(folder, "plain"), "utf8")).toBe(
      "customer data is private",
    );
    const corrupt = await readFile(sealed);
    corrupt[25] ^= 1;
    await writeFile(join(folder, "corrupt"), corrupt);
    await expect(
      unseal(join(folder, "corrupt"), join(folder, "rejected"), key, hash),
    ).rejects.toThrow();
    await expect(
      unseal(sealed, join(folder, "wrong-key"), randomBytes(32), hash),
    ).rejects.toThrow();
  } finally {
    await cleanRecoveryFixture(folder);
  }
});
