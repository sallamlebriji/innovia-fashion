import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Boutique, PublicProduct } from "../../storefront";
import { ProductDetail } from "./product-detail";
const base = () => process.env.STOREFRONT_API_URL ?? "http://127.0.0.1:4001";
async function getProduct(slug: string, id: string) {
  const response = await fetch(
    `${base()}/api/v1/storefront/${encodeURIComponent(slug)}/products/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("The boutique is temporarily unavailable.");
  return (await response.json()) as PublicProduct;
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params,
    product = await getProduct(slug, id);
  return {
    title: `${product.name} — ${product.brand}`,
    description: product.description.slice(0, 160),
    openGraph: { images: product.imageUrl ? [product.imageUrl] : [] },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const [product, response] = await Promise.all([
    getProduct(slug, id),
    fetch(`${base()}/api/v1/storefront/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    }),
  ]);
  if (!response.ok) throw new Error("The boutique is temporarily unavailable.");
  const boutique: Boutique = await response.json();
  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.imageUrl || undefined,
    brand: { "@type": "Brand", name: product.brand || boutique.tenant.name },
    offers: product.variants.map((variant) => ({
      "@type": "Offer",
      price: variant.price,
      priceCurrency: boutique.tenant.currency,
      availability: variant.availability.some((stock) => stock.available > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    })),
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />
      <ProductDetail product={product} boutique={boutique} />
    </>
  );
}
