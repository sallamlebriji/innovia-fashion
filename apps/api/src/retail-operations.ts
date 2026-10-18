import express from "express";
import { validateManagedMedia } from "./media.js";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  productSchema,
  productEditSchema,
  variantEditSchema,
  productMediaSchema,
  transferSchema,
  stockCountSchema,
  supplierSchema,
  purchaseSchema,
} from "@innovia/validation";
import { db } from "./db.js";
import { auth, tenantRequired, permit } from "./auth.js";
import { HttpError, requireFound } from "./errors.js";
import {
  command,
  audit,
  lockTenant,
  createProductInTransaction,
  productInclude,
  type Actor,
} from "./retail.js";

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});
const manager = permit("OWNER", "MANAGER");
const purchaseInclude = {
  supplier: true,
  store: true,
  items: { include: { variant: { include: { product: true } } } },
} as const;

export function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (c === '"' && cell === "" && !closed) quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
      closed = false;
    } else if (closed || c === '"')
      throw new HttpError(422, "CSV_FORMAT", "Malformed quoted CSV cell.");
    else cell += c;
  }
  if (quoted)
    throw new HttpError(422, "CSV_FORMAT", "CSV has an unclosed quote.");
  row.push(cell);
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}

export async function transferStock(
  actor: Actor,
  input: z.infer<typeof transferSchema>,
  key?: string,
) {
  return command(actor, key, { type: "transfer", ...input }, async (tx) => {
    requireFound(
      await tx.productVariant.findFirst({
        where: { id: input.variantId, tenantId: actor.tenantId },
      }),
    );
    for (const id of [input.fromStoreId, input.toStoreId])
      requireFound(
        await tx.store.findFirst({ where: { id, tenantId: actor.tenantId } }),
      );
    if (input.fromStoreId === input.toStoreId)
      throw new HttpError(
        422,
        "INVALID_TRANSFER",
        "Choose different locations.",
      );
    const identity = (storeId: string) => ({
      tenantId: actor.tenantId,
      variantId: input.variantId,
      storeId,
    });
    const source = requireFound(
      await tx.inventory.findUnique({
        where: { tenantId_variantId_storeId: identity(input.fromStoreId) },
      }),
    );
    if (source.onHand - source.reserved < input.quantity)
      throw new HttpError(
        409,
        "INSUFFICIENT_STOCK",
        "Reserved stock cannot be transferred.",
      );
    await tx.inventory.update({
      where: { id: source.id },
      data: { onHand: { decrement: input.quantity } },
    });
    await tx.inventory.upsert({
      where: { tenantId_variantId_storeId: identity(input.toStoreId) },
      create: { ...identity(input.toStoreId), onHand: input.quantity },
      update: { onHand: { increment: input.quantity } },
    });
    const transfer = await tx.stockTransfer.create({
      data: { ...input, tenantId: actor.tenantId, actorId: actor.id },
      include: { fromStore: true, toStore: true, variant: true },
    });
    await tx.stockMovement.createMany({
      data: [
        {
          tenantId: actor.tenantId,
          actorId: actor.id,
          variantId: input.variantId,
          storeId: input.fromStoreId,
          type: "TRANSFER_OUT",
          quantity: -input.quantity,
          reason: `${transfer.id}: ${input.reason}`,
        },
        {
          tenantId: actor.tenantId,
          actorId: actor.id,
          variantId: input.variantId,
          storeId: input.toStoreId,
          type: "TRANSFER_IN",
          quantity: input.quantity,
          reason: `${transfer.id}: ${input.reason}`,
        },
      ],
    });
    await audit(tx, actor, "STOCK_TRANSFERRED", transfer.id, input);
    return transfer;
  });
}
export async function countStock(
  actor: Actor,
  input: z.infer<typeof stockCountSchema>,
  key?: string,
) {
  return command(actor, key, { type: "stock-count", ...input }, async (tx) => {
    requireFound(
      await tx.store.findFirst({
        where: { id: input.storeId, tenantId: actor.tenantId },
      }),
    );
    requireFound(
      await tx.productVariant.findFirst({
        where: { id: input.variantId, tenantId: actor.tenantId },
      }),
    );
    const identity = {
      tenantId: actor.tenantId,
      storeId: input.storeId,
      variantId: input.variantId,
    };
    const stock = await tx.inventory.upsert({
      where: { tenantId_variantId_storeId: identity },
      create: identity,
      update: {},
    });
    if (input.counted < stock.reserved)
      throw new HttpError(
        409,
        "RESERVED_STOCK",
        "Count cannot be less than reserved units. Resolve reservations first.",
      );
    const difference = input.counted - stock.onHand;
    await tx.inventory.update({
      where: { id: stock.id },
      data: { onHand: input.counted },
    });
    const count = await tx.stockCount.create({
      data: {
        ...input,
        tenantId: actor.tenantId,
        actorId: actor.id,
        previous: stock.onHand,
        difference,
      },
    });
    if (difference)
      await tx.stockMovement.create({
        data: {
          ...identity,
          actorId: actor.id,
          type: "COUNT",
          quantity: difference,
          reason: input.reason,
        },
      });
    await audit(tx, actor, "STOCK_COUNTED", count.id, {
      ...input,
      previous: stock.onHand,
      difference,
    });
    return count;
  });
}
export async function createPurchase(
  actor: Actor,
  input: z.infer<typeof purchaseSchema>,
  key?: string,
) {
  return command(
    actor,
    key,
    { type: "purchase-create", ...input },
    async (tx) => {
      const tenant = requireFound(
        await tx.tenant.findUnique({ where: { id: actor.tenantId } }),
      );
      requireFound(
        await tx.supplier.findFirst({
          where: {
            tenantId: actor.tenantId,
            id: input.supplierId,
            active: true,
          },
        }),
      );
      requireFound(
        await tx.store.findFirst({
          where: { tenantId: actor.tenantId, id: input.storeId },
        }),
      );
      let total = new Prisma.Decimal(0);
      for (const item of input.items) {
        requireFound(
          await tx.productVariant.findFirst({
            where: { tenantId: actor.tenantId, id: item.variantId },
          }),
        );
        total = total.plus(
          new Prisma.Decimal(item.unitCost).mul(item.quantity),
        );
      }
      if (total.gt("9999999999.99"))
        throw new HttpError(
          422,
          "PURCHASE_LIMIT",
          "Purchase total exceeds the supported amount.",
        );
      const { items, ...data } = input;
      const purchase = await tx.purchaseOrder.create({
        data: {
          ...data,
          tenantId: actor.tenantId,
          number: `PO-${randomUUID().slice(0, 12).toUpperCase()}`,
          total,
          currency: tenant.currency,
          items: { create: items },
        },
        include: purchaseInclude,
      });
      await audit(tx, actor, "PURCHASE_CREATED", purchase.id, {
        total: total.toString(),
      });
      return purchase;
    },
  );
}
export async function transitionPurchase(
  actor: Actor,
  id: string,
  action: "receive" | "cancel",
  key?: string,
) {
  return command(
    actor,
    key,
    { type: "purchase-transition", id, action },
    async (tx) => {
      const purchase = requireFound(
        await tx.purchaseOrder.findFirst({
          where: { id, tenantId: actor.tenantId },
          include: { items: true },
        }),
      );
      if (purchase.status !== "DRAFT")
        throw new HttpError(
          409,
          "INVALID_TRANSITION",
          "This purchase has already been received or cancelled.",
        );
      if (action === "receive")
        for (const item of purchase.items) {
          const identity = {
            tenantId: actor.tenantId,
            variantId: item.variantId,
            storeId: purchase.storeId,
          };
          await tx.inventory.upsert({
            where: { tenantId_variantId_storeId: identity },
            create: { ...identity, onHand: item.quantity },
            update: { onHand: { increment: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              ...identity,
              actorId: actor.id,
              quantity: item.quantity,
              type: "PURCHASE",
              reason: `Received ${purchase.number}`,
            },
          });
        }
      const result = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: action === "receive" ? "RECEIVED" : "CANCELLED",
          receivedAt: action === "receive" ? new Date() : null,
        },
        include: purchaseInclude,
      });
      await audit(tx, actor, `PURCHASE_${action.toUpperCase()}`, id, {
        number: purchase.number,
      });
      return result;
    },
  );
}

