"use client";
import { useCallback, useEffect, useState } from "react";
type Order = {
  number: string;
  status: string;
  total: string;
  currency: string;
  deliveryStatus: string;
  carrier: string;
  trackingNumber: string;
  items: { name: string; sku: string; quantity: number }[];
};
export function Tracking({
  slug,
  number,
  token,
}: {
  slug: string;
  number: string;
  token: string;
}) {
  const [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/storefront/${encodeURIComponent(slug)}/tracking?${new URLSearchParams({ number, token })}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error?.message ?? "This private tracking link is unavailable.",
        );
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }, [slug, number, token]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <main className="account-shell">
      <a href={`/${slug}`} className="store-wordmark">
        ← Back to the boutique
      </a>
      <div className="account-heading">
        <span className="store-eyebrow">YOUR ORDER</span>
        <h1>{order?.number ?? "Your next favourite."}</h1>
        <p>Keep this private link to follow your order.</p>
      </div>
      {error && (
        <p className="store-error" role="alert">
          {error}
        </p>
      )}
      {order && (
        <article className="account-order">
          <h2>{order.deliveryStatus.replaceAll("_", " ")}</h2>
          <p>{order.status.replaceAll("_", " ")}</p>
          {order.items.map((line) => (
            <p key={line.sku}>
              {line.name} · {line.sku} × {line.quantity}
            </p>
          ))}
          <strong>
            {new Intl.NumberFormat("en-MA", {
              style: "currency",
              currency: order.currency,
            }).format(Number(order.total))}
          </strong>
          {order.carrier && (
            <p>
              {order.carrier}: {order.trackingNumber}
            </p>
          )}
          <p>
            For delivery arrangements or returns, contact your boutique with
            this order number.
          </p>
        </article>
      )}
      <button className="store-cta dark" disabled={pending} onClick={load}>
        {pending ? "Checking…" : "Refresh status"}
      </button>
    </main>
  );
}
