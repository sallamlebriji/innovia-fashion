"use client";
import { useEffect, useState } from "react";
export function ShoppingPreferences({
  slug,
  csrf,
}: {
  slug: string;
  csrf: string;
}) {
  const [sizes, setSizes] = useState(""),
    [categories, setCategories] = useState(""),
    [storeId, setStoreId] = useState(""),
    [stores, setStores] = useState<{ id: string; name: string }[]>([]),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState(false);
  const base = `/api/v1/storefront/${encodeURIComponent(slug)}`;
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(base).then((r) => r.json()),
      fetch(`${base}/customer/me`).then((r) => r.json()),
    ])
      .then(([boutique, session]) => {
        if (!active) return;
        setStores(boutique.stores ?? []);
        const data = session.customer?.preferences;
        setSizes(data?.sizes?.join(", ") ?? "");
        setCategories(data?.categories?.join(", ") ?? "");
        setStoreId(data?.preferredStoreId ?? "");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [base]);
  return (
    <form
      className="store-checkout"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setNotice("");
        try {
          const response = await fetch(`${base}/customer/preferences`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrf,
            },
            body: JSON.stringify({
              sizes: sizes
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
              categories: categories
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
              preferredStoreId: storeId || null,
            }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error?.message);
          setNotice("Shopping preferences saved.");
        } catch (err) {
          setNotice(err instanceof Error ? err.message : "Please try again.");
        } finally {
          setPending(false);
        }
      }}
    >
      <h3>Your shopping preferences</h3>
      <label>
        Sizes (separate with commas)
        <input
          value={sizes}
          onChange={(e) => setSizes(e.target.value)}
          maxLength={200}
          placeholder="S, M, 38"
        />
      </label>
      <label>
        Categories (separate with commas)
        <input
          value={categories}
          onChange={(e) => setCategories(e.target.value)}
          maxLength={800}
          placeholder="Shirts, Dresses"
        />
      </label>
      <label>
        Preferred boutique
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          <option value="">No preference</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </label>
      <button className="account-text-button" disabled={pending}>
        Save preferences
      </button>
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
