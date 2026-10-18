import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { hashPassword } from "../apps/api/src/auth.js";
const prisma = new PrismaClient();
const photo = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=85`;
const catalog = [
  [
    "The everyday blazer",
    "Tailoring",
    "photo-1591047139829-d91aecb6caea",
    "1890.00",
    "820.00",
    "Sand",
  ],
  [
    "Sculpted leather tote",
    "Accessories",
    "photo-1553062407-98eeb64c6a62",
    "1290.00",
    "480.00",
    "Onyx",
  ],
  [
    "Essential cotton shirt",
    "Essentials",
    "photo-1596755094514-f87e34085b2c",
    "690.00",
    "220.00",
    "White",
  ],
  [
    "The city sneaker",
    "Footwear",
    "photo-1549298916-b41d501d3772",
    "1590.00",
    "620.00",
    "Clay",
  ],
  [
    "Fluid evening dress",
    "Dresses",
    "photo-1539008835657-9e8e9680c956",
    "2190.00",
    "900.00",
    "Noir",
  ],
  [
    "Soft structure knit",
    "Knitwear",
    "photo-1576566588028-4147f3842f27",
    "890.00",
    "320.00",
    "Ivory",
  ],
  [
    "Relaxed denim",
    "Denim",
    "photo-1542272604-787c3835535d",
    "790.00",
    "280.00",
    "Indigo",
  ],
  [
    "The weekend jacket",
    "Outerwear",
    "photo-1543076447-215ad9ba6923",
    "2490.00",
    "1050.00",
    "Olive",
  ],
  [
    "Quiet luxury loafer",
    "Footwear",
    "photo-1614252235316-8c857d38b5f4",
    "1690.00",
    "700.00",
    "Espresso",
  ],
  [
    "Fine ribbed tank",
    "Essentials",
    "photo-1503341504253-dff4815485f1",
    "390.00",
    "130.00",
    "Cream",
  ],
  [
    "Signature crossbody",
    "Accessories",
    "photo-1584917865442-de89df76afd3",
    "1190.00",
    "420.00",
    "Cognac",
  ],
  [
    "The linen edit",
    "Tailoring",
    "photo-1594633312681-425c7b97ccd1",
    "990.00",
    "350.00",
    "Natural",
  ],
] as const;
async function seed() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seeding is prohibited in production.");
  if (!process.env.DEMO_PASSWORD || !process.env.BOOTSTRAP_ADMIN_PASSWORD)
    throw new Error(
      "Set DEMO_PASSWORD and BOOTSTRAP_ADMIN_PASSWORD before seeding.",
    );
  const starter = await prisma.subscriptionPlan.upsert({
    where: { name: "Starter" },
    update: {},
    create: {
      name: "Starter",
      monthlyPrice: "299.00",
      productLimit: 100,
      storeLimit: 1,
    },
  });
  const professional = await prisma.subscriptionPlan.upsert({
    where: { name: "Professional" },
    update: {},
    create: {
      name: "Professional",
      monthlyPrice: "699.00",
      productLimit: 2000,
      storeLimit: 5,
    },
  });
  await prisma.subscriptionPlan.upsert({
    where: { name: "Enterprise" },
    update: {},
    create: {
      name: "Enterprise",
      monthlyPrice: "1499.00",
      productLimit: 100000,
      storeLimit: 100,
    },
  });
  const hash = await hashPassword(process.env.DEMO_PASSWORD);
  for (const [index, business] of [
    {
      name: "ATELIER NOIR",
      slug: "atelier-noir",
      owner: "Amira",
      city: "Casablanca",
    },
    { name: "URBAN SOLE", slug: "urban-sole", owner: "Youssef", city: "Rabat" },
    {
      name: "MODA STUDIO",
      slug: "moda-studio",
      owner: "Nadia",
      city: "Marrakech",
    },
  ].entries()) {
    const existing = await prisma.tenant.findUnique({
      where: { slug: business.slug },
    });
    if (
      existing &&
      (!existing.demo ||
        (await prisma.auditLog.count({
          where: { tenantId: existing.id, action: "DEMO_SEEDED" },
        })))
    )
      continue;
    const tenant =
      existing ??
      (await prisma.tenant.create({
        data: {
          name: business.name,
          slug: business.slug,
          planId: index === 0 ? professional.id : starter.id,
          demo: true,
          heroTitle: "The art of everyday.",
          heroSubtitle:
            "A new season. A fresh perspective. Discover the autumn edit.",
          heroImage: photo("photo-1483985988355-763728e1935b"),
        },
      }));
    const user = await prisma.user.upsert({
      where: { email: `${business.slug}@demo.innovia.local` },
      update: {},
      create: {
        tenantId: tenant.id,
        name: business.owner,
        email: `${business.slug}@demo.innovia.local`,
        passwordHash: hash,
        role: "OWNER",
      },
    });
    await prisma.user.upsert({
      where: { email: `cashier-${business.slug}@demo.innovia.local` },
      update: {},
      create: {
        tenantId: tenant.id,
        name: "Demo Cashier",
        email: `cashier-${business.slug}@demo.innovia.local`,
        passwordHash: hash,
        role: "CASHIER",
      },
    });
    const store =
      (await prisma.store.findFirst({
        where: { tenantId: tenant.id, name: `${business.city} flagship` },
      })) ??
      (await prisma.store.create({
        data: {
          tenantId: tenant.id,
          name: `${business.city} flagship`,
          city: business.city,
        },
      }));
    if (
      index === 0 &&
      !(await prisma.store.findFirst({
        where: { tenantId: tenant.id, name: "Rabat concept store" },
      }))
    )
      await prisma.store.create({
        data: {
          tenantId: tenant.id,
          name: "Rabat concept store",
          city: "Rabat",
        },
      });
    const variants: {
      id: string;
      productId: string;
      price: Prisma.Decimal;
      name: string;
      sku: string;
    }[] = [];
    for (const [
      pIndex,
      [name, category, image, price, cost, color],
    ] of catalog.entries()) {
      const product =
        (await prisma.product.findFirst({
          where: { tenantId: tenant.id, name },
        })) ??
        (await prisma.product.create({
          data: {
            tenantId: tenant.id,
            name,
            category,
            description:
              "Thoughtfully selected for the modern wardrobe. This fictional demo item uses illustrative stock photography; replace with verified product photography before selling.",
            brand: business.name,
            collection: "Autumn / Winter 2026",
            imageUrl: photo(image),
            status: pIndex === 11 ? "DRAFT" : "ACTIVE",
          },
        }));
      for (const [sIndex, size] of (category === "Footwear"
        ? ["40", "41", "42"]
        : category === "Accessories"
          ? ["One size"]
          : ["S", "M", "L"]
      ).entries()) {
        const sku = `${business.slug.slice(0, 3).toUpperCase()}-${pIndex + 1}-${size.replaceAll(" ", "")}`;
        const variant = await prisma.productVariant.upsert({
          where: { tenantId_sku: { tenantId: tenant.id, sku } },
          update: {},
          create: {
            tenantId: tenant.id,
            productId: product.id,
            size,
            color,
            price,
            cost,
            sku,
          },
        });
        const stock =
          pIndex === 4 || pIndex === 8 ? sIndex + 3 : 25 + pIndex * 2;
        if (
          !(await prisma.inventory.findUnique({
            where: {
              tenantId_variantId_storeId: {
                tenantId: tenant.id,
                variantId: variant.id,
                storeId: store.id,
              },
            },
          }))
        ) {
          await prisma.inventory.create({
            data: {
              tenantId: tenant.id,
              variantId: variant.id,
              storeId: store.id,
              onHand: stock,
            },
          });
          await prisma.stockMovement.create({
            data: {
              tenantId: tenant.id,
              variantId: variant.id,
              storeId: store.id,
              actorId: user.id,
              type: "OPENING",
              quantity: stock,
              reason: "Fictional demonstration stock",
            },
          });
        }
        variants.push({
          id: variant.id,
          productId: product.id,
          price: variant.price,
          name,
          sku,
        });
      }
    }
    const customers = [];
    for (const [cIndex, name] of [
      "Salma Bennani",
      "Omar El Idrissi",
      "Lina Tazi",
      "Mehdi Alaoui",
      "Inès Amrani",
      "Sara Berrada",
      "Adam Fassi",
      "Nour Chraibi",
    ].entries())
      customers.push(
        await prisma.customer.upsert({
          where: {
            tenantId_email: {
              tenantId: tenant.id,
              email: `customer${cIndex}@${business.slug}.example`,
            },
          },
          update: {},
          create: {
            tenantId: tenant.id,
            name,
            email: `customer${cIndex}@${business.slug}.example`,
            phone: `+21261234000${cIndex}`,
          },
        }),
      );
    for (let day = 29; day >= 0; day--) {
      for (let sale = 0; sale < 2 + ((day * 7 + index) % 5); sale++) {
        if (
          await prisma.order.findUnique({
            where: { number: `DEMO-${business.slug}-${day}-${sale}` },
          })
        )
          continue;
        const v = variants[(day * 3 + sale * 5) % (variants.length - 3)]!;
        const c = customers[(day + sale) % customers.length]!;
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - day);
        date.setUTCHours(10 + sale, 15, 0, 0);
        const stock = await prisma.inventory.findUniqueOrThrow({
          where: {
            tenantId_variantId_storeId: {
              tenantId: tenant.id,
              variantId: v.id,
              storeId: store.id,
            },
          },
        });
        if (stock.onHand < 1) continue;
        await prisma.$transaction([
          prisma.order.create({
            data: {
              tenantId: tenant.id,
              storeId: store.id,
              customerId: c.id,
              customerName: c.name,
              number: `DEMO-${business.slug}-${day}-${sale}`,
              channel: sale % 3 ? "POS" : "ONLINE",
              status: "COMPLETED",
              paymentMethod: sale % 3 ? "CASH" : "CASH_ON_DELIVERY",
              total: v.price,
              createdAt: date,
              items: {
                create: {
                  variantId: v.id,
                  name: v.name,
                  sku: v.sku,
                  quantity: 1,
                  unitPrice: v.price,
                },
              },
            },
          }),
          prisma.inventory.update({
            where: { id: stock.id },
            data: { onHand: { decrement: 1 } },
          }),
          prisma.stockMovement.create({
            data: {
              tenantId: tenant.id,
              variantId: v.id,
              storeId: store.id,
              actorId: user.id,
              type: "SALE",
              quantity: -1,
              reason: "Fictional demonstration sale",
              createdAt: date,
            },
          }),
        ]);
      }
    }
    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorId: user.id,
        action: "DEMO_SEEDED",
        entityId: tenant.id,
        details: { fictional: true },
      },
    });
  }
  await prisma.user.upsert({
    where: {
      email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? "operator@innovia.local",
    },
    update: {},
    create: {
      name: "Platform operator",
      email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? "operator@innovia.local",
      role: "PLATFORM_ADMIN",
      passwordHash: await hashPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD),
    },
  });
  console.log(
    "Seed complete: three fictional boutiques. Passwords are read from .env and are never printed.",
  );
}
seed().finally(() => prisma.$disconnect());
