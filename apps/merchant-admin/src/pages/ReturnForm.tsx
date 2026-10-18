import { useCommerceWords as useWords } from "../commerce-words";
import { usePreferences } from "../state";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import type { Product, Order } from "@innovia/types";
import { Button, Money, Badge } from "@innovia/ui";
import { Modal, Notice } from "../components";

export function ReturnForm({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const t = useWords();
  const locale = usePreferences((state) => state.locale);
  const client = useQueryClient();
  const [quantities, setQuantities] = useState<Record<string, number>>({}),
    [restock, setRestock] = useState<Record<string, boolean>>({}),
    [exchange, setExchange] = useState(false),
    [replacement, setReplacement] = useState(""),
    [replacementQuantity, setReplacementQuantity] = useState(1),
    [search, setSearch] = useState(""),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false),
    [record, setRecord] = useState<{
      total: string;
      cashDifference: string;
    } | null>(null);
  const products = useQuery({
    queryKey: ["products", "exchange", search],
    queryFn: () =>
      request<{ items: Product[] }>(
        `/products?status=ACTIVE&limit=100&q=${encodeURIComponent(search)}`,
      ),
    enabled: exchange,
  });
  const variants =
    products.data?.items.flatMap((p) =>
      p.variants.map((v) => ({ ...v, name: p.name })),
    ) ?? [];
  const goodsRefundMinor = order.items.reduce((sum, line) => {
    const quantity = quantities[line.id] ?? 0,
      charged =
        Math.round(Number(line.unitPrice) * 100) * line.quantity -
        Math.round(Number(line.discountTotal ?? 0) * 100);
    return (
      sum +
      (quantity === line.quantity - (line.returnedQuantity ?? 0)
        ? charged - Math.round(Number(line.returnedAmount ?? 0) * 100)
        : Math.floor((charged * quantity) / line.quantity))
    );
  }, 0);
  const fullyReturning = order.items.every(
    (line) =>
      (quantities[line.id] ?? 0) + (line.returnedQuantity ?? 0) ===
      line.quantity,
  );
  const refundMinor =
    goodsRefundMinor +
    (fullyReturning && order.refundShipping
      ? Math.round(Number(order.shippingTotal ?? 0) * 100)
      : 0);
  const replacementMinor = exchange
    ? Math.round(
        Number(variants.find((v) => v.id === replacement)?.price ?? 0) * 100,
      ) * replacementQuantity
    : 0;
  const cashDifference = replacementMinor - refundMinor;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const result = await mutate<{ total: string; cashDifference: string }>(
        "/returns",
        {
          orderId: order.id,
          reason: form.get("reason"),
          items: order.items
            .filter((line) => (quantities[line.id] ?? 0) > 0)
            .map((line) => ({
              orderItemId: line.id,
              quantity: quantities[line.id],
              restock: restock[line.id] ?? true,
            })),
          ...(exchange
            ? {
                replacementItems: [
                  { variantId: replacement, quantity: replacementQuantity },
                ],
              }
            : {}),
          expectedCashDifference: (cashDifference / 100).toFixed(2),
        },
        "POST",
        crypto.randomUUID(),
      );
      await Promise.all(
        [
          "orders",
          "returns",
          "analytics",
          "products",
          "movements",
          "loyalty",
          "loyalty-accounts",
          "registers",
          "cashier-report",
          "customers",
          "crm",
        ].map((k) => client.invalidateQueries({ queryKey: [k] })),
      );
      setRecord(result);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal
      title={
        record
          ? t("Return recorded.")
          : `${t("Return or exchange")} · ${order.number}`
      }
      onClose={onClose}
      wide
    >
      <div className="modal-body">
        {record ? (
          <>
            <Badge tone="green">{t("Saved")}</Badge>
            <p>
              {t("Returned value:")}{" "}
              <Money
                value={record.total}
                currency={order.currency}
                locale={`${locale}-MA`}
              />
            </p>
            <p>
              {t(
                Number(record.cashDifference) > 0
                  ? "Additional cash collected"
                  : Number(record.cashDifference) < 0
                    ? "Cash returned to customer"
                    : "No cash difference",
              )}
              :{" "}
              <Money
                value={Math.abs(Number(record.cashDifference))}
                currency={order.currency}
                locale={`${locale}-MA`}
              />
            </p>
            <Button onClick={onClose}>{t("Back to orders")}</Button>
          </>
        ) : (
          <form onSubmit={submit}>
            <fieldset disabled={pending}>
              <p>
                {t(
                  "Select the units physically returned. Mark restock only for items in sellable condition.",
                )}
              </p>
              {order.items
                .filter((line) => (line.returnedQuantity ?? 0) < line.quantity)
                .map((line) => (
                  <div className="return-line" key={line.id}>
                    <span>
                      <strong>{line.name}</strong>
                      <small>
                        <bdi>{line.sku}</bdi> · {t("Returnable units")}:{" "}
                        {line.quantity - (line.returnedQuantity ?? 0)}
                      </small>
                    </span>
                    <label>
                      {t("Units")}
                      <input
                        aria-label={`${t("Return units")} ${line.sku}`}
                        type="number"
                        min={0}
                        max={line.quantity - (line.returnedQuantity ?? 0)}
                        value={quantities[line.id] ?? 0}
                        onChange={(e) =>
                          setQuantities((old) => ({
                            ...old,
                            [line.id]: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={restock[line.id] ?? true}
                        onChange={(e) =>
                          setRestock((old) => ({
                            ...old,
                            [line.id]: e.target.checked,
                          }))
                        }
                      />
                      {t("Restock sellable units")}
                    </label>
                  </div>
                ))}
              <label>
                {t("Reason")}
                <textarea
                  name="reason"
                  required
                  minLength={3}
                  maxLength={500}
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={exchange}
                  onChange={(e) => setExchange(e.target.checked)}
                />
                {t("Exchange for a replacement")}
              </label>
              {exchange && (
                <>
                  <label>
                    {t("Find a replacement")}
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <label>
                    {t("Replacement SKU")}
                    <select
                      aria-label={t("Replacement SKU")}
                      required
                      value={replacement}
                      onChange={(e) => setReplacement(e.target.value)}
                    >
                      <option value="">{t("Choose a variant")}</option>
                      {variants.map((v) => (
                        <option value={v.id} key={v.id}>
                          {v.name} · {v.sku} ·{" "}
                          {new Intl.NumberFormat(`${locale}-MA`, {
                            style: "currency",
                            currency: order.currency,
                            maximumFractionDigits: 2,
                          }).format(Number(v.price))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("Replacement quantity")}
                    <input
                      type="number"
                      min={1}
                      max={100}
                      required
                      value={replacementQuantity}
                      onChange={(e) =>
                        setReplacementQuantity(Number(e.target.value))
                      }
                    />
                  </label>
                </>
              )}
              <div className="receipt-total">
                <span>
                  {t(
                    cashDifference > 0
                      ? "Collect additional cash"
                      : cashDifference < 0
                        ? "Return cash to customer"
                        : "No cash difference",
                  )}
                </span>
                <strong>
                  <Money
                    value={Math.abs(cashDifference) / 100}
                    currency={order.currency}
                    locale={`${locale}-MA`}
                  />
                </strong>
              </div>
              <label className="check-label">
                <input required type="checkbox" />
                {t(
                  "The displayed cash difference has been settled with the customer.",
                )}
              </label>
              <Notice error={error || products.error} />
              <Button
                disabled={
                  pending || !Object.values(quantities).some((v) => v > 0)
                }
                type="submit"
              >
                {t(
                  pending
                    ? "Recording…"
                    : exchange
                      ? "Record exchange"
                      : "Record partial return",
                )}
              </Button>
            </fieldset>
          </form>
        )}
      </div>
    </Modal>
  );
}
