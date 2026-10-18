import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { request, mutate } from "@innovia/api-client";
import { Button, Badge, Money, EmptyState } from "@innovia/ui";
import type { Customer } from "@innovia/types";
import { useWorkspace } from "../App";
import { Modal, Notice, PageTitle, Loading, Pagination } from "../components";

type Tier = {
  name: string;
  threshold: number;
  benefits: string;
  multiplier: number;
};
type Program = {
  name: string;
  enabled: boolean;
  spendUnit: string;
  pointsPerUnit: number;
  expiryDays: number;
  tiers: Tier[];
};
type Reward = {
  id: string;
  name: string;
  pointsCost: number;
  discountValue: string;
  active: boolean;
};
type Account = {
  id: string;
  customer: Customer;
  cardCode: string;
  points: number;
  lifetimePoints: number;
  enrolledAt: string;
  entries?: {
    id: string;
    points: number;
    type: string;
    reason: string;
    createdAt: string;
  }[];
  redemptions?: {
    id: string;
    code: string;
    status: string;
    discountValue: string;
    reward: Reward;
  }[];
};
type Overview = {
  program: Program | null;
  rewards: Reward[];
  accounts: number;
  totals: {
    type: string;
    _sum: { points: number };
    _count: { _all: number };
  }[];
};

