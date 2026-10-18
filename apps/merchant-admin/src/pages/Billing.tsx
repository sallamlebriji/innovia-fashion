import { useWords } from "../words";
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate, ApiError } from "@innovia/api-client";
import { Button, Badge, Money } from "@innovia/ui";
import { PageTitle, Notice, Loading, Modal, Pagination } from "../components";
import { useWorkspace } from "../App";
type Invoice = {
  id: string;
  number: string;
  planName: string;
  amount: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  activationStatus: string;
  paidAt: string | null;
  paymentMethod: string;
  paymentReference: string;
  checkoutSessionId: string | null;
  tenant?: { name: string };
};
export function Billing({ operator = false }: { operator?: boolean }) {
  const t = useWords();
  const { session } = useWorkspace(),
    client = useQueryClient(),
    base = operator ? "/platform/billing" : "/billing",
    keys = useRef(new Map<string, string>()),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<Invoice | null>(null),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ["billing", operator, page],
    queryFn: () =>
      request<{
        invoices: Invoice[];
        total: number;
        onlinePayments: boolean;
        paidRevenue?: string;
        review?: { id: string; status: string; invoiceId: string }[];
      }>(`${base}?page=${page}`),
    refetchInterval: 30000,
  });
  const platform = useQuery({
    queryKey: ["platform"],
    queryFn: () =>
      request<{
        tenants: { id: string; name: string }[];
        plans: { id: string; name: string; monthlyPrice: string }[];
      }>("/platform/overview"),
    enabled: operator,
  });
  async function save(path: string, body: unknown) {
    setPending(true);
    setError(null);
    try {
      await mutate(path, body);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["billing"] }),
        client.invalidateQueries({ queryKey: ["platform"] }),
        client.invalidateQueries({ queryKey: ["subscription"] }),
      ]);
      setSelected(null);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  async function pay(invoice: Invoice) {
    setPending(true);
    setError(null);
    let key = keys.current.get(invoice.id);
    if (!key) {
      key = crypto.randomUUID();
      keys.current.set(invoice.id, key);
    }
    try {
      const result = await mutate<{ url: string }>(
        `/billing/${invoice.id}/checkout`,
        {},
        "POST",
        key,
      );
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com")
        throw new Error("The provider returned an unsupported payment page.");
      window.location.assign(result.url);
    } catch (err) {
      if (err instanceof ApiError && err.status === 410)
        keys.current.delete(invoice.id);
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      {operator ? (
        <PageTitle
          eyebrow={t("SUBSCRIPTION OPERATIONS")}
          title={t("Billing & paid periods.")}
          subtitle={t("Invoices, verified payments and workspace activation.")}
        />
      ) : (
        <h2 style={{ marginTop: 32 }}> {t("Subscription invoices")} </h2>
      )}
      <Notice error={error ?? query.error ?? platform.error} />
      {operator && (
        <section className="panel" style={{ padding: 24, marginBottom: 24 }}>
          <h2>
            {" "}
            {t("Collected subscription revenue ·")}{" "}
            <Money value={query.data?.paidRevenue ?? 0} currency="MAD" />
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              void save(base, {
                ...values,
                months: Number(values.months),
                periodStart: new Date(String(values.periodStart)).toISOString(),
              });
            }}
          >
            <fieldset disabled={pending}>
              <div className="form-grid">
                <label>
                  {" "}
                  {t("Merchant")}{" "}
                  <select name="tenantId" required>
                    {platform.data?.tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {" "}
                  {t("Plan")}{" "}
                  <select name="planId" required>
                    {platform.data?.plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.monthlyPrice} MAD {t("/ month")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {" "}
                  {t("Months")}{" "}
                  <input
                    name="months"
                    type="number"
                    min={1}
                    max={12}
                    defaultValue={1}
                    required
                  />
                </label>
                <label>
                  {" "}
                  {t("Period starts")}{" "}
                  <input name="periodStart" type="datetime-local" required />
                </label>
              </div>
              <Button type="submit"> {t("Issue subscription invoice")} </Button>
            </fieldset>
          </form>
          <p>
            {" "}
            {t(
              "Amounts are billed in MAD. Future paid periods activate on their start date; plan limits are checked before activation.",
            )}{" "}
          </p>
        </section>
      )}
      <section className="panel" style={{ padding: 24 }}>
        {!query.data?.onlinePayments && (
          <p>
            {" "}
            {t(
              "Online payment is awaiting provider configuration. The operator can record verified bank transfers or cash payments.",
            )}{" "}
          </p>
        )}
        {query.isPending && <Loading />}
        {query.data?.invoices.map((invoice) => (
          <article key={invoice.id} className="variant-editor">
            <h3>
              {invoice.number} · {invoice.planName}{" "}
              <Badge tone={invoice.status === "PAID" ? "green" : "gold"}>
                {t(invoice.status)}
              </Badge>
            </h3>
            {operator && <p>{invoice.tenant?.name}</p>}
            <p>
              <Money value={invoice.amount} currency={invoice.currency} /> ·{" "}
              {new Date(invoice.periodStart).toLocaleDateString()} →{" "}
              {new Date(invoice.periodEnd).toLocaleDateString()}
            </p>
            {invoice.status === "PAID" && (
              <p>
                {t("Activation")}: {t(invoice.activationStatus)}
              </p>
            )}
            <div className="action-row">
              <Button variant="secondary" onClick={() => setSelected(invoice)}>
                {" "}
                {t("View invoice")}{" "}
              </Button>
              {!operator &&
                session.user.role === "OWNER" &&
                invoice.status === "PENDING" && (
                  <Button
                    disabled={pending || !query.data?.onlinePayments}
                    onClick={() => void pay(invoice)}
                  >
                    {" "}
                    {t("Pay through Stripe")}{" "}
                  </Button>
                )}
              {operator &&
                invoice.status === "PENDING" &&
                !invoice.checkoutSessionId && (
                  <Button
                    disabled={pending}
                    variant="secondary"
                    onClick={() => void save(`${base}/${invoice.id}/void`, {})}
                  >
                    {" "}
                    {t("Void unpaid invoice")}{" "}
                  </Button>
                )}
              {operator &&
                invoice.status === "PAID" &&
                !["APPLIED", "SCHEDULED"].includes(
                  invoice.activationStatus,
                ) && (
                  <Button
                    disabled={pending}
                    onClick={() =>
                      void save(`${base}/${invoice.id}/activate`, {})
                    }
                  >
                    {" "}
                    {t("Recheck activation")}{" "}
                  </Button>
                )}
            </div>
          </article>
        ))}
        {query.data?.invoices.length === 0 && (
          <p> {t("No subscription invoices have been issued.")} </p>
        )}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </section>
      {!!query.data?.review?.length && (
        <section className="panel" style={{ padding: 24, marginTop: 24 }}>
          <h2> {t("Payment events requiring review")} </h2>
          {query.data.review.map((event) => (
            <p key={event.id}>
              {event.invoiceId} · {t(event.status)}
            </p>
          ))}
        </section>
      )}
      {selected && (
        <Modal
          title={`INNOVIA · ${selected.number}`}
          onClose={() => setSelected(null)}
        >
          <div className="modal-body receipt">
            <p>
              {" "}
              {t("Billed to")} {selected.tenant?.name ?? session.tenant?.name}
            </p>
            <h2>
              {selected.planName} {t("subscription")}{" "}
            </h2>
            <p>
              {new Date(selected.periodStart).toLocaleDateString()} —{" "}
              {new Date(selected.periodEnd).toLocaleDateString()}
            </p>
            <div className="receipt-total">
              <span>
                {t("Amount")} ({selected.currency})
              </span>
              <Money value={selected.amount} currency={selected.currency} />
            </div>
            <p>
              {t("Status")}: {t(selected.status)}
              {selected.paidAt
                ? ` · ${t("Paid")} ${new Date(selected.paidAt).toLocaleString()}`
                : ""}
            </p>
            {selected.paymentReference && (
              <p>
                {t(selected.paymentMethod)} · {t("Reference")}{" "}
                {selected.paymentReference}
              </p>
            )}
            <Button variant="secondary" onClick={() => window.print()}>
              {" "}
              {t("Print / save invoice")}{" "}
            </Button>
            {operator &&
              selected.status === "PENDING" &&
              !selected.checkoutSessionId && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = Object.fromEntries(
                      new FormData(e.currentTarget),
                    );
                    void save(`${base}/${selected.id}/pay`, {
                      ...form,
                      confirmedReceived: form.confirmedReceived === "on",
                    });
                  }}
                >
                  <fieldset disabled={pending}>
                    <Notice error={error} />
                    <h3> {t("Record a received payment")} </h3>
                    <label>
                      {" "}
                      {t("Payment method")}{" "}
                      <select name="paymentMethod">
                        <option value="BANK_TRANSFER">
                          {" "}
                          {t("Bank transfer")}{" "}
                        </option>
                        <option value="CASH"> {t("Cash")} </option>
                      </select>
                    </label>
                    <label>
                      {" "}
                      {t("Payment reference")}{" "}
                      <input
                        name="paymentReference"
                        minLength={3}
                        maxLength={200}
                        required
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        name="confirmedReceived"
                        required
                      />{" "}
                      {t(
                        "I have verified that the full amount was received.",
                      )}{" "}
                    </label>
                    <Button type="submit">
                      {" "}
                      {t("Record payment & check activation")}{" "}
                    </Button>
                  </fieldset>
                </form>
              )}
          </div>
        </Modal>
      )}
    </>
  );
}
