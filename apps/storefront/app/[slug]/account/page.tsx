import { Account } from "./account";
export const metadata = {
  title: "Your boutique account",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let locale = "en";
  try {
    const base = process.env.STOREFRONT_API_URL ?? "http://127.0.0.1:4001";
    const response = await fetch(
      `${base}/api/v1/storefront/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    if (response.ok) locale = (await response.json()).tenant.locale;
  } catch {
    /* Account recovery remains reachable if boutique details are unavailable. */
  }
  return <Account slug={slug} locale={locale} />;
}
