import "dotenv/config";
// The explicit ES module extension preserves top-level async cleanup in tsx.
import { MediaStorageError } from "@innovia/media-storage";
import { db } from "../apps/api/src/db.js";
import { migratePublicMediaToS3 } from "../apps/api/src/media-migration.js";

try {
  const args = process.argv.slice(2),
    index = args.indexOf("--tenant");
  if (
    !args.includes("--maintenance-confirmed") ||
    (index !== -1 && !/^[a-z0-9]{20,40}$/.test(args[index + 1] || "")) ||
    args.length !== (index === -1 ? 1 : 3)
  )
    throw new MediaStorageError(
      "CONFIG",
      "Stop writes and workers, then run: npm run media:migrate -- --maintenance-confirmed [--tenant <tenant-id>].",
    );
  console.log(
    JSON.stringify(
      await migratePublicMediaToS3(
        process.env,
        index === -1 ? undefined : args[index + 1],
      ),
    ),
  );
} catch (error) {
  console.error(
    error instanceof MediaStorageError
      ? error.message
      : "Media migration failed. Source files were retained; check the database and storage configuration before retrying.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
