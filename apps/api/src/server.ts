import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { validateRuntime } from "./runtime-config.js";
import { closeMediaStorage } from "@innovia/media-storage";
dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});
validateRuntime(process.env);
const { createApp, logger } = await import("./app.js");
const { db } = await import("./db.js");
const { runMaintenance } = await import("./maintenance.js");
const { checkInfrastructure, startMaintenance, closeInfrastructure } =
  await import("./infrastructure.js");
await checkInfrastructure();
const stopMaintenance = await startMaintenance(
  async () => {
    const result = await runMaintenance();
    if (result.mediaCleanup.failed)
      logger.warn(
        { mediaCleanup: result.mediaCleanup },
        "Media cleanup is pending; provider deletion failed.",
      );
    return result;
  },
  () =>
    logger.error(
      "Maintenance infrastructure or job failed; inspect persisted job state.",
    ),
);
if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL is required. Copy .env.example and configure MySQL.",
  );
const port = Number(process.env.PORT ?? 4001);
const server = createApp().listen(
  port,
  process.env.HOST ??
    (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
  () => logger.info({ port }, "INNOVIA API ready"),
);
async function stop() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => {
    server.closeAllConnections();
    logger.warn(
      "Shutdown deadline reached; unfinished jobs recover from persisted leases.",
    );
    process.exit(1);
  }, 60000);
  deadline.unref();
  await Promise.all([
    new Promise<void>((resolve) => server.close(() => resolve())),
    stopMaintenance(),
  ]);
  await closeInfrastructure();
  closeMediaStorage();
  await db.$disconnect();
  clearTimeout(deadline);
  process.exit(0);
}
let stopping = false;
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
