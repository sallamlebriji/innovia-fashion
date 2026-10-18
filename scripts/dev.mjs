import { spawn } from "node:child_process";
const npmPath = process.env.npm_execpath;
if (!npmPath) throw new Error("Start development with npm run dev.");
const children = [
  "@innovia/api",
  "@innovia/merchant-admin",
  "@innovia/storefront",
].map((name) =>
  spawn(process.execPath, [npmPath, "run", "dev", "-w", name], {
    stdio: "inherit",
    windowsHide: true,
  }),
);
function stop() {
  for (const child of children) {
    if (process.platform === "win32" && child.pid)
      spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    else child.kill();
  }
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children)
  child.on("exit", (code) => {
    if (code) {
      stop();
      process.exit(code);
    }
  });
