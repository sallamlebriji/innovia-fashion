import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import { Button, Badge } from "@innovia/ui";
import { PageTitle, Loading, Notice } from "../components";
type Plan = {
  id: string;
  name: string;
  monthlyPrice: string;
  productLimit: number;
  storeLimit: number;
  employeeLimit: number;
  aiCredits: number;
  trialDays: number;
  features: string[] | null;
};
type Control = {
  features: string[];
  providers: Record<string, boolean>;
  users: { id: string; name: string; email: string; active: boolean }[];
  stores: {
    id: string;
    name: string;
    city: string;
    kind: string;
    tenant: { name: string };
  }[];
  auditLogs: {
    id: string;
    action: string;
    createdAt: string;
    tenant?: { name: string };
  }[];
  platformAudit: {
    id: string;
    action: string;
    entityId: string;
    createdAt: string;
  }[];
  aiUsage: {
    id: string;
    period: string;
    used: number;
    tenant: { name: string };
  }[];
  jobs: { status: string; _count: number }[];
  mail: { status: string; _count: number }[];
};
const providerLabels: Record<string, string> = {
  billing: "Subscription billing",
  photoTryOn: "Photo fitting",
  email: "Email delivery",
  ar: "AR camera",
};
export function PlatformControl() {
  const client = useQueryClient(),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false),
    [tab, setTab] = useState("Plans");
  const query = useQuery({
    queryKey: ["platform", "control"],
    queryFn: () => request<Control>("/platform/control"),
  });
  const plans = useQuery({
    queryKey: ["platform", "plans"],
    queryFn: () => request<{ plans: Plan[] }>("/platform/overview"),
  });
  async function save(path: string, body: unknown, method = "PATCH") {
    setPending(true);
    setError(null);
    try {
      await mutate(path, body, method);
      await client.invalidateQueries({ queryKey: ["platform"] });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageTitle
        title="A considered platform."
        subtitle="Configure subscriptions, operator access and service readiness."
        eyebrow="PLATFORM CONTROL"
      />
      <Notice error={error ?? query.error ?? plans.error} />
      {query.isPending ? (
        <Loading />
      ) : (
        query.data && (
          <>
            <div className="metric-grid">
              {Object.entries(query.data.providers).map(([name, ready]) => (
                <article className="metric" key={name}>
                  <span>{providerLabels[name] ?? name}</span>
                  <h2>
                    <Badge tone={ready ? "green" : "gold"}>
                      {ready ? "Configured" : "Awaiting setup"}
                    </Badge>
                  </h2>
                </article>
              ))}
            </div>
            <div className="toolbar">
              {["Plans", "Stores", "Operators", "Audit", "AI usage"].map(
                (value) => (
                  <Button
                    variant={tab === value ? "primary" : "secondary"}
                    key={value}
                    onClick={() => setTab(value)}
                  >
                    {value}
                  </Button>
                ),
              )}
            </div>
            {tab === "Plans" ? (
              <div className="platform-plans">
                {plans.data?.plans.map((plan) => (
                  <form
                    className="panel platform-control-form"
                    key={plan.id}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const values = new FormData(event.currentTarget);
                      void save(`/platform/control/plans/${plan.id}`, {
                        name: values.get("name"),
                        monthlyPrice: values.get("monthlyPrice"),
                        productLimit: Number(values.get("productLimit")),
                        storeLimit: Number(values.get("storeLimit")),
                        employeeLimit: Number(values.get("employeeLimit")),
                        aiCredits: Number(values.get("aiCredits")),
                        trialDays: Number(values.get("trialDays")),
                        features: values.getAll("features"),
                      });
                    }}
                  >
                    <fieldset disabled={pending}>
                      <h2>{plan.name}</h2>
                      <label>
                        Name
                        <input name="name" defaultValue={plan.name} required />
                      </label>
                      <label>
                        Monthly price (MAD)
                        <input
                          name="monthlyPrice"
                          defaultValue={plan.monthlyPrice}
                          required
                        />
                      </label>
                      {(
                        [
                          "productLimit",
                          "storeLimit",
                          "employeeLimit",
                          "aiCredits",
                          "trialDays",
                        ] as const
                      ).map((field) => (
                        <label key={field}>
                          {field.replace(
                            /[A-Z]/g,
                            (value) => ` ${value.toLowerCase()}`,
                          )}
                          <input
                            type="number"
                            min="0"
                            name={field}
                            defaultValue={plan[field]}
                            required
                          />
                        </label>
                      ))}
                      <p>Included capabilities</p>
                      {query.data!.features.map((feature) => (
                        <label className="platform-feature" key={feature}>
                          <input
                            type="checkbox"
                            name="features"
                            value={feature}
                            defaultChecked={
                              !plan.features || plan.features.includes(feature)
                            }
                          />
                          {feature}
                        </label>
                      ))}
                      <Button type="submit">Save plan</Button>
                    </fieldset>
                  </form>
                ))}
              </div>
            ) : tab === "Stores" ? (
              <section className="panel table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Boutique</th>
                      <th>Location</th>
                      <th>City</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.stores.map((store) => (
                      <tr key={store.id}>
                        <td>{store.tenant.name}</td>
                        <td>{store.name}</td>
                        <td>{store.city}</td>
                        <td>{store.kind}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : tab === "Operators" ? (
              <>
                <section className="panel">
                  {query.data.users.map((user) => (
                    <div className="panel-heading" key={user.id}>
                      <div>
                        <strong>{user.name}</strong>
                        <p>{user.email}</p>
                      </div>
                      <Button
                        disabled={pending}
                        variant="secondary"
                        onClick={() =>
                          save(`/platform/control/users/${user.id}`, {
                            active: !user.active,
                          })
                        }
                      >
                        {user.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  ))}
                </section>
                <form
                  className="panel platform-control-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save(
                      "/platform/control/users",
                      Object.fromEntries(new FormData(event.currentTarget)),
                      "POST",
                    );
                  }}
                >
                  <h2>Create operator</h2>
                  <label>
                    Name
                    <input name="name" required minLength={2} />
                  </label>
                  <label>
                    Email
                    <input name="email" type="email" required />
                  </label>
                  <label>
                    Initial password
                    <input
                      name="password"
                      type="password"
                      minLength={12}
                      maxLength={72}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                  <Button disabled={pending}>Create operator</Button>
                </form>
              </>
            ) : tab === "Audit" ? (
              <section className="panel table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Scope</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ...query.data.platformAudit.map((entry) => ({
                        ...entry,
                        scope: "Platform",
                      })),
                      ...query.data.auditLogs.map((entry) => ({
                        ...entry,
                        scope: entry.tenant?.name ?? "Merchant",
                      })),
                    ]
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                      .slice(0, 100)
                      .map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.action}</td>
                          <td>{entry.scope}</td>
                          <td>{new Date(entry.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </section>
            ) : (
              <section className="panel table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Boutique</th>
                      <th>Month</th>
                      <th>Credits used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.aiUsage.map((row) => (
                      <tr key={row.id}>
                        <td>{row.tenant.name}</td>
                        <td>{row.period}</td>
                        <td>{row.used}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )
      )}
    </>
  );
}
