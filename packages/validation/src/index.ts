import { z } from "zod";
const money = z
  .string()
  .regex(
    /^\d{1,8}(\.\d{1,2})?$/,
    "Use a positive amount with up to two decimals.",
  );
const image = z
  .string()
  .max(2048)
  .refine((v) => {
    if (v === "") return true;
    if (/^\/api\/v1\/media\/[a-zA-Z0-9_-]+$/.test(v)) return true;
    try {
      return new URL(v).protocol === "https:";
    } catch {
      return false;
    }
  }, "Use an HTTPS image URL.");
const password = z
  .string()
  .max(72)
  .refine(
    (v) => new TextEncoder().encode(v).length <= 72,
    "Passwords must be at most 72 UTF-8 bytes.",
  );
export const loginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  password: password.refine((v) => v.length >= 1, "Enter your password."),
});
export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  businessName: z.string().min(2).max(100),
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  password: password.refine(
    (v) => v.length >= 12,
    "Use at least 12 characters.",
  ),
});
export const variantSchema = z.object({
  sku: z.string().min(2).max(80),
  size: z.string().min(1).max(20),
  color: z.string().min(1).max(40),
  price: money,
  cost: money,
  barcode: z.string().max(80).optional(),
  quantity: z.number().int().min(0).max(100000),
  reorderPoint: z.number().int().min(0).max(10000).default(5),
});
export const productSchema = z
  .object({
    name: z.string().min(2).max(150),
    description: z.string().max(5000).default(""),
    category: z.string().min(1).max(80),
    brand: z.string().max(80).default(""),
    collection: z.string().max(80).default(""),
    imageUrl: image.default(""),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("ACTIVE"),
    storeId: z.string().min(1),
    variants: z.array(variantSchema).min(1).max(100),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.variants.map((x) => x.sku)).size !== v.variants.length)
      ctx.addIssue({
        code: "custom",
        message: "Every variant needs a unique SKU.",
        path: ["variants"],
      });
  });
export const adjustmentSchema = z.object({
  variantId: z.string().min(1),
  storeId: z.string().min(1),
  quantity: z
    .number()
    .int()
    .min(-100000)
    .max(100000)
    .refine((v) => v !== 0, "Quantity cannot be zero."),
  reason: z.string().min(3).max(500),
});
export const checkoutSchema = z.object({
  storeId: z.string().min(1),
  customerName: z.string().min(2).max(100),
  email: z.string().email().optional(),
  phone: z
    .string()
    .regex(/^(\+212|0)[5-7]\d{8}$/, "Use a Moroccan phone number.")
    .optional(),
  channel: z.enum(["POS", "ONLINE"]),
  paymentMethod: z.enum(["CASH", "CASH_ON_DELIVERY", "PICKUP"]),
  rewardCode: z.string().min(8).max(100).optional(),
  couponCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,50}$/)
    .optional(),
  deliveryZoneId: z.string().min(1).optional(),
  shippingAddress: z
    .object({
      recipient: z.string().min(2).max(100),
      street: z.string().min(5).max(500),
      city: z.string().min(2).max(80),
      postalCode: z.string().regex(/^\d{5}$/),
      phone: z.string().regex(/^(\+212|0)[5-7]\d{8}$/),
      country: z.literal("MA").default("MA"),
    })
    .optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(50),
});
export const brandingSchema = z.object({
  name: z.string().min(2).max(100),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  currency: z.enum(["MAD", "EUR", "USD"]),
  locale: z.enum(["en", "fr", "ar"]),
  heroTitle: z.string().min(2).max(120),
  heroSubtitle: z.string().max(200),
  heroImage: image,
});
export const storeSchema = z.object({
  name: z.string().min(2).max(100),
  city: z.string().min(2).max(80),
  kind: z.enum(["STORE", "WAREHOUSE"]).default("STORE"),
});
export const planSchema = z.object({
  name: z.string().min(2).max(50),
  monthlyPrice: money,
  productLimit: z.number().int().min(1).max(1000000),
  storeLimit: z.number().int().min(1).max(1000),
  employeeLimit: z.number().int().min(1).max(10000).default(10),
  aiCredits: z.number().int().min(0).max(1000000).default(0),
  trialDays: z.number().int().min(0).max(90).default(14),
});
export type ProductInput = z.infer<typeof productSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const returnSchema = z
  .object({
    orderId: z.string().min(1),
    reason: z.string().min(3).max(500),
    items: z
      .array(
        z.object({
          orderItemId: z.string().min(1),
          quantity: z.number().int().min(1).max(100000),
          restock: z.boolean(),
        }),
      )
      .min(1)
      .max(50),
    replacementItems: z
      .array(
        z.object({
          variantId: z.string().min(1),
          quantity: z.number().int().min(1).max(100),
        }),
      )
      .min(1)
      .max(50)
      .optional(),
    expectedCashDifference: z
      .string()
      .regex(/^-?\d{1,10}(\.\d{1,2})?$/)
      .optional(),
  })
  .refine(
    (v) => new Set(v.items.map((i) => i.orderItemId)).size === v.items.length,
    "Each return line may appear once.",
  );
