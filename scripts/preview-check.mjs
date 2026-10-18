import dotenv from "dotenv";
import { chromium, expect } from "@playwright/test";
dotenv.config({ quiet: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5174");
  await page
    .getByLabel("Email address")
    .fill("atelier-noir@demo.innovia.local");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_PASSWORD);
  await page.getByRole("button", { name: "Enter your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Good to see you, Amira." }),
  ).toBeVisible();
  await expect(page.locator("main.main-content")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator(".insight-card").first()).toHaveCSS(
    "background-color",
    "rgb(51, 49, 39)",
  );
  await page.screenshot({
    path: ".local/admin-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await expect(page.locator(".recovery-panel")).toBeVisible();
  await page.screenshot({ path: ".local/recovery.png", fullPage: true });
  await page.getByRole("button", { name: "Close recovery" }).click();
  await page
    .getByLabel("Email address")
    .fill(process.env.BOOTSTRAP_ADMIN_EMAIL);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.BOOTSTRAP_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Enter your workspace" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.goto("http://localhost:5174/platform/control");
  await expect(
    page.getByRole("heading", { name: "A considered platform." }),
  ).toBeVisible();
  await page.screenshot({
    path: ".local/platform-control.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Stores", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Audit", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.locator(".sidebar").evaluate((e) => e.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  await page.screenshot({
    path: ".local/admin-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  console.log(
    "Preview verified: readable dark insight card and settled mobile navigation.",
  );
} finally {
  await browser.close();
}
