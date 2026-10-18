import { OrderTable } from "../OrderTable";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Download,
  CalendarDays,
  ShoppingBag,
  Banknote,
  Package,
  Receipt,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { request } from "@innovia/api-client";
import type { Analytics } from "@innovia/types";
import { Button, Money, EmptyState } from "@innovia/ui";
import { useWorkspace } from "../App";
import { useLabels } from "../state";
import {
  downloadCsv,
  Loading,
  Notice,
  PageTitle,
  Picture,
} from "../components";
export function Overview() {
  const { session, stores } = useWorkspace(),
    labels = useLabels();
  const [days, setDays] = useState(30),
    [storeId, setStoreId] = useState("");
  const query = useQuery({
    queryKey: ["analytics", days, storeId],
    queryFn: () =>
      request<Analytics>(
        `/analytics?days=${days}${storeId ? `&storeId=${storeId}` : ""}`,
      ),
  });
  const data = query.data,
    currency = session.tenant!.currency;
  const metrics = [
    {
      label: labels.revenue,
      icon: Banknote,
      value: data?.revenue ?? 0,
      money: true,
      note: "From completed orders",
    },
    {
      label: labels.sales,
      icon: ShoppingBag,
      value: data?.orders ?? 0,
      note: `Across the last ${days} days`,
    },
    {
      label: labels.average,
      icon: Receipt,
      value: data?.averageOrder ?? 0,
      money: true,
      note: "Per completed transaction",
    },
    {
      label: labels.stock,
      icon: Package,
      value: data?.stockUnits ?? 0,
      note: `${data?.lowStock ?? 0} variants need attention`,
    },
  ];
  return (
    <>
      <PageTitle
        eyebrow="THE BIG PICTURE"
        title={`${labels.greeting}, ${session.user.name.split(" ")[0]}.`}
        subtitle={labels.welcome}
        action={
          <div className="page-actions">
            <Button
              variant="secondary"
              onClick={() => {
                if (data)
                  downloadCsv("innovia-sales.csv", [
                    ["Date", "Revenue", "Orders"],
                    ...data.daily.map((x) => [x.date, x.revenue, x.orders]),
                  ]);
              }}
            >
              <Download size={15} />
              {labels.export}
            </Button>
            <Link className="button button-primary" to="/catalog?new=1">
              <Plus size={16} />
              {labels.newProduct}
            </Link>
          </div>
        }
      />
      <div className="overview-toolbar">
        <div className="workspace-status">
          <span className="live-dot" />
          Your boutique, in focus
          <span className="toolbar-divider" />{" "}
          {new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Africa/Casablanca",
          }).format(new Date())}
        </div>
        <div>
          <select
            aria-label="Location"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            <option value="">{labels.allStores}</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <span className="date-select">
            <CalendarDays size={14} />
            <select
              aria-label="Reporting period"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </span>
        </div>
      </div>
      <Notice error={query.error} />
      <section className="metric-grid" aria-label="Key performance indicators">
        {metrics.map((m, i) => (
          <article className="metric" key={m.label}>
            <div>
              <span>{m.label}</span>
              <m.icon size={17} strokeWidth={1.5} />
            </div>
            <h2>
              {query.isPending ? (
                <span className="skeleton metric-skeleton" />
              ) : m.money ? (
                <Money value={m.value} currency={currency} />
              ) : (
                Number(m.value).toLocaleString()
              )}
            </h2>
            <p>
              <span
                className={
                  i === 3 && data?.lowStock ? "metric-warning" : "metric-marker"
                }
              />{" "}
              {m.note}
            </p>
          </article>
        ))}
      </section>
      <div className="overview-main-grid">
        <section className="panel sales-panel">
          <div className="panel-heading">
            <div>
              <h2>{labels.salesOverview}</h2>
              <p>A clear view of your boutique’s performance.</p>
            </div>
            <span className="chart-legend">
              <i />
              Revenue
            </span>
          </div>
          <div className="chart-summary">
            <strong>
              <Money value={data?.revenue ?? 0} currency={currency} />
            </strong>
            <span>over the last {days} days</span>
          </div>
          <div className="sales-chart">
            {query.isPending ? (
              <Loading />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data?.daily ?? []}
                  margin={{ top: 15, right: 14, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="revenue-fill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#b1946b"
                        stopOpacity={0.19}
                      />
                      <stop offset="100%" stopColor="#b1946b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="var(--line)"
                    strokeDasharray="3 5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })
                    }
                    axisLine={false}
                    tickLine={false}
                    minTickGap={35}
                    tick={{ fontSize: 11, fill: "var(--muted)" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${v / 1000}k` : String(v)
                    }
                    tick={{ fontSize: 11, fill: "var(--muted)" }}
                  />
                  <Tooltip
                    formatter={(value) => [
                      `${Number(value).toLocaleString()} ${currency}`,
                      "Revenue",
                    ]}
                    labelFormatter={(label) =>
                      new Date(String(label)).toLocaleDateString()
                    }
                    contentStyle={{
                      border: "1px solid var(--line)",
                      borderRadius: 6,
                      background: "var(--paper)",
                      fontSize: 12,
                      color: "var(--ink)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#b1946b"
                    strokeWidth={2.5}
                    fill="url(#revenue-fill)"
                    activeDot={{
                      r: 5,
                      fill: "#b1946b",
                      stroke: "var(--paper)",
                      strokeWidth: 3,
                    }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="chart-bottom">
            <span>
              <span className="live-dot" />
              Synced with your sales ledger
            </span>
            <Link to="/orders">
              Explore your orders
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
        <aside className="editorial-card">
          <Picture
            src={session.tenant!.heroImage}
            alt="Illustrative autumn fashion campaign"
          />
          <div className="editorial-shade" />
          <div className="editorial-content">
            <span className="eyebrow">YOUR BRAND / A FRESH PERSPECTIVE</span>
            <h2>
              A new season.
              <br />A fresh <em>perspective.</em>
            </h2>
            <p>
              Your next collection deserves
              <br />
              an exceptional first impression.
            </p>
            <Link to="/storefront">
              Make your store yours
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <span className="editorial-index">01 / CURATED FOR YOU</span>
        </aside>
      </div>
      <div className="overview-lower-grid">
        <section className="panel orders-panel">
          <div className="panel-heading">
            <div>
              <h2>{labels.recentOrders}</h2>
              <p>Every order is a new connection.</p>
            </div>
            <Link className="subtle-link" to="/orders">
              View all
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <OrderTable orders={data?.recentOrders ?? []} currency={currency} />
        </section>
        <section className="panel bestsellers-panel">
          <div className="panel-heading">
            <div>
              <h2>{labels.bestsellers}</h2>
              <p>The pieces your customers love.</p>
            </div>
            <Link to="/catalog" aria-label="View products">
              <ArrowUpRight size={19} />
            </Link>
          </div>
          <div className="bestsellers">
            {data?.bestSellers.map((p, i) => (
              <div key={p.name} className="bestseller">
                <span className="rank">0{i + 1}</span>
                <Picture src={p.imageUrl} alt={p.name} />
                <div>
                  <strong>{p.name}</strong>
                  <small>{p.quantity} pieces sold</small>
                </div>
                <span>
                  <Money value={p.revenue} currency={currency} />
                </span>
              </div>
            ))}
            {!data?.bestSellers.length && (
              <EmptyState title="Your next bestseller awaits.">
                Complete a sale to discover your most loved pieces.
              </EmptyState>
            )}
          </div>
        </section>
      </div>
      <div className="overview-notes">
        <Link to="/inventory" className="insight-card">
          <div className="insight-icon">
            <Package size={20} />
          </div>
          <div>
            <strong>
              {data?.lowStock
                ? `${data.lowStock} variants could use a little restock.`
                : "Your inventory is in good shape."}
            </strong>
            <p>Keep your best pieces ready for their next chapter.</p>
          </div>
          <ArrowRight size={18} />
        </Link>
        <div className="insight-card quiet">
          <div className="insight-icon">
            <Sparkles size={20} />
          </div>
          <div>
            <strong>Thoughtful commerce. Beautifully connected.</strong>
            <p>
              {data?.productCount ?? 0} products · {data?.customerCount ?? 0}{" "}
              customers · One workspace.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
