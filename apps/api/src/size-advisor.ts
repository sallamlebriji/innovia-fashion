import express from "express";
import { apiRateLimit } from "./rate-limits.js";
import { rateStore } from "./infrastructure.js";
import { z } from "zod";
import { productEditSchema } from "@innovia/validation";
import { db } from "./db.js";
import { HttpError, requireFound } from "./errors.js";
export const measurements = z
  .object({
    chest: z.number().positive().max(300).optional(),
    waist: z.number().positive().max(300).optional(),
    length: z.number().positive().max(300).optional(),
    footLength: z.number().positive().max(60).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Enter at least one garment or foot measurement in cm.",
  );
type Chart = NonNullable<z.infer<typeof productEditSchema>["sizeChart"]>;
export function adviseSize(
  chart: Chart,
  input: z.infer<typeof measurements>,
  availableSizes: string[],
) {
  const fields = Object.keys(input) as (keyof typeof input)[];
  const footwear = input.footLength !== undefined;
  const ranked = chart
    .filter((row) => fields.every((field) => row[field] != null))
    .map((row) => ({
      size: row.size,
      score: fields.reduce(
        (sum, field) =>
          sum + Math.abs(row[field]! - input[field]!) / input[field]!,
        0,
      ),
      differences: Object.fromEntries(
        fields.map((field) => [
          field,
          Number((row[field]! - input[field]!).toFixed(1)),
        ]),
      ),
      available: availableSizes.includes(row.size),
      equivalentSizes: row.equivalentSizes ?? null,
    }))
    .sort((a, b) => a.score - b.score);
  if (!ranked.length)
    return {
      recommendation: null,
      alternative: null,
      explanation:
        "The boutique has not published all the measurements needed for this comparison.",
      basis:
        "Published garment measurements; no photo analysis or fit guarantee.",
    };
  return {
    recommendation: ranked[0],
    alternative: ranked[1] ?? null,
    explanation: `${ranked[0]!.size} has the closest published ${footwear ? "foot-length guidance" : "garment measurements"}. ${footwear ? "Compare the brand’s width and preferred-fit guidance before ordering." : "Positive differences mean the garment is larger than your reference piece."}`,
    basis: footwear
      ? "Brand-provided foot lengths and size equivalents in cm; size-system conversions are specific to this product. No universal conversion or exact fit is predicted."
      : "Relative differences from a garment you already own, in cm. Compare the guide and preferred fit; this does not predict exact body fit.",
  };
}
export function sizeAdvisorRouter() {
  const router = express.Router();
  router.post(
    "/storefront/:slug/products/:id/size-advisor",
    apiRateLimit({ windowMs: 60000, limit: 30, ...rateStore("size-advisor") }),
    async (req, res) => {
      const input = measurements.parse(req.body),
        tenant = requireFound(
          await db.tenant.findUnique({
            where: { slug: String(req.params.slug) },
            select: { id: true },
          }),
        );
      const product = requireFound(
        await db.product.findFirst({
          where: {
            id: String(req.params.id),
            tenantId: tenant.id,
            status: "ACTIVE",
          },
          include: {
            variants: { include: { inventory: { include: { store: true } } } },
          },
        }),
      );
      const parsed = productEditSchema.shape.sizeChart.safeParse(
        product.sizeChart,
      );
      if (!parsed.success || !parsed.data?.length)
        throw new HttpError(
          422,
          "SIZE_CHART",
          "The boutique has not published a garment size chart for this piece.",
        );
      res.json(
        adviseSize(
          parsed.data,
          input,
          product.variants
            .filter((v) =>
              v.inventory.some(
                (i) => i.store.kind === "STORE" && i.onHand > i.reserved,
              ),
            )
            .map((v) => v.size),
        ),
      );
    },
  );
  return router;
}
