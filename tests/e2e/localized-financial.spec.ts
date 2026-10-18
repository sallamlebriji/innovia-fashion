import { test, expect } from "@playwright/test";
import dotenv from "dotenv";
import { cleanupBrowserTenant } from "./helpers/tenant";

dotenv.config({ quiet: true });
const suffix = `${Date.now()}-${process.pid}`;
const business = `E2E Localized Financial ${suffix}`;
const customerName = "Client مُختبر $&";
const customerEmail = `customer-financial-${suffix}@example.test`;
const sku = `CASH-${suffix}`;
const code = `PROMO-${suffix}`;
let tenantId = "";
test.afterAll(() => cleanupBrowserTenant(tenantId, business));
const money = (value: number, locale: string) =>
  new Intl.NumberFormat(`${locale}-MA`, {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 2,
  }).format(value);

test("French registers/promotions and Arabic returns, exchanges, customer value and drawer reconciliation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "New to INNOVIA? Create a workspace" })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Financial Owner");
  await page.getByLabel("Business name").fill(business);
  await page
    .getByLabel("Email address")
    .fill(`financial-${suffix}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Financial-password-123");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  const session = await (await page.request.get("/api/v1/auth/me")).json();
  tenantId = session.tenant.id;
  const stores = await (await page.request.get("/api/v1/stores")).json();
  const products = [];
  for (const [name, price, variantSku] of [
    ["Chemise vendue قميص", "240.50", sku],
    ["Veste de remplacement سترة", "300.00", `EXCHANGE-${suffix}`],
  ]) {
    const response = await page.request.post("/api/v1/products", {
      headers: {
        "X-CSRF-Token": session.csrfToken,
        "Idempotency-Key": crypto.randomUUID(),
      },
      data: {
        name,
        category: "Pièces مُختبرة",
        brand: business,
        description: "Licensed test fixture",
        imageUrl: "",
        status: "ACTIVE",
        storeId: stores[0].id,
        variants: [
          {
            sku: variantSku,
            size: "M",
            color: "Bleu",
            price,
            cost: "100.00",
            quantity: 3,
            reorderPoint: 1,
          },
        ],
      },
    });
    expect(response.ok()).toBe(true);
    products.push(await response.json());
  }
  const language = page.locator(".topbar-actions select");
  const dialog = page.getByRole("dialog");
  await language.selectOption("fr");
  await page.goto("/promotions");
  await page
    .getByLabel("Nom de la campagne", { exact: true })
    .fill("Offre مُختبرة $&");
  await page.getByLabel("Code promotionnel", { exact: true }).fill(code);
  await page.getByLabel("Type de remise").selectOption("PERCENT");
  await page.getByLabel("Valeur", { exact: true }).fill("101");
  const start = new Date(Date.now() - 86400000).toISOString().slice(0, 16);
  const end = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  await page.getByLabel("Début", { exact: true }).fill(start);
  await page.getByLabel("Fin", { exact: true }).fill(start);
  await page
    .getByRole("button", { name: "Créer la promotion", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Choisissez une valeur positive, jusqu’à 100 pour un pourcentage.",
  );
  await expect(page.getByRole("alert")).toContainText(
    "La fin doit être postérieure au début.",
  );
  await page.getByLabel("Type de remise").selectOption("FIXED");
  await page.getByLabel("Valeur", { exact: true }).fill("50.00");
  await page.getByLabel("Fin", { exact: true }).fill(end);
  await page.getByLabel("Canal").selectOption("POS");
  await page
    .getByRole("button", { name: "Créer la promotion", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: `Offre مُختبرة $& ${code}` }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mettre en pause", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Activer", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Activer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mettre en pause", exact: true }),
  ).toBeVisible();
  const coupon = (await (await page.request.get("/api/v1/coupons")).json())[0];
  expect(coupon.kind).toBe("FIXED");
  expect(coupon.channel).toBe("POS");
  expect(coupon.active).toBe(true);

  await page.goto("/registers");
  await page.getByLabel("Fond de caisse (MAD)", { exact: true }).fill("100.00");
  await page
    .getByRole("button", { name: "Ouvrir la caisse", exact: true })
    .click();
  await expect(
    page.getByText("Espèces attendues :", { exact: false }),
  ).toContainText(money(100, "fr"));
  await page.getByLabel("Exiger une caisse ouverte", { exact: false }).click();
  await expect(
    page.getByLabel("Exiger une caisse ouverte", { exact: false }),
  ).toBeChecked();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/v1/registers")).json())
          .requireCashSession,
    )
    .toBe(true);
  await page.getByLabel("Sens").selectOption("IN");
  await page.getByLabel("Montant", { exact: true }).fill("25.00");
  await page.getByLabel("Motif", { exact: true }).fill("Apport مُختبر $&");
  await page.getByRole("button", { name: "Enregistrer le mouvement" }).click();
  await expect(
    page.getByText("Espèces attendues :", { exact: false }),
  ).toContainText(money(125, "fr"));
  await page.getByLabel("Sens").selectOption("OUT");
  await page.getByLabel("Montant", { exact: true }).fill("1000.00");
  await page.getByRole("button", { name: "Enregistrer le mouvement" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Ce mouvement dépasse les espèces disponibles ou le solde maximal de la caisse.",
  );
  await page.getByLabel("Montant", { exact: true }).fill("10.00");
  await page.getByLabel("Motif", { exact: true }).fill("Retrait مُختبر");
  await page.getByRole("button", { name: "Enregistrer le mouvement" }).click();
  await expect(
    page.getByText("Espèces attendues :", { exact: false }),
  ).toContainText(money(115, "fr"));
  await page.goto("/customers");
  await expect(
    page.getByRole("heading", {
      name: "Votre communauté commence par une rencontre.",
    }),
  ).toBeVisible();
  await page.goto("/pos");
  await page.getByRole("button", { name: /Chemise vendue قميص/ }).click();
  await dialog.getByRole("button", { name: /Bleu \/ M/ }).click();
  await page
    .getByRole("button", { name: "Augmenter Chemise vendue قميص", exact: true })
    .click();
  await page.getByLabel("Nom du client", { exact: true }).fill(customerName);
  await page
    .getByLabel("E-mail du client", { exact: true })
    .fill(customerEmail);
  await page.getByLabel("Code promotionnel", { exact: true }).fill(code);
  await expect(page.locator(".pos-cart .receipt-total")).toContainText(
    money(431, "fr"),
  );
  await page
    .getByRole("button", {
      name: "Espèces reçues · Terminer la vente",
      exact: true,
    })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Vente terminée" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Commencer une nouvelle vente" })
    .click();
  const order = (await (await page.request.get("/api/v1/orders")).json())
    .items[0];
  expect(Number(order.total)).toBe(431);
  const registers = await (await page.request.get("/api/v1/registers")).json();
  const registerId = registers.items[0].id;
  await page.goto("/registers");
  await page.getByRole("button", { name: /Financial Owner.*Ouverte/ }).click();
  await expect(
    page.getByText("Espèces attendues :", { exact: false }),
  ).toContainText(money(546, "fr"));
  await page.goto("/customers");
  await page.getByRole("button", { name: customerName, exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: customerName, exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: money(431, "fr"), exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel("Notes", { exact: true })
    .fill("Préférence privée تفضيل خاص $&");
  await dialog
    .getByRole("button", { name: "Enregistrer les notes privées" })
    .click();
  await expect
    .poll(async () => {
      const customers = await (
        await page.request.get("/api/v1/customers")
      ).json();
      const profile = await (
        await page.request.get(`/api/v1/crm/customers/${customers.items[0].id}`)
      ).json();
      return profile.customer.notes;
    })
    .toBe("Préférence privée تفضيل خاص $&");
  await dialog.getByRole("button", { name: "Fermer la fenêtre" }).click();

  await language.selectOption("ar");
  await page.goto("/orders");
  await page
    .getByRole("button", { name: `${order.number} إدارة الطلب`, exact: true })
    .click();
  await expect(dialog.locator(".badge").first()).toHaveText("مكتمل");
  await dialog
    .getByRole("button", { name: "إرجاع جزئي أو تبديل المقاس", exact: true })
    .click();
  await dialog.getByLabel(`الوحدات المرتجعة ${sku}`, { exact: true }).fill("1");
  await dialog.getByLabel("السبب", { exact: true }).fill("إرجاع مُختبر $&");
  await expect(dialog.locator(".receipt-total")).toContainText(
    money(215.5, "ar"),
  );
  await dialog
    .getByLabel("تمت تسوية الفرق النقدي المعروض مع العميل.", { exact: true })
    .check();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/return-form-mobile-ar.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "تسجيل الإرجاع الجزئي", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "تم تسجيل الإرجاع." }),
  ).toBeVisible();
  await expect(
    dialog.getByText("النقد المعاد للعميل", { exact: false }),
  ).toContainText(money(215.5, "ar"));
  await dialog
    .getByRole("button", { name: "العودة إلى الطلبات", exact: true })
    .click();
  await page.goto("/customers");
  await page.getByRole("button", { name: customerName, exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: money(215.5, "ar"), exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("الملاحظات", { exact: true })).toHaveValue(
    "Préférence privée تفضيل خاص $&",
  );
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/customer-profile-mobile-ar.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "إغلاق النافذة" }).click();
  await page.setViewportSize({ width: 1440, height: 1080 });
  await language.selectOption("fr");
  await page.goto("/orders");
  await page
    .getByRole("button", {
      name: `${order.number} Gérer la commande`,
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", {
      name: "Retour partiel ou échange de taille",
      exact: true,
    })
    .click();
  await dialog
    .getByLabel(`Unités retournées ${sku}`, { exact: true })
    .fill("1");
  await dialog.getByLabel("Motif", { exact: true }).fill("Échange مُختبر $&");
  await dialog
    .getByLabel("Échanger contre un autre article", { exact: true })
    .check();
  await dialog
    .getByLabel("SKU de remplacement", { exact: true })
    .selectOption(products[1].variants[0].id);
  await expect(dialog.locator(".receipt-total")).toContainText(
    money(84.5, "fr"),
  );
  await dialog
    .getByLabel(
      "La différence d’espèces affichée a été réglée avec le client.",
      { exact: true },
    )
    .check();
  await dialog
    .getByRole("button", { name: "Enregistrer l’échange", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Retour enregistré." }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Complément d’espèces reçu", { exact: false }),
  ).toContainText(money(84.5, "fr"));
  await dialog
    .getByRole("button", { name: "Retour aux commandes", exact: true })
    .click();
  await language.selectOption("ar");
  await page.goto("/customers");
  await page.getByRole("button", { name: customerName, exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: money(300, "ar"), exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("غير مشترك.", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "إغلاق النافذة" }).click();
  await page.goto("/registers");
  await page.getByRole("button", { name: /Financial Owner.*مفتوحة/ }).click();
  await expect(
    page.getByText("النقد المتوقع:", { exact: false }),
  ).toContainText(money(415, "ar"));
  await page.getByLabel("النقد المعدود (MAD)", { exact: true }).fill("415.00");
  await page
    .getByLabel("ملاحظة الإغلاق", { exact: true })
    .fill("إغلاق متوازن $&");
  await page
    .getByRole("button", { name: "إغلاق الصندوق وتسجيل الفرق", exact: true })
    .click();
  await expect(
    page.getByText("المبلغ المعدود", { exact: false }),
  ).toContainText(money(0, "ar"));
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/registers-mobile-ar.png",
    fullPage: true,
  });
  await page.goto("/promotions");
  await expect(
    page.getByRole("heading", { name: "العروض.", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("رمز العرض", { exact: true })).toHaveAttribute(
    "dir",
    "ltr",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/promotions-mobile-ar.png",
    fullPage: true,
  });
  const drawer = await (
    await page.request.get(`/api/v1/registers/${registerId}`)
  ).json();
  expect(Number(drawer.balance)).toBe(415);
  expect(Number(drawer.countedCash)).toBe(415);
  expect(Number(drawer.variance)).toBe(0);
  expect(
    drawer.movements.map((movement: { type: string }) => movement.type).sort(),
  ).toEqual(
    ["OPENING", "IN", "OUT", "SALE", "SALE", "REFUND", "REFUND"].sort(),
  );
  const finalOrders = (await (await page.request.get("/api/v1/orders")).json())
    .items;
  expect(finalOrders).toHaveLength(2);
  const refunded = finalOrders.find(
    (item: { id: string }) => item.id === order.id,
  );
  expect(refunded.status).toBe("REFUNDED");
  expect(Number(refunded.refundedTotal)).toBe(431);
  expect(
    refunded.returns.map((record: { reason: string }) => record.reason).sort(),
  ).toEqual(["إرجاع مُختبر $&", "Échange مُختبر $&"].sort());
  const finalProducts = (
    await (await page.request.get("/api/v1/products")).json()
  ).items;
  expect(
    finalProducts.find(
      (product: { id: string }) => product.id === products[0].id,
    ).variants[0].inventory[0].onHand,
  ).toBe(3);
  expect(
    finalProducts.find(
      (product: { id: string }) => product.id === products[1].id,
    ).variants[0].inventory[0].onHand,
  ).toBe(2);
  expect(errors).toEqual([]);
});
