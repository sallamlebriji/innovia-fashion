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
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.goto("http://localhost:5174/reports");
  await expect(
    page.getByRole("heading", { name: "Understand your next chapter." }),
  ).toBeVisible();
  const language = page.locator(".topbar-actions select");
  await language.selectOption("fr");
  await expect(
    page.getByRole("heading", { name: "Éclairez votre prochain chapitre." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Rapports d’activité" }),
  ).toBeVisible();
  await expect(page.getByText("Ventes nettes", { exact: true })).toBeVisible();
  await language.selectOption("ar");
  await expect(
    page.getByRole("heading", { name: "افهم خطواتك القادمة." }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.screenshot({ path: ".local/reports-ar.png", fullPage: true });
  await page.goto("http://localhost:5174/settings");
  await expect(
    page.getByRole("heading", { name: "التجديد الشهري" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "بدء الاشتراك الشهري" }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sidebar")).toBeHidden();
  await page.locator(".mobile-menu").click();
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".mobile-menu")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.locator(".mobile-close").click();
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".mobile-menu")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/renewal-mobile-ar.png",
    fullPage: true,
  });
  await page.goto("http://localhost:5174/media");
  await expect(
    page.getByRole("heading", { name: "صور تروي قصتك." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "رفع صورة" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: ".local/media-mobile-ar.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await language.selectOption("fr");
  await expect(
    page.getByRole("heading", {
      name: "Des images qui racontent votre histoire.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Importer une image" }),
  ).toBeVisible();
  await language.selectOption("en");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Language", { exact: true }).selectOption("fr");
  await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
  await page.getByRole("button", { name: "Mot de passe oublié ?" }).click();
  await expect(
    page.getByRole("heading", { name: "Récupérer votre compte" }),
  ).toBeVisible();
  await page.getByLabel("Langue").selectOption("ar");
  await expect(
    page.getByRole("heading", { name: "استعادة حسابك" }),
  ).toBeVisible();
  await page.screenshot({ path: ".local/recovery-ar.png", fullPage: true });
  expect(errors).toEqual([]);
  console.log(
    "French/Arabic browser checks passed: navigation, reports, billing, media library, recovery and mobile RTL layout.",
  );
} finally {
  await browser.close();
}
