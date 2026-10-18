import { test, expect } from "@playwright/test";
import dotenv from "dotenv";
import { cleanupBrowserTenant } from "./helpers/tenant";

dotenv.config({ quiet: true });
const suffix = `${Date.now()}-${process.pid}`;
const business = `E2E Localized ${suffix}`;
const name = "Chemise مُختبرة $&";
const sku = `LOCALIZED-${suffix}`;
let tenantId = "";
test.afterAll(() => cleanupBrowserTenant(tenantId, business));

test("French catalog edits/import and Arabic stock, cash sale, receipts and mobile RTL", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "New to INNOVIA? Create a workspace" })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Localized Owner");
  await page.getByLabel("Business name").fill(business);
  await page
    .getByLabel("Email address")
    .fill(`localized-${suffix}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Localized-password-123");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  const session = await (await page.request.get("/api/v1/auth/me")).json();
  tenantId = session.tenant.id;
  const language = page.locator(".topbar-actions select");
  await language.selectOption("fr");
  await page.goto("/catalog");
  await expect(
    page.getByRole("heading", { name: "Une collection de possibilités." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ajouter un produit", exact: true })
    .click();
  await page.getByLabel("Nom du produit", { exact: true }).fill(name);
  await page.getByLabel("Catégorie", { exact: true }).fill("Chemises قمصان");
  await page.getByLabel("SKU", { exact: true }).fill(sku);
  await page.getByLabel("Couleur", { exact: true }).fill("Bleu أزرق");
  await page.getByLabel("Prix (MAD)", { exact: true }).fill("240.50");
  await page.getByLabel("Coût", { exact: true }).fill("100.00");
  await page.getByLabel("Stock", { exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Créer le produit", exact: true })
    .click();
  const productButton = page
    .getByRole("button", { name, exact: false })
    .first();
  await expect(productButton).toBeVisible();
  await productButton.click();
  await page
    .getByRole("button", { name: "Modifier le produit", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: `Modifier ${name}` }),
  ).toBeVisible();
  await dialog.getByLabel("Statut", { exact: true }).selectOption("DRAFT");
  await dialog
    .getByRole("button", { name: "Enregistrer les détails du produit" })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Votre catalogue est à jour.",
  );
  const firstProduct = (
    await (await page.request.get("/api/v1/products")).json()
  ).items[0];
  expect(firstProduct.status).toBe("DRAFT");
  expect(firstProduct.name).toBe(name);
  expect(firstProduct.variants[0].sku).toBe(sku);
  await dialog.getByLabel("Statut", { exact: true }).selectOption("ACTIVE");
  await dialog
    .getByRole("button", { name: "Enregistrer les détails du produit" })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Votre catalogue est à jour.",
  );
  await dialog
    .getByRole("button", { name: "Guide des tailles", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Ajouter une taille", exact: true })
    .click();
  await dialog.getByLabel("Taille", { exact: true }).first().fill("M");
  await dialog.getByLabel("Poitrine", { exact: false }).fill("100");
  await dialog
    .getByRole("button", { name: "Enregistrer le guide des tailles" })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Votre catalogue est à jour.",
  );
  await dialog.getByRole("button", { name: "Médias", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Ajouter un média", exact: true })
    .click();
  await dialog
    .getByLabel("URL du média", { exact: true })
    .fill("https://example.test/licensed-fixture.mp4");
  await dialog
    .getByLabel("Description accessible", { exact: true })
    .fill("Vidéo autorisée فيديو");
  await dialog.getByLabel("Type de média").selectOption("VIDEO");
  await dialog
    .getByRole("button", { name: "Enregistrer l’ordre de la galerie" })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Votre catalogue est à jour.",
  );
  await dialog.getByRole("button", { name: "Fermer la fenêtre" }).click();

  await page
    .getByRole("button", { name: "Importer un CSV", exact: true })
    .click();
  await dialog.getByLabel("Fichier CSV").setInputFiles({
    name: "localized-catalog.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      `name,category,sku,size,color,price,cost,quantity,status\nChemise importée قميص,Chemises,IMPORT-${suffix},M,Ivoire,90.00,20.00,2,DRAFT\n`,
    ),
  });
  await dialog
    .getByRole("button", { name: "Vérifier et prévisualiser" })
    .click();
  await expect(
    dialog.getByText("Prêt à importer", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Importer 1 produit", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Import terminé." }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fermer la fenêtre" }).click();

  await language.selectOption("ar");
  await page.goto("/inventory");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "القطع المناسبة. في المكان المناسب." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "تعديل المخزون", exact: true })
    .click();
  await dialog
    .getByLabel("خيار المنتج", { exact: true })
    .selectOption(firstProduct.variants[0].id);
  await dialog.getByLabel("تعديل الكمية", { exact: true }).fill("-100");
  await dialog
    .getByLabel("السبب", { exact: true })
    .fill("التحقق من رفض مخزون سالب");
  await dialog.getByRole("button", { name: "حفظ التعديل" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "سيقلّل هذا التعديل المخزون إلى أقل من الكمية المحجوزة.",
  );
  await dialog.getByLabel("تعديل الكمية", { exact: true }).fill("2");
  await dialog.getByLabel("السبب", { exact: true }).fill("استلام مُختبر");
  await dialog.getByRole("button", { name: "حفظ التعديل" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: sku }).getByRole("cell").nth(4),
  ).toHaveText("5");
  await page.getByRole("button", { name: "سجل الحركات", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "استلام مُختبر" }),
  ).toContainText("تعديل");
  await page.screenshot({ path: ".local/inventory-ar.png", fullPage: true });

  await page.goto("/pos");
  await expect(
    page.getByRole("heading", { name: "بيع بكل سهولة." }),
  ).toBeVisible();
  await expect(page.getByLabel("اسم العميل", { exact: true })).toHaveValue(
    "عميل عابر",
  );
  await page.getByRole("button", { name, exact: false }).click();
  await dialog.getByRole("button", { name: /Bleu أزرق \/ M/ }).click();
  await expect(page.locator(".pos-cart .panel-heading .badge")).toHaveText(
    "قطعة واحدة",
  );
  await page
    .getByRole("button", { name: `زيادة ${name}`, exact: true })
    .click();
  await expect(page.locator(".pos-cart .panel-heading .badge")).toHaveText(
    "قطعتان",
  );
  await page
    .getByRole("button", { name: `تقليل ${name}`, exact: true })
    .click();
  for (let unit = 0; unit < 5; unit++)
    await page
      .getByRole("button", { name: `زيادة ${name}`, exact: true })
      .click();
  await page
    .getByRole("button", { name: "تم استلام النقد · إكمال البيع", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    `المخزون المتاح غير كافٍ لـ ${name} (M).`,
  );
  for (let unit = 0; unit < 5; unit++)
    await page
      .getByRole("button", { name: `تقليل ${name}`, exact: true })
      .click();
  // The default display follows the locale while the stable customer data remains unchanged.
  await language.selectOption("fr");
  await expect(page.getByLabel("Nom du client", { exact: true })).toHaveValue(
    "Client de passage",
  );
  await language.selectOption("ar");
  await page
    .getByRole("button", { name: "تم استلام النقد · إكمال البيع", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "اكتمل البيع" }),
  ).toBeVisible();
  const localizedAmount = new Intl.NumberFormat("ar-MA", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 2,
  }).format(240.5);
  await expect(dialog.locator(".receipt-total")).toContainText(localizedAmount);
  await expect(
    dialog.getByRole("button", { name: "طباعة الإيصال" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/receipt-mobile-ar.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "بدء بيع جديد" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: ".local/pos-mobile-ar.png", fullPage: true });

  const orders = (await (await page.request.get("/api/v1/orders")).json())
    .items;
  expect(orders).toHaveLength(1);
  expect(orders[0].total).toBe("240.5");
  expect(orders[0].customerName).toBe("Walk-in customer");
  const finalProducts = (
    await (await page.request.get("/api/v1/products")).json()
  ).items;
  const sold = finalProducts.find(
    (product: { id: string }) => product.id === firstProduct.id,
  );
  expect(sold.status).toBe("ACTIVE");
  expect(sold.media[0].kind).toBe("VIDEO");
  expect(sold.media[0].alt).toBe("Vidéo autorisée فيديو");
  expect(sold.sizeChart[0].chest).toBe(100);
  expect(sold.variants[0].inventory[0].onHand).toBe(4);
  expect(
    finalProducts.find(
      (product: { name: string }) => product.name === "Chemise importée قميص",
    ).status,
  ).toBe("DRAFT");
  await page.goto("/catalog?new=1");
  await expect(
    dialog.getByRole("heading", { name: "قطعة جديدة. إمكانية جديدة." }),
  ).toBeVisible();
  await expect(dialog.getByLabel("SKU", { exact: true })).toHaveAttribute(
    "dir",
    "ltr",
  );
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/product-form-mobile-ar.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(
    dialog.getByRole("heading", { name: "قطعة جديدة. إمكانية جديدة." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
