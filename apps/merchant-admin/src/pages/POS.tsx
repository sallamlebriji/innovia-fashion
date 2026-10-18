import { useWords } from "../words";
import { usePreferences } from "../state";
import { useCountWords } from "../count-words";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Minus,
  Plus,
  Trash2,
  Check,
  Banknote,
  Printer,
  ScanLine,
} from "lucide-react";
import { request, mutate } from "@innovia/api-client";
import type { Order, Product, Variant } from "@innovia/types";
import { Button, Badge, Money, EmptyState } from "@innovia/ui";
import { useWorkspace } from "../App";
import { Loading, Modal, Notice, PageTitle, Picture } from "../components";
type Line = { product: Product; variant: Variant; quantity: number };
export function POS() {
  const t = useWords();
  const countWords = useCountWords();
  const locale = usePreferences((state) => state.locale);
  const { session, stores: locations } = useWorkspace(),
    client = useQueryClient();
  const stores = locations.filter((s) => s.kind !== "WAREHOUSE");
  const [q, setQ] = useState(""),
    [storeId, setStoreId] = useState(stores[0]?.id ?? ""),
    [lines, setLines] = useState<Line[]>([]),
    [product, setProduct] = useState<Product | null>(null),
    [customer, setCustomer] = useState("Walk-in customer"),
    [customerEdited, setCustomerEdited] = useState(false),
    [email, setEmail] = useState(""),
    [rewardCode, setRewardCode] = useState(""),
    [couponCode, setCouponCode] = useState(""),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false),
    [receipt, setReceipt] = useState<Order | null>(null),
    [key, setKey] = useState(crypto.randomUUID());
  useEffect(() => {
    if (!storeId && stores[0]) setStoreId(stores[0].id);
  }, [stores, storeId]);
  const query = useQuery({
    queryKey: ["products", "pos", q],
    staleTime: 0,
    refetchInterval: 10000,
    queryFn: () =>
      request<{ items: Product[] }>(
        `/products?status=ACTIVE&limit=100&q=${encodeURIComponent(q)}`,
      ),
  });
  const voucher = useQuery({
    queryKey: ["reward-voucher", email, rewardCode],
    queryFn: () =>
      request<{ discountValue: string }>(
        `/loyalty/voucher?${new URLSearchParams({ code: rewardCode, email })}`,
      ),
    enabled: rewardCode.length >= 8 && email.includes("@"),
    retry: false,
  });
  function add(p: Product, v: Variant) {
    setKey(crypto.randomUUID());
    setLines((current) => {
      const existing = current.find((x) => x.variant.id === v.id);
      return existing
        ? current.map((x) =>
            x === existing ? { ...x, quantity: x.quantity + 1 } : x,
          )
        : [...current, { product: p, variant: v, quantity: 1 }];
    });
    setProduct(null);
  }
  const total = lines.reduce(
    (s, l) => s + Math.round(Number(l.variant.price) * 100) * l.quantity,
    0,
  );
  const promotion = useQuery({
    queryKey: ["coupon-quote", couponCode, total],
    queryFn: () =>
      request<{ discount: string }>(
        `/coupons/quote?${new URLSearchParams({ code: couponCode, subtotal: (total / 100).toFixed(2), channel: "POS" })}`,
      ),
    enabled: couponCode.length >= 3 && total > 0,
    retry: false,
  });
  async function pay() {
    setPending(true);
    setError(null);
    try {
      const order = await mutate<Order>(
        "/pos/checkout",
        {
          storeId,
          customerName: customer,
          ...(email ? { email } : {}),
          ...(rewardCode ? { rewardCode } : {}),
          ...(couponCode ? { couponCode } : {}),
          channel: "POS",
          paymentMethod: "CASH",
          items: lines.map((l) => ({
            variantId: l.variant.id,
            quantity: l.quantity,
          })),
        },
        "POST",
        key,
      );
      setReceipt(order);
      setLines([]);
      setCustomer("Walk-in customer");
      setCustomerEdited(false);
      setEmail("");
      setRewardCode("");
      setCouponCode("");
      setKey(crypto.randomUUID());
      await Promise.all(
        [
          "products",
          "orders",
          "analytics",
          "movements",
          "registers",
          "cashier-report",
          "loyalty",
          "loyalty-accounts",
          "customers",
          "crm",
        ].map((k) => client.invalidateQueries({ queryKey: [k] })),
      );
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageTitle
        title={t("A seamless moment of sale.")}
        subtitle={t("Find a piece, select a size, make someone’s day.")}
        eyebrow={t("POINT OF SALE")}
        action={
          <Badge tone="green">
            <span className="live-dot" />
            {t("Online · Cash enabled")}
          </Badge>
        }
      />
      <div className="pos-layout">
        <section className="panel">
          <div className="filterbar">
            <div className="filter-search">
              <Search size={17} />
              <input
                aria-label={t("Search or scan SKU")}
                placeholder={t("Search products or scan a SKU…")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const exact = query.data?.items
                    .flatMap((p) => p.variants.map((v) => ({ p, v })))
                    .find(
                      ({ v }) => v.sku === q.trim() || v.barcode === q.trim(),
                    );
                  if (exact) {
                    add(exact.p, exact.v);
                    setQ("");
                  } else if (query.data?.items.length === 1)
                    setProduct(query.data.items[0]!);
                }}
              />
              <ScanLine size={17} />
            </div>
          </div>
          <Notice error={query.error} />
          {query.isPending ? (
            <Loading />
          ) : (
            <div className="product-grid pos-products">
              {query.data?.items.map((p) => (
                <button
                  className="product-card"
                  key={p.id}
                  onClick={() => setProduct(p)}
                >
                  <Picture src={p.imageUrl} alt={p.name} />
                  <span className="eyebrow">{p.category}</span>
                  <h3>{p.name}</h3>
                  <strong>
                    <Money
                      value={p.variants[0]?.price ?? 0}
                      currency={session.tenant!.currency}
                      locale={`${locale}-MA`}
                    />
                  </strong>
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="panel pos-cart">
          <div className="panel-heading">
            <h2>{t("Current sale")}</h2>
            <Badge>
              {countWords(
                lines.reduce((s, l) => s + l.quantity, 0),
                "piece",
              )}
            </Badge>
          </div>
          <div className="pos-cart-body">
            <label>
              {t("Location")}
              <select
                value={storeId}
                onChange={(e) => {
                  setStoreId(e.target.value);
                  setKey(crypto.randomUUID());
                }}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Customer name")}
              <input
                value={customerEdited ? customer : t("Walk-in customer")}
                minLength={2}
                onChange={(e) => {
                  setCustomer(e.target.value);
                  setCustomerEdited(true);
                  setKey(crypto.randomUUID());
                }}
              />
            </label>
            <label>
              {t("Customer email")}
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setKey(crypto.randomUUID());
                }}
                placeholder={t("Optional; required for loyalty")}
                dir="ltr"
              />
            </label>
            <label>
              {t("Reward voucher")}
              <input
                value={rewardCode}
                onChange={(e) => {
                  setRewardCode(e.target.value);
                  setCouponCode("");
                  setKey(crypto.randomUUID());
                }}
                placeholder="RW-…"
                dir="ltr"
              />
            </label>
            <Notice error={voucher.error} />
            <label>
              {t("Promotion code")}
              <input
                value={couponCode}
                dir="ltr"
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  setRewardCode("");
                  setKey(crypto.randomUUID());
                }}
                placeholder={t("Optional promotion")}
              />
            </label>
            <Notice error={promotion.error} />
            {!lines.length ? (
              <EmptyState title={t("A little room for something lovely.")}>
                {t("Select a piece to begin your sale.")}
              </EmptyState>
            ) : (
              <div className="cart-lines">
                {lines.map((l) => (
                  <div key={l.variant.id} className="cart-line">
                    <Picture src={l.product.imageUrl} alt={l.product.name} />
                    <div>
                      <strong>{l.product.name}</strong>
                      <small>
                        {l.variant.color} / {l.variant.size}
                      </small>
                      <div className="quantity-control">
                        <button
                          aria-label={`${t("Decrease")} ${l.product.name}`}
                          onClick={() => {
                            setKey(crypto.randomUUID());
                            setLines(
                              lines
                                .filter((x) => x !== l || l.quantity > 1)
                                .map((x) =>
                                  x === l
                                    ? { ...x, quantity: x.quantity - 1 }
                                    : x,
                                ),
                            );
                          }}
                        >
                          <Minus size={12} />
                        </button>
                        <span>{l.quantity}</span>
                        <button
                          aria-label={`${t("Increase")} ${l.product.name}`}
                          onClick={() => add(l.product, l.variant)}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <strong>
                        <Money
                          value={Number(l.variant.price) * l.quantity}
                          currency={session.tenant!.currency}
                          locale={`${locale}-MA`}
                        />
                      </strong>
                      <button
                        className="icon-button"
                        aria-label={`${t("Remove")} ${l.product.name}`}
                        onClick={() => {
                          setLines(lines.filter((x) => x !== l));
                          setKey(crypto.randomUUID());
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="receipt-total">
              <span>{t("Total")}</span>
              <strong>
                <Money
                  value={
                    Math.max(
                      0,
                      total -
                        Math.round(
                          Number(
                            couponCode
                              ? (promotion.data?.discount ?? 0)
                              : (voucher.data?.discountValue ?? 0),
                          ) * 100,
                        ),
                    ) / 100
                  }
                  currency={session.tenant!.currency}
                  locale={`${locale}-MA`}
                />
              </strong>
            </div>
            <p className="field-help">
              {t(
                "Selling prices include any configured tax. Record the cash you have actually received.",
              )}
            </p>
            <Notice error={error} />
            <Button
              disabled={
                pending || !lines.length || !storeId || customer.length < 2
              }
              onClick={pay}
            >
              <Banknote size={17} />
              {t(pending ? "Recording sale…" : "Cash received · Complete sale")}
            </Button>
          </div>
        </section>
      </div>
      {product && (
        <Modal title={product.name} onClose={() => setProduct(null)}>
          <div className="modal-body">
            <p>{t("Select the piece that fits.")}</p>
            <div className="variant-options">
              {product.variants.map((v) => {
                const available = v.inventory.find(
                  (i) => i.storeId === storeId,
                );
                const stock = available
                  ? available.onHand - available.reserved
                  : 0;
                return (
                  <button
                    key={v.id}
                    disabled={stock < 1}
                    onClick={() => add(product, v)}
                  >
                    <span>
                      {v.color} / {v.size}
                    </span>
                    <strong>
                      <Money
                        value={v.price}
                        currency={session.tenant!.currency}
                        locale={`${locale}-MA`}
                      />
                    </strong>
                    <small>
                      {stock} {t("available")}
                    </small>
                    <Plus size={16} />
                  </button>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
      {receipt && (
        <Modal
          title={t("A lovely transaction.")}
          onClose={() => setReceipt(null)}
        >
          <div className="modal-body receipt">
            <span className="success-circle">
              <Check size={24} />
            </span>
            <h3>{t("Sale completed")}</h3>
            <p>
              <bdi>{receipt.number}</bdi>
              <br />
              {t("Stock has been updated across your boutique.")}
            </p>
            <div className="receipt-items">
              {receipt.items.map((i) => (
                <div key={i.id}>
                  <span>
                    {i.name}
                    <small>
                      {i.quantity} × <bdi>{i.sku}</bdi>
                    </small>
                  </span>
                  <Money
                    value={Number(i.unitPrice) * i.quantity}
                    currency={receipt.currency}
                    locale={`${locale}-MA`}
                  />
                </div>
              ))}
            </div>
            <div className="receipt-total">
              <span>{t("Cash received")}</span>
              <Money
                value={receipt.total}
                currency={session.tenant!.currency}
                locale={`${locale}-MA`}
              />
            </div>
            <Button onClick={() => window.print()} variant="secondary">
              <Printer size={16} />
              {t("Print receipt")}
            </Button>
            <Button onClick={() => setReceipt(null)}>
              {t("Start a new sale")}
            </Button>
            {Number(receipt.discountTotal ?? 0) > 0 && (
              <p>
                {t("Discount:")}{" "}
                <Money
                  value={receipt.discountTotal!}
                  currency={receipt.currency}
                  locale={`${locale}-MA`}
                />
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
