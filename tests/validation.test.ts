import { describe, it, expect } from "vitest";
import {
  productSchema,
  checkoutSchema,
  brandingSchema,
  registerSchema,
} from "@innovia/validation";
const variant = {
  sku: "SKU-1",
  size: "M",
  color: "Black",
  price: "120.50",
  cost: "70.00",
  quantity: 5,
};
const product = {
  name: "Linen shirt",
  category: "Shirts",
  storeId: "store-1",
  variants: [variant],
};
describe("shared business validation", () => {
  it("rejects passwords that bcrypt would silently truncate", () => {
    expect(
      registerSchema.safeParse({
        name: "Test Owner",
        businessName: "Test Shop",
        email: "owner@example.test",
        password: "🔒".repeat(20),
      }).success,
    ).toBe(false);
  });
  it("preserves money as decimal strings", () =>
    expect(productSchema.parse(product).variants[0]?.price).toBe("120.50"));
  it.each(["12.345", "-10", "NaN", "1e4"])(
    "rejects malformed price %s",
    (price) =>
      expect(
        productSchema.safeParse({
          ...product,
          variants: [{ ...variant, price }],
        }).success,
      ).toBe(false),
  );
  it("rejects duplicate variant SKUs", () =>
    expect(
      productSchema.safeParse({ ...product, variants: [variant, variant] })
        .success,
    ).toBe(false));
  it("rejects negative initial inventory", () =>
    expect(
      productSchema.safeParse({
        ...product,
        variants: [{ ...variant, quantity: -1 }],
      }).success,
    ).toBe(false));
  it("rejects unsafe image protocols", () =>
    expect(
      productSchema.safeParse({ ...product, imageUrl: "javascript:alert(1)" })
        .success,
    ).toBe(false));
  it("validates Moroccan mobile contact details", () => {
    const input = {
      storeId: "x",
      customerName: "Customer",
      channel: "ONLINE",
      paymentMethod: "PICKUP",
      items: [{ variantId: "v", quantity: 1 }],
    };
    expect(
      checkoutSchema.safeParse({ ...input, phone: "+212612345678" }).success,
    ).toBe(true);
    expect(
      checkoutSchema.safeParse({ ...input, phone: "+15555555555" }).success,
    ).toBe(false);
  });
  it("rejects unsupported currencies", () =>
    expect(
      brandingSchema.safeParse({
        name: "Shop",
        accent: "#ffffff",
        currency: "BTC",
        locale: "en",
        heroTitle: "Hello",
        heroSubtitle: "",
        heroImage: "",
      }).success,
    ).toBe(false));
});
