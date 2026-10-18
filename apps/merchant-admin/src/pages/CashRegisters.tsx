import { useCommerceWords as useWords } from "../commerce-words";
import { useCountWords } from "../count-words";
import { usePreferences } from "../state";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import { Button, Badge, Money } from "@innovia/ui";
import { PageTitle, Notice, Loading } from "../components";
import { useWorkspace } from "../App";
type CashSession = {
  id: string;
  store: { name: string };
  openedByName: string;
  openingCash: string;
  countedCash: string | null;
  expectedCash: string | null;
  variance: string | null;
  openedAt: string;
  closedAt: string | null;
};
type Detail = CashSession & {
  balance: string;
  movements: {
    id: string;
    type: string;
    amount: string;
    reason: string;
    createdAt: string;
  }[];
};
export function CashRegisters() {
  const t = useWords();
  const countWords = useCountWords();
  const locale = usePreferences((state) => state.locale);
  const { session, stores } = useWorkspace(),
    client = useQueryClient(),
    currency = session.tenant!.currency,
    manager = session.user.role !== "CASHIER";
  const [selected, setSelected] = useState(""),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["registers", page],
    queryFn: () =>
      request<{
        requireCashSession: boolean;
        items: CashSession[];
        total: number;
      }>(`/registers?page=${page}`),
    refetchOnMount: "always",
    refetchInterval: 10000,
  });
  const detail = useQuery({
    queryKey: ["registers", selected],
    queryFn: () => request<Detail>(`/registers/${selected}`),
    enabled: !!selected,
    refetchOnMount: "always",
    refetchInterval: 10000,
  });
  const performance = useQuery({
    queryKey: ["cashier-report"],
    queryFn: () =>
      request<
        { cashierId: string; name: string; sales: number; net: string }[]
      >("/cashier-report"),
    enabled: manager,
    refetchOnMount: "always",
  });
  async function save(path: string, body: unknown, method = "POST") {
    setPending(true);
    setError(null);
    try {
      const result = await mutate<{ id?: string }>(path, body, method);
      if (result.id && path === "/registers/open") setSelected(result.id);
      await client.invalidateQueries({ queryKey: ["registers"] });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  const data = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    return Object.fromEntries(new FormData(event.currentTarget));
  };
  function movementReason(movement: Detail["movements"][number]) {
    if (movement.type === "OPENING" && movement.reason === "Opening float")
      return t("Opening float");
    if (["SALE", "REFUND"].includes(movement.type)) {
      const prefix = `${movement.type.toLowerCase()} `;
      if (movement.reason.startsWith(prefix))
        return `${t(`Cash ${movement.type}`)} ${movement.reason.slice(prefix.length)}`;
    }
    return movement.reason;
  }
  return (
    <>
      <PageTitle
        eyebrow={t("EVERY DIRHAM ACCOUNTED FOR")}
        title={t("Cash registers.")}
        subtitle={t("Opening float, cash movements and a considered close.")}
      />
      <Notice error={error ?? query.error ?? detail.error} />
      {manager && query.data && (
        <section className="panel" style={{ padding: 24, marginBottom: 24 }}>
          <label>
            <input
              type="checkbox"
              checked={query.data.requireCashSession}
              disabled={pending}
              onChange={(e) =>
                void save(
                  "/registers/config",
                  { required: e.target.checked },
                  "PUT",
                )
              }
            />{" "}
            {t(
              "Require an open register for cash sales, pickup payments and refunds",
            )}
          </label>
          <p>
            {t(
              "Courier cash on delivery settlements stay outside the boutique cash drawer.",
            )}
          </p>
        </section>
      )}
      <div className="form-grid register-layout">
        <section className="panel" style={{ padding: 24 }}>
          <h2>{t("Open a register")}</h2>
          <form onSubmit={(e) => void save("/registers/open", data(e))}>
            <fieldset disabled={pending}>
              <label>
                {t("Store")}
                <select name="storeId" required>
                  {stores
                    .filter((s) => s.kind !== "WAREHOUSE")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                {t("Opening cash")} ({currency})
                <input
                  name="openingCash"
                  type="number"
                  step="0.01"
                  min="0"
                  max="9999999999.99"
                  defaultValue="0.00"
                  required
                />
              </label>
              <Button type="submit">{t("Open register")}</Button>
            </fieldset>
          </form>
          <h2>{t("Sessions")}</h2>
          {query.isPending && <Loading />}
          {query.data?.items.map((row) => (
            <button
              key={row.id}
              className="text-button"
              style={{ display: "block", padding: 12 }}
              onClick={() => setSelected(row.id)}
            >
              {row.store.name} · {row.openedByName} ·{" "}
              {new Date(row.openedAt).toLocaleString(`${locale}-MA`)}{" "}
              <Badge tone={row.closedAt ? "gold" : "green"}>
                {t(row.closedAt ? "Closed" : "Open session")}
              </Badge>
            </button>
          ))}
          <div className="action-row">
            <Button
              variant="secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              {t("Previous")}
            </Button>
            <Button
              variant="secondary"
              disabled={page * 25 >= (query.data?.total ?? 0)}
              onClick={() => setPage(page + 1)}
            >
              {t("Next")}
            </Button>
          </div>
        </section>
        <section className="panel" style={{ padding: 24 }}>
          {!selected ? (
            <p>{t("Select a cash session to review its ledger.")}</p>
          ) : detail.isPending ? (
            <Loading />
          ) : (
            detail.data && (
              <>
                <h2>{detail.data.store.name}</h2>
                <p>
                  {t("Expected cash:")}{" "}
                  <Money
                    value={detail.data.balance}
                    currency={currency}
                    locale={`${locale}-MA`}
                  />
                </p>
                {detail.data.closedAt ? (
                  <p>
                    {t("Counted")}{" "}
                    <Money
                      value={detail.data.countedCash ?? 0}
                      currency={currency}
                      locale={`${locale}-MA`}
                    />{" "}
                    · {t("Variance")}{" "}
                    <Money
                      value={detail.data.variance ?? 0}
                      currency={currency}
                      locale={`${locale}-MA`}
                    />
                  </p>
                ) : (
                  <>
                    {manager && (
                      <form
                        onSubmit={(e) =>
                          void save(`/registers/${selected}/movements`, data(e))
                        }
                      >
                        <fieldset disabled={pending}>
                          <h3>{t("Cash movement")}</h3>
                          <label>
                            {t("Direction")}
                            <select name="type">
                              <option value="IN">{t("Cash in")}</option>
                              <option value="OUT">{t("Cash out")}</option>
                            </select>
                          </label>
                          <label>
                            {t("Amount")}
                            <input
                              name="amount"
                              type="number"
                              min="0.01"
                              step="0.01"
                              required
                            />
                          </label>
                          <label>
                            {t("Reason")}
                            <input
                              name="reason"
                              minLength={3}
                              maxLength={1000}
                              required
                            />
                          </label>
                          <Button type="submit" variant="secondary">
                            {t("Record movement")}
                          </Button>
                        </fieldset>
                      </form>
                    )}
                    <form
                      onSubmit={(e) =>
                        void save(`/registers/${selected}/close`, data(e))
                      }
                    >
                      <fieldset disabled={pending}>
                        <h3>{t("Count & close")}</h3>
                        <label>
                          {t("Counted cash")} ({currency})
                          <input
                            name="countedCash"
                            type="number"
                            min="0"
                            step="0.01"
                            required
                          />
                        </label>
                        <label>
                          {t("Closing note")}
                          <input name="note" maxLength={1000} />
                        </label>
                        <Button type="submit">
                          {t("Close register & record variance")}
                        </Button>
                      </fieldset>
                    </form>
                  </>
                )}
                <h3>{t("Latest 200 movements")}</h3>
                {detail.data.movements.map((movement) => (
                  <div key={movement.id} className="receipt-line">
                    <span>
                      {t(`Cash ${movement.type}`)} ·{" "}
                      <bdi>{movementReason(movement)}</bdi>
                      <small>
                        {new Date(movement.createdAt).toLocaleString(
                          `${locale}-MA`,
                        )}
                      </small>
                    </span>
                    <Money
                      value={movement.amount}
                      currency={currency}
                      locale={`${locale}-MA`}
                    />
                  </div>
                ))}
              </>
            )
          )}
        </section>
      </div>
      {manager && (
        <section className="panel" style={{ padding: 24, marginTop: 24 }}>
          <h2>{t("Cashier performance · last 30 days")}</h2>
          <Notice error={performance.error} />
          {performance.data?.map((row) => (
            <div key={row.cashierId} className="receipt-line">
              <span>
                {row.name} · {countWords(row.sales, "sale")}
              </span>
              <Money
                value={row.net}
                currency={currency}
                locale={`${locale}-MA`}
              />
            </div>
          ))}
        </section>
      )}
    </>
  );
}
