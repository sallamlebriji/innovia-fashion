import { useWords } from "../words";
import { usePreferences } from "../state";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import {
  Plus,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Layers3,
} from "lucide-react";
import { Badge, Button, EmptyState } from "@innovia/ui";
import type { Movement, Product } from "@innovia/types";
import { useWorkspace } from "../App";
import {
  Loading,
  Modal,
  Notice,
  PageTitle,
  Pagination,
  Picture,
} from "../components";
export function Inventory() {
  const t = useWords();
  const locale = usePreferences((state) => state.locale);
  const { session, stores } = useWorkspace(),
    client = useQueryClient();
  const [tab, setTab] = useState("stock"),
    [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [adjust, setAdjust] = useState(false),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false);
  const products = useQuery({
    queryKey: ["products", "inventory", q, page],
    staleTime: 0,
    refetchInterval: 10000,
    queryFn: () =>
      request<{ items: Product[]; total: number }>(
        `/products?page=${page}&q=${encodeURIComponent(q)}`,
      ),
  });
  const movements = useQuery({
    queryKey: ["movements", page],
    queryFn: () =>
      request<{ items: Movement[]; total: number }>(
        `/inventory/movements?page=${page}`,
      ),
    enabled: tab === "movements",
  });
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      await mutate(
        "/inventory/adjustments",
        {
          variantId: form.get("variantId"),
          storeId: form.get("storeId"),
          quantity: Number(form.get("quantity")),
          reason: form.get("reason"),
        },
        "POST",
        crypto.randomUUID(),
      );
      await Promise.all([
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["movements"] }),
        client.invalidateQueries({ queryKey: ["analytics"] }),
      ]);
      setAdjust(false);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  function movementReason(movement: Movement) {
    if (
      movement.type === "OPENING" &&
      movement.reason === "Initial product stock"
    )
      return t(movement.reason);
    if (movement.type === "SALE" && movement.reason === "POS order")
      return t(movement.reason);
    if (movement.type === "RESERVATION" && movement.reason === "ONLINE order")
      return t(movement.reason);
    if (movement.type === "PURCHASE" && movement.reason.startsWith("Received "))
      return `${t("Received")} ${movement.reason.slice(9)}`;
    if (["COMPLETE", "CANCEL", "EXPIRE"].includes(movement.type)) {
      const action = movement.type.toLowerCase();
      if (movement.reason.startsWith(`${action} `))
        return `${t(`${action} order`)} ${movement.reason.slice(action.length + 1)}`;
    }
    return movement.reason;
  }
  return (
    <>
      <PageTitle
        title={t("The right pieces. In the right place.")}
        subtitle={t(
          "Know what’s available, what’s reserved, and what needs your attention.",
        )}
        eyebrow={t("INVENTORY")}
        action={
          session.user.role !== "CASHIER" && (
            <Button
              onClick={() => {
                setAdjust(true);
                setError(null);
              }}
            >
              <Plus size={16} />
              {t("Adjust stock")}
            </Button>
          )
        }
      />
      <div className="tabs">
        <button
          className={tab === "stock" ? "active" : ""}
          onClick={() => {
            setTab("stock");
            setPage(1);
          }}
        >
          {t("Stock by variant")}
        </button>
        <button
          className={tab === "movements" ? "active" : ""}
          onClick={() => {
            setTab("movements");
            setPage(1);
          }}
        >
          {t("Movement ledger")}
        </button>
      </div>
      <section className="panel">
        <div className="filterbar">
          <Layers3 size={17} />
          <strong>
            {t(
              tab === "stock"
                ? "Your stock, at a glance"
                : "Every movement, accounted for",
            )}
          </strong>
          {tab === "stock" && (
            <div className="filter-search push-end">
              <Search size={15} />
              <input
                aria-label={t("Search inventory")}
                placeholder={t("Find a product or SKU")}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          )}
        </div>
        <Notice error={tab === "stock" ? products.error : movements.error} />
        {(tab === "stock" ? products.isPending : movements.isPending) ? (
          <Loading />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {tab === "stock" ? (
                    <>
                      <th>{t("Product / variant")}</th>
                      <th>{t("Location")}</th>
                      <th>{t("On hand")}</th>
                      <th>{t("Reserved")}</th>
                      <th>{t("Available")}</th>
                      <th>{t("Status")}</th>
                    </>
                  ) : (
                    <>
                      <th>{t("Product / SKU")}</th>
                      <th>{t("Movement")}</th>
                      <th>{t("Quantity")}</th>
                      <th>{t("Location")}</th>
                      <th>{t("Reason")}</th>
                      <th>{t("Date")}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {tab === "stock"
                  ? products.data?.items.flatMap((p) =>
                      p.variants.flatMap((v) =>
                        v.inventory.map((i) => (
                          <tr key={i.id}>
                            <td>
                              <div className="product-cell">
                                <Picture src={p.imageUrl} alt={p.name} />
                                <span>
                                  <strong>{p.name}</strong>
                                  <small>
                                    {v.sku} · {v.color} / {v.size}
                                  </small>
                                </span>
                              </div>
                            </td>
                            <td>{i.store.name}</td>
                            <td>{i.onHand}</td>
                            <td>{i.reserved}</td>
                            <td>
                              <strong>{i.onHand - i.reserved}</strong>
                            </td>
                            <td>
                              <Badge
                                tone={
                                  i.onHand - i.reserved <= i.reorderPoint
                                    ? "gold"
                                    : "green"
                                }
                              >
                                {t(
                                  i.onHand - i.reserved <= i.reorderPoint
                                    ? "Low stock"
                                    : "Healthy",
                                )}
                              </Badge>
                            </td>
                          </tr>
                        )),
                      ),
                    )
                  : movements.data?.items.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.variant.product.name}</strong>
                          <small>{m.variant.sku}</small>
                        </td>
                        <td>
                          <Badge tone={m.quantity > 0 ? "green" : "neutral"}>
                            {m.quantity > 0 ? (
                              <ArrowDownLeft size={12} />
                            ) : (
                              <ArrowUpRight size={12} />
                            )}{" "}
                            {t(m.type.toLowerCase())}
                          </Badge>
                        </td>
                        <td>
                          {m.quantity > 0 ? "+" : ""}
                          {m.quantity}
                        </td>
                        <td>{m.store.name}</td>
                        <td>{movementReason(m)}</td>
                        <td>
                          {new Date(m.createdAt).toLocaleDateString(
                            `${locale}-MA`,
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {(tab === "stock"
              ? products.data?.total
              : movements.data?.total) === 0 && (
              <EmptyState title={t("A clean slate.")}>
                {t("Create products to start tracking stock.")}
              </EmptyState>
            )}
          </div>
        )}
        <Pagination
          page={page}
          total={
            (tab === "stock" ? products.data?.total : movements.data?.total) ??
            0
          }
          onChange={setPage}
        />
      </section>
      {adjust && (
        <Modal
          title={t("Give your inventory a fresh balance.")}
          onClose={() => setAdjust(false)}
        >
          <form className="modal-body" onSubmit={submit}>
            <label>
              {t("Product variant")}
              <select
                required
                name="variantId"
                aria-label={t("Product variant")}
              >
                <option value="">{t("Select a variant from this page")}</option>
                {products.data?.items.flatMap((p) =>
                  p.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {p.name} · {v.color} / {v.size} · {v.sku}
                    </option>
                  )),
                )}
              </select>
            </label>
            <label>
              {t("Location")}
              <select name="storeId">
                {stores.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Quantity adjustment")}
              <input
                name="quantity"
                aria-label={t("Quantity adjustment")}
                type="number"
                required
                placeholder={t("10 to receive, -2 to remove")}
              />
              <small>
                {t("Positive units add stock. Negative units remove stock.")}
              </small>
            </label>
            <label>
              {t("Reason")}
              <textarea
                name="reason"
                minLength={3}
                required
                placeholder={t("Supplier delivery, count correction…")}
              />
            </label>
            <Notice error={error} />
            <Button disabled={pending} type="submit">
              {t(pending ? "Saving…" : "Save adjustment")}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
