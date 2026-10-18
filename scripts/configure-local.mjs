import { readFile, appendFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
if (process.env.NODE_ENV === "production") throw new Error("Local setup is not for production.");
const content = await readFile(".env", "utf8");
if (!/^APP_SIGNING_SECRET=/m.test(content)) await appendFile(".env", `\nAPP_SIGNING_SECRET=${randomBytes(32).toString("hex")}\n`);
if (!/^MAIL_TRANSPORT=/m.test(content)) await appendFile(".env", "\nMAIL_TRANSPORT=local\n");
console.log("Local preview signing configured; no secrets printed.");
