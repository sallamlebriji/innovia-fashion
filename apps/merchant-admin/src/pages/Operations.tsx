import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import { Button, Badge, EmptyState, Money } from "@innovia/ui";
import { Plus, ArrowRightLeft, ClipboardCheck, Truck } from "lucide-react";
import type { Product } from "@innovia/types";
import { useWorkspace } from "../App";
import { PageTitle, Modal, Notice, Loading, Pagination } from "../components";

type Supplier = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  active: boolean;
};
type Transfer = {
  id: string;
  variant: { sku: string };
  fromStore: { name: string };
  toStore: { name: string };
  quantity: number;
  reason: string;
  createdAt: string;
};
type Count = {
  id: string;
  variant: { sku: string };
  store: { name: string };
  previous: number;
  counted: number;
  difference: number;
  reason: string;
  createdAt: string;
};
type Purchase = {
  id: string;
  number: string;
  supplier: Supplier;
  store: { name: string };
  status: string;
  total: string;
  currency: string;
  items: {
    quantity: number;
    unitCost: string;
    variant: { sku: string; product: { name: string } };
  }[];
  createdAt: string;
};
type FormKind = "transfer" | "count" | "supplier" | "purchase";

export function Operations() {
  const { stores, session } = useWorkspace(),
    client = useQueryClient();
  const [tab, setTab] = useState<
      "transfers" | "counts" | "purchases" | "suppliers"
    >("transfers"),
    [page, setPage] = useState(1),
    [form, setForm] = useState<FormKind | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(),
    [search, setSearch] = useState(""),
    [lines, setLines] = useState([
      { variantId: "", quantity: 1, unitCost: "0.00" },
    ]),
    [selected, setSelected] = useState<Purchase | null>(null);
  const allowed = session.user.role !== "CASHIER";
  const transfers = useQuery({
    queryKey: ["transfers", page],
    queryFn: () =>
      request<{ items: Transfer[]; total: number }>(
        `/inventory/transfers?page=${page}`,
      ),
    enabled: tab === "transfers",
  });
  const counts = useQuery({
    queryKey: ["counts", page],
    queryFn: () =>
      request<{ items: Count[]; total: number }>(
        `/inventory/counts?page=${page}`,
      ),
    enabled: tab === "counts",
  });
  const purchases = useQuery({
    queryKey: ["purchases", page],
    queryFn: () =>
      request<{ items: Purchase[]; total: number }>(`/purchases?page=${page}`),
    enabled: tab === "purchases",
  });
  const suppliers = useQuery({
    queryKey: ["suppliers", page],
    queryFn: () =>
      request<{ items: Supplier[]; total: number }>(`/suppliers?page=${page}`),
    enabled: tab === "suppliers" || form === "purchase",
  });
  const products = useQuery({
    queryKey: ["products", "operations", search],
    queryFn: () =>
      request<{ items: Product[] }>(
        `/products?q=${encodeURIComponent(search)}&limit=100`,
      ),
    enabled: !!form && form !== "supplier",
  });
  const variants =
    products.data?.items.flatMap((p) =>
      p.variants.map((v) => ({ ...v, name: p.name })),
    ) ?? [];
  const query =
    tab === "transfers"
      ? transfers
      : tab === "counts"
        ? counts
        : tab === "purchases"
          ? purchases
          : suppliers;
  async function refresh() {
    await Promise.all(
      [
        "transfers",
        "counts",
        "purchases",
        "suppliers",
        "products",
        "movements",
        "analytics",
      ].map((key) => client.invalidateQueries({ queryKey: [key] })),
    );
  }
  function open(kind: FormKind) {
    setError(null);
    setForm(kind);
    setSearch("");
    setLines([{ variantId: "", quantity: 1, unitCost: "0.00" }]);
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    setPending(true);
    setError(null);
    try {
      const endpoint =
        form === "transfer"
          ? "/inventory/transfers"
          : form === "count"
            ? "/inventory/counts"
            : form === "purchase"
              ? "/purchases"
              : "/suppliers";
      const payload =
        form === "transfer"
          ? { ...values, quantity: Number(values.quantity) }
          : form === "count"
            ? { ...values, counted: Number(values.counted) }
            : form === "purchase"
              ? { ...values, items: lines }
              : values;
      await mutate(endpoint, payload, "POST", crypto.randomUUID());
      await refresh();
      setForm(null);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  async function transition(purchase: Purchase, action: "receive" | "cancel") {
    setPending(true);
    setError(null);
    try {
      await mutate(
        `/purchases/${purchase.id}/${action}`,
        {},
        "POST",
        crypto.randomUUID(),
      );
      await refresh();
      setSelected(null);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  const titles = {
    transfer: "Move pieces with confidence.",
    count: "Make every unit count.",
    supplier: "A new supply partner.",
    purchase: "Plan your next delivery.",
  };
  return (
    <>
      <PageTitle
        eyebrow="RETAIL OPERATIONS"
        title="Every movement. Beautifully connected."
        subtitle="Receive supplier purchases, transfer available stock, and reconcile physical counts."
        action={
          allowed && (
            <Button
              onClick={() =>
                open(
                  tab === "transfers"
                    ? "transfer"
                    : tab === "counts"
                      ? "count"
                      : tab === "purchases"
                        ? "purchase"
                        : "supplier",
                )
              }
            >
              <Plus size={16} />
              {tab === "transfers"
                ? "Transfer stock"
                : tab === "counts"
                  ? "Record a count"
                  : tab === "purchases"
                    ? "Create purchase"
                    : "Add supplier"}
            </Button>
          )
        }
      />
      <div className="tabs">
        {(["transfers", "counts", "purchases", "suppliers"] as const).map(
          (t) => (
            <button
              className={t === tab ? "active" : ""}
              key={t}
              onClick={() => {
                setTab(t);
                setPage(1);
                setError(null);
              }}
            >
              {t[0]!.toUpperCase() + t.slice(1)}
            </button>
          ),
        )}
      </div>
      <Notice error={error || query.error} />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              {tab === "transfers"
                ? "From one location to the next"
                : tab === "counts"
                  ? "Your physical stock ledger"
                  : tab === "purchases"
                    ? "Purchase orders"
                    : "Supply partners"}
            </h2>
            <p>
              {tab === "transfers"
                ? "Transfers record immediate physical receipt. Reserved units stay at their location."
                : tab === "counts"
                  ? "Counts replace on-hand units with an audited discrepancy movement."
                  : tab === "purchases"
                    ? "Receiving a draft purchase adds its entire quantity to the destination stock once."
                    : "Supplier contacts are private to your workspace."}
            </p>
          </div>
          {tab === "transfers" ? (
            <ArrowRightLeft size={22} />
          ) : tab === "counts" ? (
            <ClipboardCheck size={22} />
          ) : (
            <Truck size={22} />
          )}
        </div>
        {query.isPending ? (
          <Loading />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {(tab === "transfers"
                    ? ["SKU", "From", "To", "Units", "Reason", "Date"]
                    : tab === "counts"
                      ? [
                          "SKU",
                          "Location",
                          "Before",
                          "Counted",
                          "Difference",
                          "Date",
                        ]
                      : tab === "purchases"
                        ? [
                            "Reference",
                            "Supplier",
                            "Destination",
                            "Total",
                            "Status",
                            "Details",
                          ]
                        : ["Supplier", "Email", "Phone", "Address", "Status"]
                  ).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tab === "transfers" &&
                  transfers.data?.items.map((t) => (
                    <tr key={t.id}>
                      <td>{t.variant.sku}</td>
                      <td>{t.fromStore.name}</td>
                      <td>{t.toStore.name}</td>
                      <td>{t.quantity}</td>
                      <td>{t.reason}</td>
                      <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                {tab === "counts" &&
                  counts.data?.items.map((c) => (
                    <tr key={c.id}>
                      <td>{c.variant.sku}</td>
                      <td>{c.store.name}</td>
                      <td>{c.previous}</td>
                      <td>{c.counted}</td>
                      <td>
                        <Badge tone={c.difference === 0 ? "green" : "gold"}>
                          {c.difference > 0 ? "+" : ""}
                          {c.difference}
                        </Badge>
                      </td>
                      <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                {tab === "purchases" &&
                  purchases.data?.items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.number}</strong>
                        <small>
                          {new Date(p.createdAt).toLocaleDateString()}
                        </small>
                      </td>
                      <td>{p.supplier.name}</td>
                      <td>{p.store.name}</td>
                      <td>
                        <Money value={p.total} currency={p.currency} />
                      </td>
                      <td>
                        <Badge
                          tone={p.status === "RECEIVED" ? "green" : "neutral"}
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setError(null);
                            setSelected(p);
                          }}
                        >
                          View purchase
                        </Button>
                      </td>
                    </tr>
                  ))}
                {tab === "suppliers" &&
                  suppliers.data?.items.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                      </td>
                      <td>{s.email || "—"}</td>
                      <td>{s.phone || "—"}</td>
                      <td>{s.address || "—"}</td>
                      <td>
                        <Badge tone={s.active ? "green" : "neutral"}>
                          {s.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {query.data?.total === 0 && (
              <EmptyState title="Your next movement starts here.">
                Create a{" "}
                {tab === "transfers"
                  ? "transfer"
                  : tab === "counts"
                    ? "stock count"
                    : tab === "purchases"
                      ? "purchase order"
                      : "supplier"}{" "}
                to begin.
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
      {form && (
        <Modal
          title={titles[form]}
          onClose={() => setForm(null)}
          wide={form === "purchase"}
        >
          <form className="modal-body" onSubmit={submit}>
            <fieldset disabled={pending}>
              {form === "supplier" ? (
                <div className="form-grid">
                  <label className="span-2">
                    Supplier name
                    <input name="name" required minLength={2} maxLength={150} />
                  </label>
                  <label>
                    Email
                    <input name="email" type="email" />
                  </label>
                  <label>
                    Phone
                    <input name="phone" maxLength={50} />
                  </label>
                  <label className="span-2">
                    Address
                    <textarea name="address" maxLength={500} />
                  </label>
                </div>
              ) : (
                <>
                  <label>
                    Find a product or SKU
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search your catalog"
                    />
                  </label>
                  <Notice error={products.error} />
                  {form !== "purchase" && (
                    <label>
                      Variant
                      <select name="variantId" required>
                        <option value="">Select a SKU</option>
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} · {v.sku} · {v.size}/{v.color}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {form === "transfer" ? (
                    <div className="form-grid">
                      <label>
                        Source
                        <select name="fromStoreId" required>
                          {stores.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} · {s.kind ?? "STORE"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Destination
                        <select
                          name="toStoreId"
                          required
                          defaultValue={stores[1]?.id}
                        >
                          {stores.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} · {s.kind ?? "STORE"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Units physically received
                        <input
                          name="quantity"
                          type="number"
                          min={1}
                          max={100000}
                          required
                        />
                      </label>
                    </div>
                  ) : (
                    <label>
                      Destination location
                      <select name="storeId" required>
                        {stores.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} · {s.kind ?? "STORE"}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {form === "count" && (
                    <label>
                      Physical on-hand count
                      <input
                        name="counted"
                        type="number"
                        min={0}
                        max={100000}
                        required
                      />
                      <small>
                        Include reserved units that are still physically
                        present.
                      </small>
                    </label>
                  )}
                  {form === "purchase" ? (
                    <>
                      <label>
                        Supplier
                        <select name="supplierId" required>
                          <option value="">Choose a supplier</option>
                          {suppliers.data?.items
                            .filter((s) => s.active)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </select>
                        <small>
                          Create a supplier in the Suppliers tab first.
                        </small>
                      </label>
                      {lines.map((line, i) => (
                        <div className="form-grid purchase-line" key={i}>
                          <label className="span-2">
                            SKU
                            <select
                              required
                              value={line.variantId}
                              onChange={(e) =>
                                setLines((old) =>
                                  old.map((l, j) =>
                                    j === i
                                      ? {
                                          ...l,
                                          variantId: e.target.value,
                                          unitCost:
                                            variants.find(
                                              (v) => v.id === e.target.value,
                                            )?.cost ?? "0.00",
                                        }
                                      : l,
                                  ),
                                )
                              }
                            >
                              <option value="">Select a SKU</option>
                              {variants.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name} · {v.sku}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Quantity
                            <input
                              type="number"
                              min={1}
                              max={100000}
                              required
                              value={line.quantity}
                              onChange={(e) =>
                                setLines((old) =>
                                  old.map((l, j) =>
                                    j === i
                                      ? {
                                          ...l,
                                          quantity: Number(e.target.value),
                                        }
                                      : l,
                                  ),
                                )
                              }
                            />
                          </label>
                          <label>
                            Unit cost ({session.tenant!.currency})
                            <input
                              required
                              inputMode="decimal"
                              value={line.unitCost}
                              onChange={(e) =>
                                setLines((old) =>
                                  old.map((l, j) =>
                                    j === i
                                      ? { ...l, unitCost: e.target.value }
                                      : l,
                                  ),
                                )
                              }
                            />
                          </label>
                          {lines.length > 1 && (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() =>
                                setLines((old) => old.filter((_, j) => i !== j))
                              }
                            >
                              Remove line
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={lines.length >= 100}
                        onClick={() =>
                          setLines((old) => [
                            ...old,
                            { variantId: "", quantity: 1, unitCost: "0.00" },
                          ])
                        }
                      >
                        Add purchase line
                      </Button>
                      <label>
                        Notes
                        <textarea name="notes" maxLength={2000} />
                      </label>
                    </>
                  ) : (
                    <label>
                      Reason
                      <textarea
                        name="reason"
                        minLength={3}
                        maxLength={500}
                        required
                      />
                    </label>
                  )}
                </>
              )}
              <Notice error={error} />
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Saving…"
                  : form === "transfer"
                    ? "Confirm physical transfer"
                    : form === "count"
                      ? "Reconcile stock"
                      : form === "purchase"
                        ? "Create draft purchase"
                        : "Save supplier"}
              </Button>
            </fieldset>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal title={selected.number} onClose={() => setSelected(null)}>
          <div className="modal-body">
            <p>
              {selected.supplier.name} → {selected.store.name}
            </p>
            <Badge>{selected.status}</Badge>
            {selected.items.map((line, i) => (
              <div className="purchase-summary" key={i}>
                <strong>{line.variant.product.name}</strong>
                <span>
                  {line.variant.sku} · {line.quantity} units ×{" "}
                  <Money value={line.unitCost} currency={selected.currency} />
                </span>
              </div>
            ))}
            <h3>
              Total{" "}
              <Money value={selected.total} currency={selected.currency} />
            </h3>
            <Notice error={error} />
            {allowed && selected.status === "DRAFT" && (
              <div className="action-row">
                <Button
                  disabled={pending}
                  onClick={() => transition(selected, "receive")}
                >
                  Receive all units
                </Button>
                <Button
                  disabled={pending}
                  variant="secondary"
                  onClick={() => transition(selected, "cancel")}
                >
                  Cancel purchase
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
