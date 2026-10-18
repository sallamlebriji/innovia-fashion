import { Tracking } from "./tracking";
export const metadata = {
  title: "Track your boutique order",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ number?: string; token?: string }>;
}) {
  const { slug } = await params,
    { number = "", token = "" } = await searchParams;
  return <Tracking slug={slug} number={number} token={token} />;
}