export function Loyalty() {
  const { session } = useWorkspace(),
    client = useQueryClient(),
    currency = session.tenant!.currency;
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [form, setForm] = useState<"program" | "reward" | "enroll" | null>(null),
    [selected, setSelected] = useState<Account | null>(null),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false),
    [customerSearch, setCustomerSearch] = useState(""),
    [tiers, setTiers] = useState<Tier[]>([]),
    [qr, setQr] = useState("");
  const manager = session.user.role !== "CASHIER";
  const overview = useQuery({
    queryKey: ["loyalty"],
    queryFn: () => request<Overview>("/loyalty"),
  });
  const accounts = useQuery({
    queryKey: ["loyalty-accounts", q, page],
    queryFn: () =>
      request<{ items: Account[]; total: number }>(
        `/loyalty/accounts?q=${encodeURIComponent(q)}&page=${page}`,
      ),
  });
  const detail = useQuery({
    queryKey: ["loyalty-account", selected?.id],
    queryFn: () => request<Account>(`/loyalty/accounts/${selected!.id}`),
    enabled: !!selected,
  });
  const customers = useQuery({
    queryKey: ["customers", "enroll", customerSearch],
    queryFn: () =>
      request<{ items: Customer[] }>(
        `/customers?q=${encodeURIComponent(customerSearch)}&limit=100`,
      ),
    enabled: form === "enroll",
  });
  const program = overview.data?.program,
    account = detail.data ?? selected;
  useEffect(() => {
    let valid = true;
    setQr("");
    if (account)
      QRCode.toDataURL(
        `innovia:member:${session.tenant!.slug}:${account.cardCode}`,
        { width: 200, margin: 2, errorCorrectionLevel: "M" },
      )
        .then((url) => {
          if (valid) setQr(url);
        })
        .catch(setError);
    return () => {
      valid = false;
    };
  }, [account?.cardCode, session.tenant?.slug]);
  async function refresh() {
    await Promise.all(
      ["loyalty", "loyalty-accounts", "loyalty-account"].map((k) =>
        client.invalidateQueries({ queryKey: [k] }),
      ),
    );
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setPending(true);
    setError(null);
    try {
      if (form === "program")
        await mutate(
          "/loyalty/program",
          {
            ...data,
            enabled: data.enabled === "on",
            pointsPerUnit: Number(data.pointsPerUnit),
            expiryDays: Number(data.expiryDays),
            tiers,
          },
          "PUT",
        );
      else if (form === "reward")
        await mutate("/rewards", {
          ...data,
          pointsCost: Number(data.pointsCost),
        });
      else
        await mutate("/loyalty/enroll", {
          customerId: data.customerId,
          consent: data.consent === "on",
        });
      await refresh();
      setForm(null);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  async function redeem(rewardId: string) {
    if (!account) return;
    setPending(true);
    setError(null);
    try {
      await mutate(
        "/loyalty/redeem",
        { accountId: account.id, rewardId },
        "POST",
        crypto.randomUUID(),
      );
      await refresh();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  async function adjust(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!account) return;
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setPending(true);
    setError(null);
    try {
      await mutate(
        "/loyalty/adjust",
        {
          accountId: account.id,
          points: Number(data.points),
          reason: data.reason,
        },
        "POST",
        crypto.randomUUID(),
      );
      await refresh();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="MEMBERS CLUB"
        title="Reward the relationships that last."
        subtitle="One membership across your boutique, point of sale, and online collection."
        action={
          <div className="action-row">
            <Button
              variant="secondary"
              onClick={() => {
                setForm("enroll");
                setError(null);
              }}
            >
              Enroll a customer
            </Button>
            {manager && (
              <Button
                onClick={() => {
                  setTiers(program?.tiers ?? []);
                  setForm("program");
                  setError(null);
                }}
              >
                Configure program
              </Button>
            )}
          </div>
        }
      />
      <Notice error={overview.error || accounts.error || error} />
      <div className="loyalty-overview">
        <section className="panel loyalty-program">
          <span className="eyebrow">
            {program?.name ?? "YOUR MEMBERS CLUB"}
          </span>
          <h2>{accounts.data?.total ?? 0} meaningful connections.</h2>
          <p>
            {program
              ? `${program.pointsPerUnit} point${program.pointsPerUnit === 1 ? "" : "s"} for every ${program.spendUnit} ${currency} paid. ${program.expiryDays ? `Unused earned points expire after ${program.expiryDays} days.` : "Earned points do not expire."}`
              : "Configure earning rules and rewards to activate your club."}
          </p>
          <Badge tone={program?.enabled ? "green" : "neutral"}>
            {program?.enabled ? "Program active" : "Program paused"}
          </Badge>
          <p className="field-help">
            Returns reconcile the original award. Spent points can create a
            negative balance after a refund; new awards clear that balance
            before redemption.
          </p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Rewards worth returning for.</h2>
            {manager && (
              <Button
                variant="secondary"
                onClick={() => {
                  setForm("reward");
                  setError(null);
                }}
              >
                Add reward
              </Button>
            )}
          </div>
          {overview.data?.rewards.map((r) => (
            <div className="store-row" key={r.id}>
              <div>
                <strong>{r.name}</strong>
                <small>
                  {r.pointsCost} points →{" "}
                  <Money value={r.discountValue} currency={currency} />
                </small>
              </div>
              <Badge tone={r.active ? "green" : "neutral"}>
                {r.active ? "Active" : "Paused"}
              </Badge>
              {manager && (
                <Button
                  disabled={pending}
                  variant="ghost"
                  onClick={async () => {
                    setPending(true);
                    setError(null);
                    try {
                      await mutate(
                        `/rewards/${r.id}`,
                        { active: !r.active },
                        "PATCH",
                      );
                      await refresh();
                    } catch (err) {
                      setError(err);
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  {r.active ? "Pause" : "Activate"}
                </Button>
              )}
            </div>
          ))}
          {!overview.data?.rewards.length && (
            <EmptyState title="A reward starts with a reason.">
              Create a configurable points-to-voucher reward.
            </EmptyState>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="filterbar">
          <strong>Your members</strong>
          <input
            aria-label="Find a membership"
            placeholder="Name, email or scanned membership code"
            value={q}
            onChange={(e) => {
              setQ(e.target.value.replace(/^innovia:member:[^:]+:/, ""));
              setPage(1);
            }}
          />
        </div>
        {accounts.isPending ? (
          <Loading />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Tier</th>
                  <th>Available points</th>
                  <th>Lifetime earned</th>
                  <th>Membership</th>
                </tr>
              </thead>
              <tbody>
                {accounts.data?.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.customer.name}</strong>
                      <small>{a.customer.email}</small>
                    </td>
                    <td>
                      {[...(program?.tiers ?? [])]
                        .reverse()
                        .find((t) => a.lifetimePoints >= t.threshold)?.name ??
                        "Member"}
                    </td>
                    <td>{a.points}</td>
                    <td>{a.lifetimePoints}</td>
                    <td>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSelected(a);
                          setError(null);
                        }}
                      >
                        View membership
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!accounts.data?.total && (
              <EmptyState title="Your community awaits.">
                Enroll a customer after obtaining their consent.
              </EmptyState>
            )}
          </div>
        )}
        <Pagination
          page={page}
          total={accounts.data?.total ?? 0}
          onChange={setPage}
        />
      </section>
      {form && (
        <Modal
          title={
            form === "program"
              ? "Define your members club."
              : form === "reward"
                ? "A reason to return."
                : "Welcome a new member."
          }
          onClose={() => setForm(null)}
          wide={form === "program"}
        >
          <form className="modal-body" onSubmit={submit}>
            <fieldset disabled={pending}>
              {form === "program" ? (
                <>
                  <div className="form-grid">
                    <label className="span-2">
                      Program name
                      <input
                        name="name"
                        required
                        defaultValue={program?.name ?? "Members club"}
                      />
                    </label>
                    <label>
                      Spend unit ({currency})
                      <input
                        name="spendUnit"
                        inputMode="decimal"
                        required
                        defaultValue={program?.spendUnit ?? "10.00"}
                      />
                    </label>
                    <label>
                      Points per spend unit
                      <input
                        name="pointsPerUnit"
                        type="number"
                        min={1}
                        max={10000}
                        required
                        defaultValue={program?.pointsPerUnit ?? 1}
                      />
                    </label>
                    <label>
                      Point expiry in days
                      <input
                        name="expiryDays"
                        type="number"
                        min={0}
                        max={3650}
                        defaultValue={program?.expiryDays ?? 365}
                        required
                      />
                      <small>
                        0 disables expiration for newly earned points.
                      </small>
                    </label>
                    <label className="check-label">
                      <input
                        name="enabled"
                        type="checkbox"
                        defaultChecked={program?.enabled ?? false}
                      />
                      Activate this program
                    </label>
                  </div>
                  <h3>Membership tiers</h3>
                  {tiers.map((tier, i) => (
                    <div className="variant-editor" key={i}>
                      <div className="form-grid">
                        <label>
                          Tier name
                          <input
                            required
                            value={tier.name}
                            onChange={(e) =>
                              setTiers((old) =>
                                old.map((t, j) =>
                                  i === j ? { ...t, name: e.target.value } : t,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Lifetime points threshold
                          <input
                            required
                            type="number"
                            min={0}
                            max={100000000}
                            value={tier.threshold}
                            onChange={(e) =>
                              setTiers((old) =>
                                old.map((t, j) =>
                                  i === j
                                    ? {
                                        ...t,
                                        threshold: Number(e.target.value),
                                      }
                                    : t,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Earning multiplier
                          <input
                            type="number"
                            min={1}
                            max={10}
                            required
                            value={tier.multiplier}
                            onChange={(e) =>
                              setTiers((old) =>
                                old.map((t, j) =>
                                  i === j
                                    ? {
                                        ...t,
                                        multiplier: Number(e.target.value),
                                      }
                                    : t,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Benefits description
                          <input
                            value={tier.benefits}
                            maxLength={1000}
                            onChange={(e) =>
                              setTiers((old) =>
                                old.map((t, j) =>
                                  i === j
                                    ? { ...t, benefits: e.target.value }
                                    : t,
                                ),
                              )
                            }
                          />
                        </label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setTiers((old) => old.filter((_, j) => i !== j))
                        }
                      >
                        Remove tier
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={tiers.length >= 10}
                    onClick={() =>
                      setTiers((old) => [
                        ...old,
                        { name: "", threshold: 0, multiplier: 1, benefits: "" },
                      ])
                    }
                  >
                    Add tier
                  </Button>
                  <p className="field-help">
                    Earning multipliers apply automatically. Other listed
                    benefits are service commitments managed by your boutique.
                  </p>
                </>
              ) : form === "reward" ? (
                <div className="form-grid">
                  <label className="span-2">
                    Reward name
                    <input required name="name" maxLength={100} />
                  </label>
                  <label>
                    Points cost
                    <input
                      required
                      name="pointsCost"
                      type="number"
                      min={1}
                      max={100000000}
                    />
                  </label>
                  <label>
                    Voucher value ({currency})
                    <input name="discountValue" inputMode="decimal" required />
                  </label>
                </div>
              ) : (
                <>
                  <label>
                    Find an existing customer
                    <input
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                  </label>
                  <label>
                    Customer
                    <select required name="customerId">
                      <option value="">Select a customer</option>
                      {customers.data?.items.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name} · {c.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="check-label">
                    <input name="consent" required type="checkbox" />
                    The customer agreed to join this loyalty program.
                  </label>
                  <small>
                    Membership consent does not authorize marketing messages.
                  </small>
                </>
              )}
              <Notice error={error} />
              <Button type="submit">
                {pending
                  ? "Saving…"
                  : form === "program"
                    ? "Save program"
                    : form === "reward"
                      ? "Create reward"
                      : "Enroll customer"}
              </Button>
            </fieldset>
          </form>
        </Modal>
      )}
      {account && (
        <Modal
          title={`${account.customer.name} · membership`}
          onClose={() => setSelected(null)}
          wide
        >
          <div className="modal-body">
            <div className="loyalty-card">
              <span className="eyebrow">{session.tenant!.name}</span>
              <h2>{program?.name ?? "Members club"}</h2>
              <strong>{account.customer.name}</strong>
              <span>
                {[...(program?.tiers ?? [])]
                  .reverse()
                  .find((t) => account.lifetimePoints >= t.threshold)?.name ??
                  "Member"}{" "}
                · {account.points} points
              </span>
              {qr && (
                <img
                  src={qr}
                  width={160}
                  height={160}
                  alt="Membership identification QR code"
                />
              )}
              <small>{account.cardCode}</small>
            </div>
            <Notice error={error || detail.error} />
            <p>
              Vouchers are single-use and linked to {account.customer.email}.
              Enter this email and the voucher code at checkout.
            </p>
            <div className="action-row">
              {overview.data?.rewards
                .filter((r) => r.active)
                .map((r) => (
                  <Button
                    key={r.id}
                    variant="secondary"
                    disabled={
                      pending ||
                      account.points < r.pointsCost ||
                      !program?.enabled
                    }
                    onClick={() => redeem(r.id)}
                  >
                    Redeem {r.name} · {r.pointsCost} points
                  </Button>
                ))}
            </div>
            {account.redemptions?.map((r) => (
              <div className="store-row" key={r.id}>
                <span>
                  <strong>
                    {r.reward.name} ·{" "}
                    <Money value={r.discountValue} currency={currency} />
                  </strong>
                  <small>{r.code}</small>
                </span>
                <Badge>{r.status}</Badge>
              </div>
            ))}
            <h3>Points ledger</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Points</th>
                    <th>Reason</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {account.entries?.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.type}</td>
                      <td>
                        {entry.points > 0 ? "+" : ""}
                        {entry.points}
                      </td>
                      <td>{entry.reason}</td>
                      <td>{new Date(entry.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {manager && (
              <form className="variant-editor" onSubmit={adjust}>
                <h3>Audited correction</h3>
                <div className="form-grid">
                  <label>
                    Points adjustment
                    <input
                      name="points"
                      type="number"
                      min={-1000000}
                      max={1000000}
                      required
                    />
                  </label>
                  <label>
                    Reason
                    <input
                      name="reason"
                      minLength={3}
                      maxLength={500}
                      required
                    />
                  </label>
                </div>
                <Button disabled={pending} type="submit" variant="secondary">
                  Record correction
                </Button>
              </form>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
