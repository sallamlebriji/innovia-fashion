import { test, expect } from "@playwright/test";
import { cleanupBrowserTenant } from "./helpers/tenant";
import dotenv from "dotenv";
import sharp from "sharp";
dotenv.config({ quiet: true });
const suffix = Date.now().toString();
const business = `E2E Boutique ${suffix}`;
const email = `browser-${suffix}@example.test`;
const password = "Browser-test-password-123";
let tenantId = "";
let slug = "";
test.afterAll(() => cleanupBrowserTenant(tenantId, business));
test("connected retail, promotions, registers, CMS, customer accounts, campaigns and responsive layouts", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "New to INNOVIA? Create a workspace" })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Browser Owner");
  await page.getByLabel("Business name").fill(business);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Good to see you, Browser." }),
  ).toBeVisible();
  const session = await (await page.request.get("/api/v1/auth/me")).json();
  tenantId = session.tenant.id;
  slug = session.tenant.slug;
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByLabel("Product name").fill("Browser linen shirt");
  await page.getByLabel("Category", { exact: true }).fill("Shirts");
  await page.getByLabel("SKU", { exact: true }).fill(`BROWSER-${suffix}`);
  await page.getByLabel("Price (MAD)", { exact: true }).fill("450.50");
  await page.getByLabel("Cost", { exact: true }).fill("100.00");
  await page.getByLabel("Stock", { exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Create product", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Browser linen shirt/ }).first(),
  ).toBeVisible();
  const createdProduct = (
    await (await page.request.get("/api/v1/products")).json()
  ).items[0];
  await page.getByRole("link", { name: "Media library", exact: true }).click();
  const image = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#ddd2be" },
  })
    .png()
    .toBuffer();
  await page.locator('input[type="file"]').setInputFiles({
    name: "licensed-test-image.png",
    mimeType: "image/png",
    buffer: image,
  });
  await expect(page.getByRole("status")).toContainText("Image uploaded.");
  const uploadedImage = page.getByRole("img", {
    name: "Uploaded boutique asset",
  });
  await expect(uploadedImage).toBeVisible();
  await expect
    .poll(() =>
      uploadedImage.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  const imageUrl = await page
    .getByLabel("Image URL", { exact: true })
    .inputValue();
  expect(
    (await page.request.get(imageUrl)).headers()["content-type"],
  ).toContain("image/webp");
  await page.screenshot({ path: ".local/media-library.png", fullPage: true });
  const edited = await page.request.patch(
    `/api/v1/products/${createdProduct.id}`,
    {
      headers: { "X-CSRF-Token": session.csrfToken },
      data: {
        imageUrl,
        brand: "Browser Brand",
        sizeChart: [{ size: "M", chest: 100, waist: 80 }],
      },
    },
  );
  expect(edited.ok()).toBe(true);
  await page
    .getByRole("button", { name: "Delete unused", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Remove this image from products",
  );
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await page.getByRole("button", { name: "Adjust stock", exact: true }).click();
  await page.getByLabel("Product variant").selectOption({
    label: `Browser linen shirt · Black / M · BROWSER-${suffix}`,
  });
  await page.getByLabel("Quantity adjustment").fill("2");
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Browser verified stock receiving");
  await page.getByRole("button", { name: "Save adjustment" }).click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: `BROWSER-${suffix}` })
      .getByRole("cell")
      .nth(4),
  ).toHaveText("5");
  await page.getByRole("link", { name: "Promotions", exact: true }).click();
  await page
    .getByLabel("Campaign name", { exact: true })
    .fill("Browser welcome offer");
  await page.getByLabel("Promotion code", { exact: true }).fill("BROWSER50");
  await page.getByLabel("Discount type").selectOption("FIXED");
  await page.getByLabel("Value", { exact: true }).fill("50.00");
  await page
    .getByLabel("Starts at")
    .fill(new Date(Date.now() - 86400000).toISOString().slice(0, 16));
  await page
    .getByLabel("Ends at")
    .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  await page
    .getByRole("button", { name: "Create promotion", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Browser welcome offer/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Cash registers", exact: true }).click();
  await page.getByLabel("Opening cash (MAD)", { exact: true }).fill("100.00");
  await page
    .getByRole("button", { name: "Open register", exact: true })
    .click();
  await expect(page.getByText("Expected cash:")).toBeVisible();
  await page.getByLabel("Require an open register", { exact: false }).click();
  await expect(
    page.getByLabel("Require an open register", { exact: false }),
  ).toBeChecked();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/v1/registers")).json())
          .requireCashSession,
    )
    .toBe(true);
  await page.getByRole("link", { name: "Point of sale", exact: true }).click();
  await page.getByRole("button", { name: /Browser linen shirt/ }).click();
  await page.getByRole("button", { name: /Black \/ M/ }).click();
  await page.getByLabel("Promotion code", { exact: true }).fill("BROWSER50");
  await page
    .getByRole("button", { name: "Cash received · Complete sale" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sale completed" }),
  ).toBeVisible();
  await expect(page.getByText(/^Discount:/)).toContainText("50.00");
  await page.getByRole("button", { name: "Start a new sale" }).click();
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "Understand your next chapter." }),
  ).toBeVisible();
  await expect(
    page.locator(".metric").filter({ hasText: "Net sales" }),
  ).toContainText("400.50");
  await page.screenshot({ path: ".local/reports.png", fullPage: true });
  await page.getByRole("link", { name: "Cash registers", exact: true }).click();
  await page.getByRole("button", { name: /Browser Owner.*Open/ }).click();
  await expect(page.getByText("Expected cash:")).toContainText("500.50");
  await page.getByLabel("Counted cash (MAD)").fill("500.50");
  await page
    .getByLabel("Closing note")
    .fill("Browser close with balanced drawer");
  await page
    .getByRole("button", { name: "Close register & record variance" })
    .click();
  await expect(
    page.getByText(/Counted/).filter({ hasText: "Variance" }),
  ).toContainText("0.00");
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: `BROWSER-${suffix}` })
      .getByRole("cell")
      .nth(4),
  ).toHaveText("4");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Good to see you, Browser." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
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
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/storefront");
  await page.getByLabel("Add a section").selectOption("BRAND_STORY");
  await page.getByLabel("Heading style").selectOption("SANS");
  await page.getByLabel("Catalog spacing").selectOption("COMPACT");
  await page.getByLabel("Footer text").fill("Browser brand footer");
  await page
    .getByLabel("Heading", { exact: true })
    .fill("A browser-verified collection");
  await page
    .getByLabel("Editorial copy")
    .fill("A real published story from this boutique’s content studio.");
  await page.getByRole("button", { name: "Publish storefront" }).click();
  await expect(
    page.getByText("Your storefront has been published.", { exact: false }),
  ).toBeVisible();
  const storefront = await context.newPage();
  storefront.on("pageerror", (e) => errors.push(e.message));
  await storefront.goto(`http://localhost:3000/${slug}`);
  await expect(
    storefront.getByRole("heading", { name: "A browser-verified collection" }),
  ).toBeVisible();
  await expect(storefront.locator(".store")).toHaveClass(/store-heading-sans/);
  await expect(storefront.getByText("Browser brand footer")).toBeVisible();
  await storefront.getByRole("button", { name: "Refine the edit" }).click();
  await storefront
    .getByLabel("Filter brand", { exact: true })
    .selectOption("Browser Brand");
  await storefront.getByLabel("Maximum price", { exact: true }).fill("100");
  await expect(
    storefront.getByRole("button", { name: /Browser linen shirt/ }),
  ).toHaveCount(0);
  await storefront.getByLabel("Maximum price", { exact: true }).fill("");
  await expect(
    storefront.getByRole("button", { name: /Browser linen shirt/ }),
  ).toBeVisible();
  await storefront.getByRole("button", { name: /Browser linen shirt/ }).click();
  await storefront.getByRole("button", { name: /^M\s*Black/ }).click();
  await storefront
    .getByRole("button", { name: "Add to bag", exact: true })
    .click();
  await storefront.getByRole("button", { name: "Reserve for pickup" }).click();
  await storefront
    .getByLabel("Your name", { exact: true })
    .fill("Pickup Customer");
  await storefront.getByLabel("Email address").fill("pickup@example.test");
  await storefront.getByLabel("Moroccan phone number").fill("+212612345678");
  await storefront
    .getByRole("button", { name: "Confirm pickup reservation" })
    .click();
  await expect(
    storefront.getByRole("heading", { name: "Your next favourite awaits." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Orders", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Pickup Customer" }),
  ).toContainText("pending");
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  const stockRow = page
    .getByRole("row")
    .filter({ hasText: `BROWSER-${suffix}` });
  await expect(stockRow.getByRole("cell").nth(2)).toHaveText("4");
  await expect(stockRow.getByRole("cell").nth(3)).toHaveText("1");
  await expect(stockRow.getByRole("cell").nth(4)).toHaveText("3");
  await storefront.goto(`http://localhost:3000/${slug}/account`);
  await storefront
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await storefront
    .getByLabel("Your name", { exact: true })
    .fill("Browser Member");
  await storefront
    .getByLabel("Moroccan phone", { exact: true })
    .fill("+212612345679");
  await storefront
    .getByLabel("Email address", { exact: true })
    .fill(`member-${suffix}@example.test`);
  await storefront.getByLabel("Password", { exact: true }).fill(password);
  await storefront.getByRole("checkbox").check();
  await storefront
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    storefront.getByRole("heading", { name: /Hello, Browser/ }),
  ).toBeVisible();
  await storefront
    .getByRole("button", { name: "Profile", exact: true })
    .click();
  await storefront.getByLabel("Sizes (separate with commas)").fill("M, L");
  await storefront
    .getByLabel("Categories (separate with commas)")
    .fill("Shirts");
  await storefront
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(
    storefront.getByText("Shopping preferences saved."),
  ).toBeVisible();
  await storefront.getByLabel("IN APP MARKETING", { exact: true }).click();
  await expect(
    storefront.getByLabel("IN APP MARKETING", { exact: true }),
  ).toBeChecked();
  await expect(
    storefront.getByText("Preference saved.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Customer campaigns", exact: true })
    .click();
  await page
    .getByLabel("Internal campaign name")
    .fill("Browser member welcome");
  await page
    .getByLabel("Message title", { exact: true })
    .fill("Your collection has arrived");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Explore the newest pieces in your boutique collection.");
  await page.getByRole("button", { name: "Save announcement draft" }).click();
  await page.getByRole("button", { name: "Publish this announcement" }).click();
  await expect
    .poll(
      async () => {
        const messages = await (
          await storefront.request.get(
            `http://localhost:3000/api/v1/storefront/${slug}/customer/notifications`,
          )
        ).json();
        return (
          Array.isArray(messages) &&
          messages.some(
            (item: { title: string }) =>
              item.title === "Your collection has arrived",
          )
        );
      },
      { timeout: 45000, intervals: [1500, 3000, 5000] },
    )
    .toBe(true);
  await storefront
    .getByRole("button", { name: "Messages", exact: true })
    .click();
  await expect(
    storefront.getByText("Your collection has arrived", { exact: true }),
  ).toBeVisible();
  await storefront.screenshot({
    path: ".local/customer-inbox.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Staff & access", exact: true }).click();
  await page.getByLabel("Staff email").fill(`staff-${suffix}@example.test`);
  await page.getByRole("button", { name: "Create invitation" }).click();
  await expect(page.getByLabel("Private invitation link")).toHaveValue(
    /\?invite=/,
  );
  await page.screenshot({ path: ".local/staff-access.png", fullPage: true });
  await storefront.goto("http://localhost:3000/atelier-noir");
  await storefront.screenshot({
    path: ".local/storefront-desktop.png",
    fullPage: true,
  });
  await storefront.setViewportSize({ width: 390, height: 844 });
  expect(
    await storefront.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await storefront.screenshot({
    path: ".local/storefront-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await page
    .locator(".recovery-panel")
    .getByLabel("Email address")
    .fill(`unregistered-${suffix}@example.test`);
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(
    page.getByText(
      "If this email has an account, a private recovery link will be sent.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close recovery" }).click();
  await page
    .getByLabel("Email address")
    .fill("atelier-noir@demo.innovia.local");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Enter your workspace" }).click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Good to see you, Amira." }),
  ).toBeVisible();
  await page.screenshot({ path: ".local/admin-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: ".local/admin-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.getByLabel("Language", { exact: true }).selectOption("ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/admin-rtl.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByLabel("اللغة", { exact: true }).selectOption("en");
  expect(errors).toEqual([]);
});
