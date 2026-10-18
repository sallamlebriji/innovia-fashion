import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import { Button, Badge } from "@innovia/ui";
import { useWorkspace } from "../App";
import { Loading, Notice, PageTitle } from "../components";
type Staff = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "MANAGER" | "CASHIER";
  active: boolean;
};
export function Staff() {
  const { session } = useWorkspace(),
    client = useQueryClient(),
    owner = session.user.role === "OWNER";
  const [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(),
    [url, setUrl] = useState("");
  const query = useQuery({
    queryKey: ["staff"],
    queryFn: () =>
      request<{
        users: Staff[];
        invites: {
          id: string;
          email: string;
          role: string;
          expiresAt: string;
        }[];
        limit: number;
      }>("/staff"),
  });
  async function action(work: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await work();
      await client.invalidateQueries({ queryKey: ["staff"] });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR TEAM"
        title="Good people. Shared purpose."
        subtitle="Invite staff with limited roles. Role changes and deactivation revoke existing sessions."
      />
      <Notice error={error || query.error} />
      {query.isPending ? (
        <Loading />
      ) : (
        <section className="panel">
          <div className="panel-heading">
            <h2>Workspace access</h2>
            <Badge>
              {query.data?.users.filter((user) => user.active).length ?? 0}{" "}
              active / {query.data?.limit ?? 0}
            </Badge>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                    </td>
                    <td>{user.role}</td>
                    <td>
                      <Badge tone={user.active ? "green" : "neutral"}>
                        {user.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td>
                      {owner && user.role !== "OWNER" && (
                        <div className="action-row">
                          <select
                            value={user.role}
                            aria-label={`Role for ${user.name}`}
                            disabled={pending}
                            onChange={(event) =>
                              action(() =>
                                mutate(
                                  `/staff/${user.id}`,
                                  {
                                    active: user.active,
                                    role: event.target.value,
                                  },
                                  "PATCH",
                                ),
                              )
                            }
                          >
                            <option value="MANAGER">Manager</option>
                            <option value="CASHIER">Cashier</option>
                          </select>
                          <Button
                            disabled={pending}
                            variant="secondary"
                            onClick={() =>
                              action(() =>
                                mutate(
                                  `/staff/${user.id}`,
                                  { active: !user.active, role: user.role },
                                  "PATCH",
                                ),
                              )
                            }
                          >
                            {user.active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {owner && (
            <form
              className="settings-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = Object.fromEntries(
                  new FormData(event.currentTarget),
                );
                action(async () => {
                  const invite = await mutate<{ url: string }>(
                    "/staff/invites",
                    data,
                  );
                  setUrl(invite.url);
                });
              }}
            >
              <div className="form-grid">
                <label>
                  Staff email
                  <input name="email" type="email" required />
                </label>
                <label>
                  Role
                  <select name="role">
                    <option value="CASHIER">Cashier</option>
                    <option value="MANAGER">Manager</option>
                  </select>
                </label>
              </div>
              <p className="field-help">
                Share the private invitation yourself with the intended
                employee. It expires in 48 hours and can be used once.
              </p>
              <Button disabled={pending}>Create invitation</Button>
              {url && (
                <label>
                  Private invitation link
                  <input
                    readOnly
                    value={url}
                    onFocus={(event) => event.target.select()}
                  />
                  <small>
                    Copy this link now. The secret is not stored in readable
                    form.
                  </small>
                </label>
              )}
            </form>
          )}
          <div className="settings-form">
            <h3>Pending invitations</h3>
            {query.data?.invites.map((invite) => (
              <div key={invite.id} className="operations-row">
                <span>
                  {invite.email} · {invite.role}
                  <small>
                    Expires {new Date(invite.expiresAt).toLocaleString()}
                  </small>
                </span>
                {owner && (
                  <Button
                    disabled={pending}
                    variant="ghost"
                    onClick={() =>
                      action(() =>
                        mutate(`/staff/invites/${invite.id}`, {}, "DELETE"),
                      )
                    }
                  >
                    Cancel invitation
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="panel settings-form">
        <h2>Role permissions</h2>
        <p>
          Owners manage staff, products, stock, sales, campaigns, and business
          settings. Managers run products, stock, fulfilment, returns, and
          campaigns. Cashiers can read retail records and complete cash sales.
          Platform operators use a separate account.
        </p>
      </section>
    </>
  );
}
