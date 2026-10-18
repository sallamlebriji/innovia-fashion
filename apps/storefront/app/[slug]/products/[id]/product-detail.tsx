"use client";
import { useState } from "react";
import type { Boutique, PublicProduct } from "../../storefront";
import { FittingRoom } from "../../fitting-room";
import { LiveAR } from "./live-ar";
export function ProductDetail({
  product,
  boutique,
}: {
  product: PublicProduct;
  boutique: Boutique;
}) {
  const [variantId, setVariantId] = useState(""),
    [mediaIndex, setMediaIndex] = useState(0),
    [zoom, setZoom] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [advice, setAdvice] = useState("");
  const media = [
    { url: product.imageUrl, alt: product.name, kind: "IMAGE" as const },
    ...(product.media ?? []),
  ].filter((asset) => asset.url);
  const active = media[mediaIndex],
    variant = product.variants.find((item) => item.id === variantId);
  const money = (value: string) =>
    new Intl.NumberFormat("en-MA", {
      style: "currency",
      currency: boutique.tenant.currency,
    }).format(Number(value));
  function add() {
    if (!variant) return;
    try {
      const key = `innovia.bag.${boutique.tenant.id}`,
        saved = JSON.parse(localStorage.getItem(key) ?? "[]");
      const lines: {
        product: PublicProduct;
        variant: PublicProduct["variants"][number];
        quantity: number;
      }[] = Array.isArray(saved) ? saved : [];
      const old = lines.find((item) => item.variant?.id === variant.id);
      if (old) old.quantity += 1;
      else lines.push({ product, variant, quantity: 1 });
      localStorage.setItem(key, JSON.stringify(lines));
      setNotice("Added to your bag.");
    } catch {
      setError(
        "Your browser could not save the bag. Enable local storage and try again.",
      );
    }
  }
  async function wishlist() {
    setPending(true);
    setError("");
    try {
      const base = `/api/v1/storefront/${encodeURIComponent(boutique.tenant.slug)}/customer`;
      const session = await fetch(`${base}/me`, {
        credentials: "include",
        cache: "no-store",
      });
      if (session.status === 401) {
        window.location.href = `/${boutique.tenant.slug}/account`;
        return;
      }
      const data = await session.json();
      if (!session.ok) throw new Error(data.error?.message);
      const response = await fetch(`${base}/wishlist`, {
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": data.csrfToken,
        },
        body: JSON.stringify({ productId: product.id }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message ?? "Please try again.");
      setNotice("Saved to your personal edit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="product-page">
      <header className="store-header">
        <a className="store-wordmark" href={`/${boutique.tenant.slug}`}>
          {boutique.tenant.name}
        </a>
        <nav>
          <a href={`/${boutique.tenant.slug}/account`}>Account</a>
          <a href={`/${boutique.tenant.slug}?bag=1`}>Your bag ↗</a>
        </nav>
      </header>
      <div className="product-page-layout">
        <section className="product-gallery">
          <button
            className={`product-main-image ${zoom ? "zoom" : ""}`}
            aria-label={zoom ? "Reduce image" : "Zoom image"}
            onClick={() => setZoom(!zoom)}
          >
            {active?.kind === "VIDEO"
              ? null
              : active && <img src={active.url} alt={active.alt} />}
          </button>
          {active?.kind === "VIDEO" && (
            <video
              controls
              playsInline
              src={active.url}
              aria-label={active.alt || product.name}
            />
          )}
          <div className="product-thumbnails">
            {media.map((asset, i) => (
              <button
                key={i}
                aria-label={`View ${asset.kind.toLowerCase()} ${i + 1}`}
                className={i === mediaIndex ? "active" : ""}
                onClick={() => {
                  setMediaIndex(i);
                  setZoom(false);
                }}
              >
                {asset.kind === "IMAGE" ? (
                  <img src={asset.url} alt={asset.alt} />
                ) : (
                  <span>▶ Video</span>
                )}
              </button>
            ))}
          </div>
        </section>
        <section className="product-page-copy">
          <span className="store-eyebrow">
            {product.brand} / {product.collection || product.category}
          </span>
          <h1>{product.name}</h1>
          <p className="detail-price">
            {money(variant?.price ?? product.variants[0]?.price ?? "0")}
          </p>
          <p>{product.description}</p>
          <label className="store-eyebrow">CHOOSE YOUR SIZE & COLOUR</label>
          <div className="store-sizes">
            {product.variants.map((item) => (
              <button
                key={item.id}
                className={variantId === item.id ? "active" : ""}
                disabled={
                  !item.availability.some((stock) => stock.available > 0)
                }
                onClick={() => setVariantId(item.id)}
              >
                {item.size}
                <small>{item.color}</small>
              </button>
            ))}
          </div>
          {variant && (
            <p className="detail-note">
              {variant.availability
                .filter((stock) => stock.available > 0)
                .map(
                  (stock) =>
                    `${boutique.stores.find((store) => store.id === stock.storeId)?.name ?? "Boutique"}: ${stock.available} available`,
                )
                .join(" · ")}
            </p>
          )}
          <button className="store-cta dark" disabled={!variant} onClick={add}>
            Add to bag +
          </button>
          <button
            className="account-text-button"
            disabled={pending}
            onClick={wishlist}
          >
            ♡ Save to your personal edit
          </button>
          {notice && (
            <p className="account-notice" role="status">
              {notice} <a href={`/${boutique.tenant.slug}?bag=1`}>View bag →</a>
            </p>
          )}
          {error && (
            <p className="store-error" role="alert">
              {error}
            </p>
          )}
          <details open>
            <summary>Details & care</summary>
            <p>{product.material && `Material: ${product.material}`}</p>
            <p>{product.fit && `Fit: ${product.fit}`}</p>
            <p>
              {product.care || "Contact your boutique for care instructions."}
            </p>
          </details>
          {product.tryOnEnabled && (
            <FittingRoom slug={boutique.tenant.slug} productId={product.id} />
          )}
          <LiveAR slug={boutique.tenant.slug} productId={product.id} />
          {!!product.sizeChart?.length && (
            <details>
              <summary>Size guide & advisor</summary>
              <p>
                Garment measurements and brand-provided foot lengths are in
                centimetres. Size equivalents apply to this product’s chart.
                Compare with a piece you own or your measured foot length; fit
                is not guaranteed.
              </p>
              <div className="size-guide-scroll">
                <table className="size-guide">
                  <thead>
                    <tr>
                      <th>Size</th>
                      <th>Chest</th>
                      <th>Waist</th>
                      <th>Length</th>
                      <th>Foot length</th>
                      <th>Size equivalents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.sizeChart.map((row, i) => (
                      <tr key={i}>
                        <td>{row.size}</td>
                        <td>{row.chest ?? "—"}</td>
                        <td>{row.waist ?? "—"}</td>
                        <td>{row.length ?? "—"}</td>
                        <td>{row.footLength ?? "—"}</td>
                        <td>{row.equivalentSizes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <form
                className="store-checkout"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget),
                    chest = Number(data.get("chest")),
                    waist = Number(data.get("waist")),
                    footLength = Number(data.get("footLength"));
                  try {
                    const response = await fetch(
                      `/api/v1/storefront/${encodeURIComponent(boutique.tenant.slug)}/products/${product.id}/size-advisor`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          ...(chest ? { chest } : {}),
                          ...(waist ? { waist } : {}),
                          ...(footLength ? { footLength } : {}),
                        }),
                      },
                    );
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error?.message);
                    setAdvice(
                      `${result.explanation}${result.alternative ? ` Alternative: ${result.alternative.size}.` : ""} ${result.basis}`,
                    );
                  } catch (err) {
                    setAdvice(
                      err instanceof Error ? err.message : "Please try again.",
                    );
                  }
                }}
              >
                <label>
                  Preferred garment chest (cm)
                  <input
                    name="chest"
                    type="number"
                    min="1"
                    max="300"
                    step="0.1"
                  />
                </label>
                <label>
                  Preferred garment waist (cm)
                  <input
                    name="waist"
                    type="number"
                    min="1"
                    max="300"
                    step="0.1"
                  />
                </label>
                {product.sizeChart.some(
                  (row) => row.footLength !== undefined,
                ) && (
                  <label>
                    Measured foot length (cm)
                    <input
                      name="footLength"
                      type="number"
                      min="1"
                      max="60"
                      step="0.1"
                    />
                  </label>
                )}
                <button className="account-text-button">
                  Compare measurements
                </button>
                {advice && <p role="status">{advice}</p>}
              </form>
            </details>
          )}
          <details>
            <summary>Delivery & returns</summary>
            <p>
              {boutique.settings?.deliveryPolicy ||
                "Reserve for boutique collection. Contact your boutique for arrangements."}
            </p>
            <p>
              {boutique.settings?.returnPolicy ||
                "Contact your boutique with your order number for a return or exchange."}
            </p>
            <p>
              Reservation duration:{" "}
              {boutique.settings?.reservationMinutes ?? 60} minutes.
            </p>
          </details>
        </section>
      </div>
    </main>
  );
}