export const loyaltyProgramSchema = z
  .object({
    name: z.string().min(2).max(100),
    enabled: z.boolean(),
    spendUnit: money.refine((v) => Number(v) > 0),
    pointsPerUnit: z.number().int().min(1).max(10000),
    expiryDays: z.number().int().min(0).max(3650),
    birthdayPoints: z.number().int().min(0).max(100000).default(0),
    referralPoints: z.number().int().min(0).max(100000).default(0),
    tiers: z
      .array(
        z.object({
          name: z.string().min(2).max(80),
          threshold: z.number().int().min(0).max(100000000),
          benefits: z.string().max(1000),
          multiplier: z.number().int().min(1).max(10),
        }),
      )
      .max(10),
  })
  .refine(
    (v) => new Set(v.tiers.map((t) => t.threshold)).size === v.tiers.length,
    "Tier thresholds must be distinct.",
  );
export const rewardSchema = z.object({
  name: z.string().min(2).max(100),
  pointsCost: z.number().int().min(1).max(100000000),
  discountValue: money.refine((v) => Number(v) > 0),
  active: z.boolean().default(true),
});

export const customerRegisterSchema = registerSchema
  .omit({ businessName: true })
  .extend({
    phone: z.string().regex(/^(\+212|0)[5-7]\d{8}$/),
    client: z.enum(["web", "native"]).default("web"),
    termsAccepted: z.literal(true),
  });
export const customerLoginSchema = loginSchema.extend({
  client: z.enum(["web", "native"]).default("web"),
});
export const addressSchema = z.object({
  label: z.string().min(2).max(80),
  recipient: z.string().min(2).max(100),
  street: z.string().min(5).max(500),
  city: z.string().min(2).max(80),
  postalCode: z.string().regex(/^\d{5}$/),
  phone: z.string().regex(/^(\+212|0)[5-7]\d{8}$/),
  country: z.literal("MA").default("MA"),
});
export const deliveryZoneSchema = z.object({
  name: z.string().min(2).max(100),
  cities: z.array(z.string().min(2).max(80)).min(1).max(100),
  fee: money,
  active: z.boolean().default(true),
});
export const commerceSettingsSchema = z.object({
  taxRate: z
    .string()
    .regex(/^\d{1,3}(\.\d{1,2})?$/)
    .refine((v) => Number(v) <= 100),
  refundShipping: z.boolean(),
  reservationMinutes: z.number().int().min(15).max(10080),
  legalName: z.string().max(150),
  invoiceAddress: z.string().max(500),
  taxIdentifier: z.string().max(100),
  contactEmail: z.union([z.string().email(), z.literal("")]),
  contactPhone: z.string().max(50),
  returnPolicy: z.string().max(5000),
  deliveryPolicy: z.string().max(5000),
});
const ctaHref = z
  .string()
  .max(2048)
  .refine(
    (v) =>
      v === "" ||
      (/^\/(?!\/)/.test(v) && !/[\\\r\n]/.test(v)) ||
      v.startsWith("#") ||
      (() => {
        try {
          return new URL(v).protocol === "https:";
        } catch {
          return false;
        }
      })(),
    "Use an HTTPS URL or a storefront path.",
  );
