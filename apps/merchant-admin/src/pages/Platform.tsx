import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import { Button, Badge, Money } from "@innovia/ui";
import { Plus, Store, Package, Users, ShieldCheck } from "lucide-react";
import { Loading, Modal, Notice, PageTitle } from "../components";
interface Plan {
  id: string;
  name: string;
  monthlyPrice: string;
  productLimit: number;
  storeLimit: number;
  employeeLimit: number;
  aiCredits: number;
  trialDays: number;
}
interface Merchant {
  id: string;
  name: string;
  slug: string;
  demo: boolean;
  createdAt: string;
  plan: Plan;
  _count: { products: number; stores: number; users: number };
  subscriptionStatus: string;
  trialEndsAt: string | null;
}
export function Platform() {
  const client = useQueryClient();
  const [creating, setCreating] = useState(false),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ["platform"],
    queryFn: () =>
      request<{ tenants: Merchant[]; plans: Plan[] }>("/platform/overview"),
  });
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await mutate("/platform/plans", {
        ...form,
        productLimit: Number(form.productLimit),
        storeLimit: Number(form.storeLimit),
        employeeLimit: Number(form.employeeLimit),
        aiCredits: Number(form.aiCredits),
        trialDays: Number(form.trialDays),
      });
      await client.invalidateQueries({ queryKey: ["platform"] });
      setCreating(false);
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  async function assign(tenantId: string, planId: string) {
    setError(null);
    try {
      await mutate(`/platform/tenants/${tenantId}/plan`, { planId }, "PATCH");
      await client.invalidateQueries({ queryKey: ["platform"] });
    } catch (e) {
      setError(e);
    }
  }
  return (
    <>
      <PageTitle
        title="A world of independent fashion."
        subtitle="The boutiques, people, and plans that make INNOVIA."
        eyebrow="PLATFORM OPERATIONS"
        action={
          <Button
            onClick={() => {
              setCreating(true);
              setError(null);
            }}
          >
            <Plus size={16} />
            Create plan
          </Button>
        }
      />
      <Notice error={error || query.error} />
      <a className="button button-secondary" href="/platform/support">
        Support requests →
      </a>
      <a className="button button-secondary" href="/platform/control">
        Plans, operators & audit →
      </a>
      <a className="button button-secondary" href="/platform/billing">
        Subscription invoices →
      </a>
      <section className="metric-grid">
        {[
          {
            label: "Merchant workspaces",
            value: query.data?.tenants.length ?? 0,
            icon: Store,
          },
          {
            label: "Catalog products",
            value:
              query.data?.tenants.reduce((s, t) => s + t._count.products, 0) ??
              0,
            icon: Package,
          },
          {
            label: "Platform users",
            value:
              query.data?.tenants.reduce((s, t) => s + t._count.users, 0) ?? 0,
            icon: Users,
          },
          {
            label: "Configured plans",
            value: query.data?.plans.length ?? 0,
            icon: ShieldCheck,
          },
        ].map((m) => (
          <article className="metric" key={m.label}>
            <div>
              <span>{m.label}</span>
              <m.icon size={18} />
            </div>
            <h2>{m.value}</h2>
            <p>From persisted platform records</p>
          </article>
        ))}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Merchant directory</h2>
            <p>Subscription limits apply at the data and API layers.</p>
          </div>
          <Badge>Operator access</Badge>
        </div>
        {query.isPending ? (
          <Loading />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Boutique</th>
                  <th>Products</th>
                  <th>Stores</th>
                  <th>Users</th>
                  <th>Plan</th>
                  <th>Subscription</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.tenants.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.name}</strong>
                      <small>
                        {t.demo
                          ? "Fictional demo boutique"
                          : "Merchant workspace"}{" "}
                        · /{t.slug}
                      </small>
                    </td>
                    <td>{t._count.products}</td>
                    <td>{t._count.stores}</td>
                    <td>{t._count.users}</td>
                    <td>
                      <select
                        aria-label={`Plan for ${t.name}`}
                        value={t.plan.id}
                        onChange={(e) => assign(t.id, e.target.value)}
                      >
                        {query.data?.plans.map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <SubscriptionControl
                        tenant={t}
                        onSaved={async () => {
                          await client.invalidateQueries({
                            queryKey: ["platform"],
                          });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="platform-plans">
        {query.data?.plans.map((p) => (
          <section className="panel" key={p.id}>
            <span className="eyebrow">SUBSCRIPTION PLAN</span>
            <h2>{p.name}</h2>
            <strong>
              <Money value={p.monthlyPrice} /> <small>/ month</small>
            </strong>
            <p>
              {p.productLimit.toLocaleString()} products
              <br />
              {p.storeLimit} locations
              <br />
              {p.employeeLimit} active employees · {p.trialDays} trial days
              <br />
              {p.aiCredits} AI credits / period
            </p>
            <Badge tone="gold">Configurable subscription</Badge>
          </section>
        ))}
      </div>
      {creating && (
        <Modal
          title="A plan for the next chapter."
          onClose={() => setCreating(false)}
        >
          <form className="modal-body" onSubmit={add}>
            <label>
              Plan name
              <input required name="name" minLength={2} />
            </label>
            <label>
              Monthly price (MAD)
              <input
                required
                name="monthlyPrice"
                inputMode="decimal"
                defaultValue="299.00"
              />
            </label>
            <label>
              Product limit
              <input
                type="number"
                name="productLimit"
                min="1"
                required
                defaultValue={100}
              />
            </label>
            <label>
              Store limit
              <input
                type="number"
                name="storeLimit"
                min="1"
                required
                defaultValue={1}
              />
            </label>
            <Notice error={error} />
            <label>
              Employee limit
              <input
                type="number"
                name="employeeLimit"
                min="1"
                max="10000"
                required
                defaultValue={10}
              />
            </label>
            <label>
              AI credits per period
              <input
                type="number"
                name="aiCredits"
                min="0"
                max="1000000"
                required
                defaultValue={0}
              />
            </label>
            <label>
              Free trial days
              <input
                type="number"
                name="trialDays"
                min="0"
                max="90"
                required
                defaultValue={14}
              />
            </label>
            <Button type="submit" disabled={pending}>
              Create plan
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
function SubscriptionControl({
  tenant,
  onSaved,
}: {
  tenant: Merchant;
  onSaved: () => Promise<void>;
}) {
  const [status, setStatus] = useState(tenant.subscriptionStatus),
    [end, setEnd] = useState(tenant.trialEndsAt?.slice(0, 10) ?? ""),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>();
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        try {
          await mutate(
            `/platform/workspaces/${tenant.id}/subscription`,
            {
              subscriptionStatus: status,
              trialEndsAt:
                status === "TRIAL"
                  ? new Date(`${end}T23:59:59Z`).toISOString()
                  : null,
            },
            "PATCH",
          );
          await onSaved();
        } catch (err) {
          setError(err);
        } finally {
          setPending(false);
        }
      }}
    >
      <select
        aria-label={`Subscription for ${tenant.name}`}
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        <option>ACTIVE</option>
        <option>TRIAL</option>
        <option>PAST_DUE</option>
        <option>SUSPENDED</option>
      </select>
      {status === "TRIAL" && (
        <input
          type="date"
          aria-label={`Trial end for ${tenant.name}`}
          required
          value={end}
          onChange={(event) => setEnd(event.target.value)}
        />
      )}
      <Button type="submit" disabled={pending} variant="ghost">
        Apply status
      </Button>
      <Notice error={error} />
    </form>
  );
}
