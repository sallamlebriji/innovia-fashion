import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { registerSchema } from "../packages/validation/src/index.js";
import { hashPassword } from "../apps/api/src/auth.js";
const db = new PrismaClient();
async function main() {
try {
  const input = registerSchema.parse({
    name: "INNOVIA Operator",
    businessName: "INNOVIA",
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  });
  const price = process.env.BOOTSTRAP_STARTER_PRICE ?? "299.00";
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(price))
    throw new Error("BOOTSTRAP_STARTER_PRICE must be a decimal amount.");
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (
    existing &&
    (existing.role !== "PLATFORM_ADMIN" ||
      existing.tenantId ||
      !existing.active)
  )
    throw new Error(
      "The bootstrap email is already assigned to another account.",
    );
  if (process.argv.includes("--check")) {
    console.log("Bootstrap configuration validated; no records changed.");
  } else {
    const passwordHash = await hashPassword(input.password);
    await db.$transaction(async (tx) => {
      await tx.subscriptionPlan.upsert({
        where: { name: "Starter" },
        update: {},
        create: {
          name: "Starter",
          monthlyPrice: price,
          productLimit: 100,
          storeLimit: 1,
          employeeLimit: 5,
          trialDays: 14,
          aiCredits: 0,
        },
      });
      if (!existing)
        await tx.user.create({
          data: {
            email: input.email,
            name: input.name,
            role: "PLATFORM_ADMIN",
            passwordHash,
          },
        });
    });
    console.log(
      "Operator and Starter plan ready. Existing credentials and plan prices were preserved. No demonstration tenants created.",
    );
  }
} finally {
  await db.$disconnect();
}
}
main().catch(() => {console.error("Bootstrap failed. Check account configuration and database access. No credentials were printed."); process.exitCode = 1;});
