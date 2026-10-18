import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 180000,
  use: {
    actionTimeout: 20000,
    baseURL: "http://localhost:5174",
    viewport: { width: 1440, height: 1080 },
    headless: true,
    launchOptions: process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {},
    screenshot: "only-on-failure",
  },
  reporter: "list",
});
