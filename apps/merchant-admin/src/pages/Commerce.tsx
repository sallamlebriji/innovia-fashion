import { useCommerceWords as useWords } from "../commerce-words";
import { useCountWords } from "../count-words";
import { usePreferences } from "../state";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Download, ArrowUpRight, Printer } from "lucide-react";
import { request, mutate } from "@innovia/api-client";
import type { Customer, Order } from "@innovia/types";
import { Button, Badge, Money, EmptyState } from "@innovia/ui";
import { useWorkspace } from "../App";
import {
  downloadCsv,
  Loading,
  Modal,
  Notice,
  PageTitle,
  Pagination,
} from "../components";
import { OrderTable } from "../OrderTable";
import { ReturnForm } from "./ReturnForm";
import { DeliveryActions } from "./DeliveryActions";
import { CustomerProfile } from "./CustomerProfile";
export function Orders() {
  const t = useWords();
  const countWords = useCountWords();
  const locale = usePreferences((state) => state.locale);
  const { session } = useWorkspace(),
    client = useQueryClient();
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<Order | null>(null),
    [returning, setReturning] = useState<Order | null>(null),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ["orders", page],
    queryFn: () =>
      request<{ items: Order[]; total: number }>(`/orders?page=${page}`),
  });
  async function action(value: "complete" | "cancel" | "refund") {
    setError(null);
    setPending(true);
    try {
      await mutate(
        `/orders/${selected!.id}/${value}`,
        {},
        "POST",
        crypto.randomUUID(),
      );
      await Promise.all(
        [
          "orders",
          "analytics",
          "products",
          "movements",
          "registers",
          "cashier-report",
          "loyalty",
          "loyalty-accounts",
          "customers",
          "crm",
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
      setSelected(null);
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageTitle
        title={t("Every order tells a story.")}
        subtitle={t(
          "From the first click to the final handover. Keep it all in view.",
        )}
        eyebrow={t("COMMERCE")}
        action={
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv("orders-page.csv", [
                ["Order", "Customer", "Channel", "Status", "Total", "Date"].map(
                  t,
                ),
                ...(query.data?.items ?? []).map((o) => [
                  o.number,
                  o.customerName,
                  o.channel,
                  o.status,
                  o.total,
                  o.createdAt,
                ]),
              ])
            }
          >
            <Download size={16} />
            {t("Export page")}
          </Button>
        }
      />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{t("All orders")}</h2>
            <p>{countWords(query.data?.total ?? 0, "order")}</p>
          </div>
          <Badge>{session.tenant!.currency}</Badge>
        </div>
        <Notice error={query.error} />
        {query.isPending ? (
          <Loading />
        ) : (
          <>
            <OrderTable
              orders={query.data?.items ?? []}
              currency={session.tenant!.currency}
            />
            <div className="order-actions-list">
              {query.data?.items.map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    setSelected(o);
                    setError(null);
                  }}
                >
                  {o.number}
                  <span>
                    {t("Manage order")}
                    <ArrowUpRight size={13} />
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </section>
      {selected && (
        <Modal title={selected.number} onClose={() => setSelected(null)}>
          <div className="modal-body receipt">
            <span className="eyebrow">{session.tenant!.name}</span>
            <p>
              {selected.customerName}
              <br />
              {selected.store.name} ·{" "}
              {new Date(selected.createdAt).toLocaleString(`${locale}-MA`)}
            </p>
            <Badge tone={selected.status === "COMPLETED" ? "green" : "gold"}>
              {t(selected.status)}
            </Badge>
            <div className="receipt-items">
              {selected.items.map((i) => (
                <div key={i.id}>
                  <span>
                    {i.name}
                    <small>
                      <bdi>{i.sku}</bdi> · {i.quantity} ×{" "}
                      <Money
                        value={i.unitPrice}
                        currency={selected.currency}
                        locale={`${locale}-MA`}
                      />
                    </small>
                  </span>
                  <strong>
                    <Money
                      value={Number(i.unitPrice) * i.quantity}
                      currency={selected.currency}
                      locale={`${locale}-MA`}
                    />
                  </strong>
                </div>
              ))}
            </div>
            <div className="receipt-total">
              <span>{t("Total")}</span>
              <strong>
                <Money
                  value={selected.total}
                  currency={session.tenant!.currency}
                  locale={`${locale}-MA`}
                />
              </strong>
            </div>
            {Number(selected.discountTotal ?? 0) > 0 && (
              <p>
                {t("Discount:")}{" "}
                <Money
                  value={selected.discountTotal!}
                  currency={selected.currency}
                  locale={`${locale}-MA`}
                />
              </p>
            )}
            {Number(selected.shippingTotal ?? 0) > 0 && (
              <p>
                {t("Delivery:")}{" "}
                <Money
                  value={selected.shippingTotal!}
                  currency={selected.currency}
                  locale={`${locale}-MA`}
                />
              </p>
            )}
            {Number(selected.taxTotal ?? 0) > 0 && (
              <p>
                {t("Included tax")} (
                {new Intl.NumberFormat(`${locale}-MA`, {
                  style: "percent",
                  maximumFractionDigits: 2,
                }).format(Number(selected.taxRate) / 100)}
                ):{" "}
                <Money
                  value={selected.taxTotal!}
                  currency={selected.currency}
                  locale={`${locale}-MA`}
                />
              </p>
            )}
            {Number(selected.refundedTotal ?? 0) > 0 && (
              <p>
                {t("Refunded:")}{" "}
                <Money
                  value={selected.refundedTotal!}
                  currency={selected.currency}
                  locale={`${locale}-MA`}
                />
              </p>
            )}
            <Notice error={error} />
            {session.user.role !== "CASHIER" && (
              <div className="form-actions">
                <DeliveryActions
                  order={selected}
                  onDone={async () => {
                    await Promise.all(
                      [
                        "orders",
                        "products",
                        "movements",
                        "analytics",
                        "registers",
                        "cashier-report",
                        "loyalty",
                        "loyalty-accounts",
                        "customers",
                        "crm",
                      ].map((key) =>
                        client.invalidateQueries({ queryKey: [key] }),
                      ),
                    );
                    setSelected(null);
                  }}
                />
                {selected.status === "IN_FULFILMENT" && (
                  <Button disabled={pending} onClick={() => action("complete")}>
                    {t("Delivery & payment confirmed")}
                  </Button>
                )}
                {selected.status === "PENDING" && (
                  <>
                    <Button
                      disabled={pending}
                      onClick={() => action("complete")}
                    >
                      {t("Payment collected & fulfilled")}
                    </Button>
                    <Button
                      disabled={pending}
                      variant="secondary"
                      onClick={() => action("cancel")}
                    >
                      {t("Cancel & release stock")}
                    </Button>
                  </>
                )}
                {["COMPLETED", "PARTIALLY_REFUNDED"].includes(
                  selected.status,
                ) && (
                  <>
                    <p className="field-help">
                      {t(
                        "Confirm that the remaining refundable cash amount has been returned and every item is back in sellable condition. Delivery fees follow the policy saved on this order.",
                      )}
                    </p>
                    <Button
                      disabled={pending}
                      variant="secondary"
                      onClick={() => action("refund")}
                    >
                      {t("Record full cash reversal & restock")}
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() => {
                        setReturning(selected);
                        setSelected(null);
                      }}
                    >
                      {t("Partial return or size exchange")}
                    </Button>
                  </>
                )}
              </div>
            )}
            <Button variant="ghost" onClick={() => window.print()}>
              <Printer size={15} />
              {t("Print receipt")}
            </Button>
          </div>
        </Modal>
      )}
      {returning && (
        <ReturnForm order={returning} onClose={() => setReturning(null)} />
      )}
    </>
  );
}
export function Customers() {
  const t = useWords();
  const countWords = useCountWords();
  const locale = usePreferences((state) => state.locale);
  const { session } = useWorkspace(),
    [selected, setSelected] = useState("");
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["customers", q, page],
    queryFn: () =>
      request<{ items: Customer[]; total: number }>(
        `/customers?q=${encodeURIComponent(q)}&page=${page}`,
      ),
  });
  return (
    <>
      <PageTitle
        title={t("More than customers. Your community.")}
        subtitle={t("The people behind every purchase, brought together.")}
        eyebrow={t("CUSTOMER DIRECTORY")}
      />
      <section className="panel">
        <div className="filterbar">
          <div className="filter-search">
            <Search size={16} />
            <input
              value={q}
              aria-label={t("Search customers")}
              placeholder={t("Search by name or email…")}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <span className="push-end muted">
            {countWords(query.data?.total ?? 0, "customer")}
          </span>
        </div>
        <Notice error={query.error} />
        {query.isPending ? (
          <Loading />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Customer")}</th>
                  <th>{t("Phone")}</th>
                  <th>{t("Orders")}</th>
                  <th>{t("Joined")}</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="customer-cell">
                        <span className="avatar">
                          {c.name
                            .split(" ")
                            .map((x) => x[0])
                            .join("")
                            .slice(0, 2)}
                        </span>
                        <span>
                          {session.user.role !== "CASHIER" ? (
                            <button
                              className="text-button"
                              onClick={() => setSelected(c.id)}
                            >
                              {c.name} <span aria-hidden="true">↗</span>
                            </button>
                          ) : (
                            <strong>{c.name}</strong>
                          )}
                          <small>{c.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>{c.phone || "—"}</td>
                    <td>{c._count.orders}</td>
                    <td>
                      {new Date(c.createdAt).toLocaleDateString(`${locale}-MA`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!query.data?.total && (
              <EmptyState
                title={t("Your community starts with one connection.")}
              >
                {t("Customers appear when an order includes an email address.")}
              </EmptyState>
            )}
          </div>
        )}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </section>
      {selected && (
        <CustomerProfile id={selected} onClose={() => setSelected("")} />
      )}
    </>
  );
}