export function retailOperationsRouter() {
  const router = express.Router();
  router.use(
    [
      "/inventory/transfers",
      "/inventory/counts",
      "/suppliers",
      "/purchases",
      "/catalog",
      "/variants",
      "/products/:id/media",
    ],
    auth,
    tenantRequired,
  );
  router.get("/inventory/transfers", async (req, res) => {
    const { page, limit } = pageSchema.parse(req.query),
      where = { tenantId: res.locals.actor.tenantId };
    const [items, total] = await Promise.all([
      db.stockTransfer.findMany({
        where,
        include: { variant: true, fromStore: true, toStore: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.stockTransfer.count({ where }),
    ]);
    res.json({ items, total });
  });
  router.post("/inventory/transfers", manager, async (req, res) =>
    res
      .status(201)
      .json(
        await transferStock(
          res.locals.actor,
          transferSchema.parse(req.body),
          req.get("Idempotency-Key"),
        ),
      ),
  );
  router.get("/inventory/counts", async (req, res) => {
    const { page, limit } = pageSchema.parse(req.query),
      where = { tenantId: res.locals.actor.tenantId };
    const [items, total] = await Promise.all([
      db.stockCount.findMany({
        where,
        include: { variant: true, store: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.stockCount.count({ where }),
    ]);
    res.json({ items, total });
  });
  router.post("/inventory/counts", manager, async (req, res) =>
    res
      .status(201)
      .json(
        await countStock(
          res.locals.actor,
          stockCountSchema.parse(req.body),
          req.get("Idempotency-Key"),
        ),
      ),
  );
  router.get("/suppliers", async (req, res) => {
    const { page, limit } = pageSchema.parse(req.query),
      where = { tenantId: res.locals.actor.tenantId };
    const [items, total] = await Promise.all([
      db.supplier.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.supplier.count({ where }),
    ]);
    res.json({ items, total });
  });
  router.post("/suppliers", manager, async (req, res) => {
    const actor: Actor = res.locals.actor,
      data = supplierSchema.parse(req.body);
    const result = await db.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: { ...data, tenantId: actor.tenantId },
      });
      await audit(tx, actor, "SUPPLIER_CREATED", supplier.id, {
        name: supplier.name,
      });
      return supplier;
    });
    res.status(201).json(result);
  });
  router.patch("/suppliers/:id", manager, async (req, res) => {
    const actor: Actor = res.locals.actor,
      data = supplierSchema.partial().strict().parse(req.body);
    const result = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const supplier = requireFound(
        await tx.supplier.findFirst({
          where: { tenantId: actor.tenantId, id: String(req.params.id) },
        }),
      );
      const updated = await tx.supplier.update({
        where: { id: supplier.id },
        data,
      });
      await audit(tx, actor, "SUPPLIER_UPDATED", supplier.id, data);
      return updated;
    });
    res.json(result);
  });
  router.get("/purchases", async (req, res) => {
    const { page, limit } = pageSchema.parse(req.query),
      where = { tenantId: res.locals.actor.tenantId };
    const [items, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where,
        include: purchaseInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.purchaseOrder.count({ where }),
    ]);
    res.json({ items, total });
  });
  router.post("/purchases", manager, async (req, res) =>
    res
      .status(201)
      .json(
        await createPurchase(
          res.locals.actor,
          purchaseSchema.parse(req.body),
          req.get("Idempotency-Key"),
        ),
      ),
  );
  router.post("/purchases/:id/:action", manager, async (req, res) =>
    res.json(
      await transitionPurchase(
        res.locals.actor,
        String(req.params.id),
        z.enum(["receive", "cancel"]).parse(req.params.action),
        req.get("Idempotency-Key"),
      ),
    ),
  );
  router.patch("/variants/:id", manager, async (req, res) => {
    const actor: Actor = res.locals.actor,
      data = variantEditSchema.parse(req.body);
    const result = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const variant = requireFound(
        await tx.productVariant.findFirst({
          where: { tenantId: actor.tenantId, id: String(req.params.id) },
        }),
      );
      const updated = await tx.productVariant.update({
        where: { id: variant.id },
        data,
      });
      await audit(tx, actor, "VARIANT_UPDATED", variant.id, data);
      return updated;
    });
    res.json(result);
  });
  router.post("/catalog/prices", manager, async (req, res) => {
    const input = z
      .object({
        items: z
          .array(
            variantEditSchema
              .pick({ price: true })
              .required()
              .extend({ variantId: z.string().min(1) }),
          )
          .min(1)
          .max(100),
      })
      .strict()
      .parse(req.body);
    if (
      new Set(input.items.map((item) => item.variantId)).size !==
      input.items.length
    )
      throw new HttpError(
        422,
        "DUPLICATE_VARIANT",
        "Include each variant once.",
      );
    const actor: Actor = res.locals.actor;
    res.json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { type: "bulk-prices", ...input },
        async (tx) => {
          const variants = await tx.productVariant.findMany({
            where: {
              tenantId: actor.tenantId,
              id: { in: input.items.map((item) => item.variantId) },
            },
            select: { id: true },
          });
          if (variants.length !== input.items.length)
            throw new HttpError(
              404,
              "NOT_FOUND",
              "A variant was not found in your catalog.",
            );
          for (const item of input.items)
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { price: item.price },
            });
          await audit(tx, actor, "BULK_PRICES_UPDATED", actor.tenantId, input);
          return { updated: variants.length };
        },
      ),
    );
  });
  router.post("/catalog/duplicate", manager, async (req, res) => {
    const input = z
        .object({
          sourceId: z.string().min(1),
          storeId: z.string().min(1),
          name: z.string().min(2).max(150),
        })
        .strict()
        .parse(req.body),
      actor: Actor = res.locals.actor;
    res.status(201).json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { type: "product-duplicate", ...input },
        async (tx) => {
          const source = requireFound(
            await tx.product.findFirst({
              where: { id: input.sourceId, tenantId: actor.tenantId },
              include: productInclude,
            }),
          );
          const copy = await createProductInTransaction(
            tx,
            actor,
            productSchema.parse({
              ...source,
              name: input.name,
              status: "DRAFT",
              storeId: input.storeId,
              variants: source.variants.map((variant) => ({
                sku: `${variant.sku.slice(0, 65)}-C${randomUUID().slice(0, 8)}`,
                size: variant.size,
                color: variant.color,
                price: variant.price.toFixed(2),
                cost: variant.cost.toFixed(2),
                quantity: 0,
                reorderPoint: 5,
              })),
            }),
          );
          await tx.product.update({
            where: { id: copy.id },
            data: {
              season: source.season,
              audience: source.audience,
              material: source.material,
              fit: source.fit,
              care: source.care,
              sizeChart: source.sizeChart ?? Prisma.JsonNull,
            },
          });
          if (source.media.length)
            await tx.productMedia.createMany({
              data: source.media.map(({ url, kind, alt, position }) => ({
                tenantId: actor.tenantId,
                productId: copy.id,
                url,
                kind,
                alt,
                position,
              })),
            });
          await audit(tx, actor, "PRODUCT_DUPLICATED", copy.id, {
            sourceId: source.id,
          });
          return tx.product.findUniqueOrThrow({
            where: { id: copy.id },
            include: productInclude,
          });
        },
      ),
    );
  });
  router.put("/products/:id/media", manager, async (req, res) => {
    const actor: Actor = res.locals.actor,
      { items } = productMediaSchema.parse(req.body);
    const result = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      await validateManagedMedia(
        tx,
        actor.tenantId,
        items.map((item) => item.url),
      );
      const product = requireFound(
        await tx.product.findFirst({
          where: { tenantId: actor.tenantId, id: String(req.params.id) },
        }),
      );
      await tx.productMedia.deleteMany({
        where: { tenantId: actor.tenantId, productId: product.id },
      });
      if (items.length)
        await tx.productMedia.createMany({
          data: items.map((item, position) => ({
            ...item,
            position,
            tenantId: actor.tenantId,
            productId: product.id,
          })),
        });
      await audit(tx, actor, "PRODUCT_MEDIA_UPDATED", product.id, {
        count: items.length,
      });
      return tx.product.findUniqueOrThrow({
        where: { id: product.id },
        include: productInclude,
      });
    });
    res.json(result);
  });
  router.post("/catalog/import", manager, async (req, res) => {
    const actor: Actor = res.locals.actor;
    const input = z
      .object({
        csv: z.string().min(1).max(100000),
        storeId: z.string().min(1),
        preview: z.boolean().default(true),
      })
      .parse(req.body);
    const rows = parseCsv(input.csv.replace(/^\uFEFF/, "")),
      headers = rows.shift()?.map((v) => v.trim()) ?? [];
    const required = [
      "name",
      "category",
      "sku",
      "size",
      "color",
      "price",
      "cost",
      "quantity",
    ];
    if (
      required.some((k) => !headers.includes(k)) ||
      new Set(headers).size !== headers.length ||
      rows.length === 0 ||
      rows.length > 100
    )
      throw new HttpError(
        422,
        "CSV_HEADERS",
        "CSV requires name, category, sku, size, color, price, cost, quantity and 1–100 data rows.",
      );
    const errors: { row: number; message: string }[] = [],
      groups = new Map<string, z.infer<typeof productSchema>>(),
      skus = new Set<string>();
    rows.forEach((cells, i) => {
      if (cells.length !== headers.length) {
        errors.push({
          row: i + 2,
          message: "Column count differs from the header.",
        });
        return;
      }
      const record = Object.fromEntries(
        headers.map((h, j) => [h, (cells[j] ?? "").trim()]),
      );
      const result = productSchema.safeParse({
        ...record,
        storeId: input.storeId,
        variants: [
          {
            ...record,
            quantity: record.quantity === "" ? NaN : Number(record.quantity),
            reorderPoint: record.reorderPoint ? Number(record.reorderPoint) : 5,
          },
        ],
      });
      if (!result.success) {
        errors.push({
          row: i + 2,
          message: result.error.issues.map((v) => v.message).join("; "),
        });
        return;
      }
      const variant = result.data.variants[0]!;
      if (skus.has(variant.sku)) {
        errors.push({
          row: i + 2,
          message: "SKU occurs more than once in this import.",
        });
        return;
      }
      skus.add(variant.sku);
      const prior = groups.get(result.data.name);
      if (prior) {
        if (
          [
            "category",
            "brand",
            "collection",
            "description",
            "imageUrl",
            "status",
          ].some(
            (k) =>
              prior[k as keyof typeof prior] !==
              result.data[k as keyof typeof prior],
          )
        ) {
          errors.push({
            row: i + 2,
            message:
              "Rows for the same product must have matching product details.",
          });
          return;
        }
        prior.variants.push(variant);
      } else groups.set(result.data.name, result.data);
    });
    const report = {
      rows: rows.length,
      products: groups.size,
      variants: skus.size,
      errors,
    };
    const result = await db.$transaction(
      async (tx) => {
        await lockTenant(tx, actor.tenantId);
        requireFound(
          await tx.store.findFirst({
            where: { id: input.storeId, tenantId: actor.tenantId },
          }),
        );
        const existing = await tx.productVariant.findMany({
          where: { tenantId: actor.tenantId, sku: { in: [...skus] } },
          select: { sku: true },
        });
        for (const item of existing)
          report.errors.push({
            row:
              rows.findIndex(
                (c) => c[headers.indexOf("sku")]?.trim() === item.sku,
              ) + 2,
            message: `SKU ${item.sku} already exists.`,
          });
        const tenant = requireFound(
          await tx.tenant.findUnique({
            where: { id: actor.tenantId },
            include: { plan: true },
          }),
        );
        if (
          (await tx.product.count({ where: { tenantId: actor.tenantId } })) +
            groups.size >
          tenant.plan.productLimit
        )
          report.errors.push({
            row: 0,
            message: "This import exceeds the subscription product limit.",
          });
        if (input.preview || report.errors.length)
          return { ...report, imported: false };
        for (const product of groups.values())
          await createProductInTransaction(tx, actor, product);
        await audit(tx, actor, "CATALOG_IMPORTED", actor.tenantId, {
          products: groups.size,
          variants: skus.size,
        });
        return { ...report, imported: true };
      },
      { timeout: 60000 },
    );
    res.json(result);
  });
  return router;
}

export { productEditSchema };