export const cmsSectionSchema = z
  .object({
    kind: z.enum([
      "HERO",
      "EDITORIAL",
      "FEATURED_COLLECTION",
      "PROMO",
      "BRAND_STORY",
      "VIDEO",
      "NEWSLETTER",
    ]),
    title: z.string().max(150),
    body: z.string().max(3000),
    imageUrl: image,
    ctaLabel: z.string().max(80),
    ctaHref,
    collection: z.string().max(80),
    active: z.boolean(),
    startsAt: z.string().datetime().nullable(),
    endsAt: z.string().datetime().nullable(),
  })
  .refine(
    (v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt,
    "The campaign end must follow its start.",
  );
export const storefrontDesignSchema = z
  .object({
    logoUrl: image.default(""),
    faviconUrl: image.default(""),
    headingFont: z.enum(["SERIF", "SANS"]).default("SERIF"),
    spacing: z.enum(["AIRY", "COMPACT"]).default("AIRY"),
    footerText: z
      .string()
      .max(500)
      .default("Independent fashion. Beautifully connected."),
    navigation: z
      .array(z.object({ label: z.string().min(1).max(40), href: ctaHref }))
      .max(6)
      .default([]),
    socialLinks: z
      .array(
        z.object({
          label: z.string().min(1).max(40),
          href: z
            .string()
            .url()
            .max(2048)
            .refine(
              (value) => new URL(value).protocol === "https:",
              "Use an HTTPS social profile URL.",
            ),
        }),
      )
      .max(6)
      .default([]),
  })
  .strict();
export const cmsPageSchema = z.object({
  title: z.string().min(2).max(150),
  seoTitle: z.string().max(150),
  seoDescription: z.string().max(500),
  design: storefrontDesignSchema
    .nullish()
    .transform((value) => value ?? storefrontDesignSchema.parse({})),
  sections: z.array(cmsSectionSchema).max(20),
});

export const productEditSchema = z
  .object({
    tryOnEnabled: z.boolean().optional(),
    arLensId: z
      .string()
      .max(150)
      .regex(/^[a-zA-Z0-9_-]*$/)
      .optional(),
    arGroupId: z
      .string()
      .max(150)
      .regex(/^[a-zA-Z0-9_-]*$/)
      .optional(),
    tryOnImageUrl: image.optional(),
    name: z.string().min(2).max(150).optional(),
    description: z.string().max(5000).optional(),
    category: z.string().min(1).max(80).optional(),
    brand: z.string().max(80).optional(),
    collection: z.string().max(80).optional(),
    imageUrl: image.optional(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    season: z.string().max(80).optional(),
    audience: z.string().max(80).optional(),
    material: z.string().max(200).optional(),
    fit: z.string().max(80).optional(),
    care: z.string().max(2000).optional(),
    sizeChart: z
      .array(
        z.object({
          size: z.string().min(1).max(20),
          chest: z.number().positive().max(300).optional(),
          waist: z.number().positive().max(300).optional(),
          length: z.number().positive().max(300).optional(),
          footLength: z.number().positive().max(60).optional(),
          equivalentSizes: z.string().max(100).optional(),
        }),
      )
      .max(50)
      .optional(),
  })
  .strict();
export const variantEditSchema = variantSchema
  .omit({ quantity: true, reorderPoint: true })
  .partial()
  .strict();
export const productMediaSchema = z.object({
  items: z
    .array(
      z.object({
        url: image.refine((v) => v !== "", "Enter a media URL."),
        alt: z.string().max(200),
        kind: z.enum(["IMAGE", "VIDEO"]),
      }),
    )
    .max(20),
});
export const transferSchema = z
  .object({
    variantId: z.string().min(1),
    fromStoreId: z.string().min(1),
    toStoreId: z.string().min(1),
    quantity: z.number().int().min(1).max(100000),
    reason: z.string().min(3).max(500),
  })
  .refine(
    (v) => v.fromStoreId !== v.toStoreId,
    "Choose two different locations.",
  );
export const stockCountSchema = z.object({
  variantId: z.string().min(1),
  storeId: z.string().min(1),
  counted: z.number().int().min(0).max(100000),
  reason: z.string().min(3).max(500),
});
export const supplierSchema = z.object({
  name: z.string().min(2).max(150),
  email: z.union([z.string().email(), z.literal("")]).default(""),
  phone: z.string().max(50).default(""),
  address: z.string().max(500).default(""),
  active: z.boolean().default(true),
});
export const purchaseSchema = z
  .object({
    supplierId: z.string().min(1),
    storeId: z.string().min(1),
    notes: z.string().max(2000).default(""),
    items: z
      .array(
        z.object({
          variantId: z.string().min(1),
          quantity: z.number().int().min(1).max(100000),
          unitCost: money,
        }),
      )
      .min(1)
      .max(100),
  })
  .refine(
    (v) => new Set(v.items.map((i) => i.variantId)).size === v.items.length,
    "Each SKU may appear once.",
  );
