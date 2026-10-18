import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "@innovia/api-client";
import { Money } from "@innovia/ui";
import { useWorkspace } from "../App";
import { PageTitle, Loading, Notice } from "../components";
import { useWords } from "../words";
type Dimension = {
  id: string;
  name: string;
  orders: number;
  units: number;
  revenue: string;
  grossMargin: string | null;
};
type Report = {
  days: number;
  currency: string;
  sales: {
    grossSales: string;
    refunds: string;
    netSales: string;
    orders: number;
    averageOrder: string;
    grossMargin: string | null;
    costBasisComplete: boolean;
    marginBasis: string;
  };
  dimensions: Record<string, Dimension[]>;
  inventory: {
    valuation: string;
    basis: string;
    discrepancies: number;
    rows: {
      id: string;
      name: string;
      sku: string;
      size: string;
      store: string;
      available: number;
      onHand: number;
      reserved: number;
      value: string;
      netUnitsSold: number;
      lowStock: boolean;
      slowMoving: boolean;
      reorderSuggestion: number;
    }[];
  };
  loyalty: {
    members: number;
    pointsOutstanding: number;
    pointsEarned: number;
    pointsRedeemed: number;
    repeatMembers: number;
  };
  ai: { status: string; count: number }[];
};
export function Reports() {
  const t = useWords();
  const { stores } = useWorkspace();
  const [days, setDays] = useState(30),
    [storeId, setStoreId] = useState(""),
    [tab, setTab] = useState("stores");
  const query = useQuery({
      queryKey: ["reports", days, storeId],
      queryFn: () =>
        request<Report>(
          `/reports?days=${days}${storeId ? `&storeId=${storeId}` : ""}`,
        ),
    }),
    data = query.data;
  return (
    <>
      <PageTitle
        title={t("Understand your next chapter.")}
        subtitle={t("Sales, stock and membership from your retail ledger.")}
        eyebrow={t("BUSINESS REPORTS")}
      />
      <div className="toolbar">
        <label>
          {t("Period")}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>{t("7 days")}</option>
            <option value={30}>{t("30 days")}</option>
            <option value={90}>{t("90 days")}</option>
            <option value={365}>{t("365 days")}</option>
          </select>
        </label>
        <label>
          {t("Location")}
          <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">{t("All locations")}</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Notice error={query.error} />
      {query.isPending ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="metric-grid">
              {[
                { label: t("Net sales"), value: data.sales.netSales },
                { label: t("Refunds"), value: data.sales.refunds },
                {
                  label: t("Inventory value"),
                  value: data.inventory.valuation,
                },
                {
                  label: t("Gross merchandise margin"),
                  value: data.sales.grossMargin,
                },
              ].map((item) => (
                <article className="metric" key={item.label}>
                  <span>{item.label}</span>
                  <h2>
                    {item.value === null ? (
                      "—"
                    ) : (
                      <Money value={item.value} currency={data.currency} />
                    )}
                  </h2>
                  <p>
                    {item.value === null
                      ? t("Historical cost snapshots are incomplete.")
                      : t("From recorded transactions")}
                  </p>
                </article>
              ))}
            </div>
            <p>{t(data.sales.marginBasis)}</p>
            <section className="panel">
              <div className="panel-heading">
                <h2>{t("Explore the ledger")}</h2>
                <select
                  aria-label={t("Report dimension")}
                  value={tab}
                  onChange={(e) => setTab(e.target.value)}
                >
                  {[
                    "stores",
                    "categories",
                    "brands",
                    "products",
                    "employees",
                    "inventory",
                    "membership",
                    "ai",
                  ].map((value) => (
                    <option key={value} value={value}>
                      {t(value) === value
                        ? value[0]!.toUpperCase() + value.slice(1)
                        : t(value)}
                    </option>
                  ))}
                </select>
              </div>
              {tab === "inventory" ? (
                <>
                  <p>
                    {t(data.inventory.basis)} {t("Count discrepancies")}:{" "}
                    {data.inventory.discrepancies}
                  </p>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("Product / SKU")}</th>
                          <th>{t("Location")}</th>
                          <th>{t("On hand")}</th>
                          <th>{t("Reserved")}</th>
                          <th>{t("Sold")}</th>
                          <th>{t("Reorder")}</th>
                          <th>{t("Value")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.inventory.rows.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <strong>{row.name}</strong>
                              <small>
                                {row.sku} · {row.size}
                                {row.lowStock ? ` · ${t("Low stock")}` : ""}
                                {row.slowMoving ? ` · ${t("Slow moving")}` : ""}
                              </small>
                            </td>
                            <td>{row.store}</td>
                            <td>{row.onHand}</td>
                            <td>{row.reserved}</td>
                            <td>{row.netUnitsSold}</td>
                            <td>{row.reorderSuggestion}</td>
                            <td>
                              <Money
                                value={row.value}
                                currency={data.currency}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : tab === "membership" ? (
                <dl className="detail-list">
                  {Object.entries(data.loyalty).map(([key, value]) => (
                    <div key={key}>
                      <dt>{t(key)}</dt>
                      <dd>{value.toLocaleString()}</dd>
                    </div>
                  ))}
                </dl>
              ) : tab === "ai" ? (
                <dl className="detail-list">
                  {data.ai.map((row) => (
                    <div key={row.status}>
                      <dt>{row.status}</dt>
                      <dd>{row.count}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{t(tab)}</th>
                        <th>{t("Orders")}</th>
                        <th>{t("Net units")}</th>
                        <th>{t("Goods sales")}</th>
                        <th>{t("Margin")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.dimensions[tab]?.map((row) => (
                        <tr key={row.id}>
                          <td>{row.name}</td>
                          <td>{row.orders}</td>
                          <td>{row.units}</td>
                          <td>
                            <Money
                              value={row.revenue}
                              currency={data.currency}
                            />
                          </td>
                          <td>
                            {row.grossMargin === null ? (
                              "—"
                            ) : (
                              <Money
                                value={row.grossMargin}
                                currency={data.currency}
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
