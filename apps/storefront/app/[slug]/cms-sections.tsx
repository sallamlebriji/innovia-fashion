"use client";
import { useEffect, useState } from "react";
import type { z } from "zod";
import type { cmsPageSchema, cmsSectionSchema } from "@innovia/validation";
import { request } from "@innovia/api-client";
import type { Boutique, PublicProduct } from "./storefront";

export function CMSSections({
  boutique,
  content,
  onProduct,
}: {
  boutique: Boutique;
  content: z.infer<typeof cmsPageSchema>;
  onProduct: (product: PublicProduct) => void;
}) {
  return (
    <div className="cms-sections">
      {content.sections.map((s, i) => (
        <section
          key={i}
          className={`cms-section cms-${s.kind.toLowerCase()}`}
          id={s.kind === "BRAND_STORY" ? "our-world" : `campaign-${i}`}
        >
          {s.kind === "HERO" ? (
            <>
              <div className="cms-hero-media">
                {s.imageUrl && (
                  <img
                    src={s.imageUrl}
                    alt={s.title}
                    fetchPriority={i === 0 ? "high" : "auto"}
                  />
                )}
              </div>
              <div className="cms-hero-copy">
                <span className="store-eyebrow">{boutique.tenant.name}</span>
                <h1>{s.title}</h1>
                <p>{s.body}</p>
                <a className="store-cta" href={s.ctaHref || "#collection"}>
                  {s.ctaLabel || "Discover the collection"} ↗
                </a>
              </div>
            </>
          ) : (
            <>
              {s.kind === "VIDEO" && s.imageUrl ? (
                <video
                  controls
                  playsInline
                  preload="metadata"
                  src={s.imageUrl}
                  aria-label={s.title}
                />
              ) : s.kind === "EDITORIAL" && s.imageUrl ? (
                <img src={s.imageUrl} alt={s.title} loading="lazy" />
              ) : null}
              <div className="cms-copy">
                <span className="store-eyebrow">{boutique.tenant.name}</span>
                <h2>{s.title}</h2>
                <p>{s.body}</p>
                {s.ctaLabel && s.kind !== "NEWSLETTER" && (
                  <a href={s.ctaHref || "#collection"}>{s.ctaLabel} →</a>
                )}
                {s.kind === "NEWSLETTER" && (
                  <a
                    className="store-cta dark"
                    href={`/${boutique.tenant.slug}/account`}
                  >
                    Join our community →
                  </a>
                )}
              </div>
              {s.kind === "FEATURED_COLLECTION" && (
                <FeaturedCollection
                  section={s}
                  slug={boutique.tenant.slug}
                  currency={boutique.tenant.currency}
                  onProduct={onProduct}
                />
              )}
            </>
          )}
        </section>
      ))}
    </div>
  );
}
function FeaturedCollection({
  section,
  slug,
  currency,
  onProduct,
}: {
  section: z.infer<typeof cmsSectionSchema>;
  slug: string;
  currency: string;
  onProduct: (product: PublicProduct) => void;
}) {
  const [products, setProducts] = useState<PublicProduct[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    request<{ items: PublicProduct[] }>(
      `/storefront/${slug}/products?${new URLSearchParams({ collection: section.collection, limit: "8" })}`,
      { signal: controller.signal },
    )
      .then((r) => setProducts(r.items))
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [slug, section.collection]);
  return (
    <>
      <p role="status">{error}</p>
      <div className="cms-product-row">
        {products.map((p) => (
          <button
            onClick={() => onProduct(p)}
            key={p.id}
            className="cms-product"
          >
            <div>
              {p.imageUrl && (
                <img src={p.imageUrl} alt={p.name} loading="lazy" />
              )}
            </div>
            <strong>{p.name}</strong>
            <span>
              {new Intl.NumberFormat("en-MA", {
                style: "currency",
                currency,
              }).format(Number(p.variants[0]?.price ?? 0))}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
