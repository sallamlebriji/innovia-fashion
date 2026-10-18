import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Storefront, type Boutique, type PublicProduct } from "./storefront";
const base = () => process.env.STOREFRONT_API_URL ?? "http://127.0.0.1:4001";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const response = await fetch(
      `${base()}/api/v1/storefront/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return {};
    const data: Boutique = await response.json();
    return {
      title:
        data.content?.seoTitle ||
        `${data.tenant.name} — A considered collection.`,
      description: data.content?.seoDescription || data.tenant.heroSubtitle,
      icons: data.content?.design.faviconUrl
        ? { icon: data.content.design.faviconUrl }
        : undefined,
    };
  } catch {
    return { title: "Boutique unavailable" };
  }
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  try {
    const response = await fetch(
      `${base()}/api/v1/storefront/${encodeURIComponent(slug)}${preview ? `?preview=${encodeURIComponent(preview)}` : ""}`,
      { cache: "no-store" },
    );
    if (response.status === 404) notFound();
    if (!response.ok) throw new Error("Unavailable");
    const boutique: Boutique = await response.json();
    const products = await fetch(
      `${base()}/api/v1/storefront/${encodeURIComponent(slug)}/products`,
      { cache: "no-store" },
    );
    if (!products.ok) throw new Error("Unavailable");
    const catalog: { items: PublicProduct[]; total: number } =
      await products.json();
    return <Storefront boutique={boutique} initial={catalog} />;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "NEXT_HTTP_ERROR_FALLBACK;404"
    )
      throw error;
    return (
      <main className="store-unavailable">
        <span className="store-wordmark">INNOVIA</span>
        <h1>A brief pause.</h1>
        <p>
          This boutique is temporarily unavailable. Please try again shortly.
        </p>
        <a href={`/${encodeURIComponent(slug)}`}>Try again →</a>
      </main>
    );
  }
}
