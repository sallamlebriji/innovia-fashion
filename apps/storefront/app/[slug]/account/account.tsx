"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Order } from "@innovia/types";
import { ShoppingPreferences } from "./preferences";
import { AccountRecovery } from "@innovia/ui";
type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthday: string | null;
};
type Address = {
  id: string;
  label: string;
  recipient: string;
  street: string;
  city: string;
  postalCode: string;
  phone: string;
  country: string;
};
type Membership = {
  currency: string;
  account: null | {
    points: number;
    lifetimePoints: number;
    cardCode: string;
    entries: {
      id: string;
      reason: string;
      points: number;
      createdAt: string;
    }[];
    redemptions: {
      id: string;
      code: string;
      status: string;
      discountValue: string;
      reward: { name: string };
    }[];
  };
  program: null | {
    name: string;
    enabled: boolean;
    tiers: { id: string; name: string; threshold: number; benefits: string }[];
  };
  rewards: {
    id: string;
    name: string;
    pointsCost: number;
    discountValue: string;
  }[];
};
type Wishlist = {
  id: string;
  productId: string;
  product: { id: string; name: string; imageUrl: string };
};
type Notification = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Please try again.";
export function Account({
  slug,
  locale = "en",
}: {
  slug: string;
  locale?: string;
}) {
  const [customer, setCustomer] = useState<Customer | null>(null),
    [ready, setReady] = useState(false),
    [register, setRegister] = useState(false),
    [tab, setTab] = useState("Orders"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState(false);
  const [orders, setOrders] = useState<{ items: Order[]; total: number }>({
      items: [],
      total: 0,
    }),
    [page, setPage] = useState(1),
    [addresses, setAddresses] = useState<Address[]>([]),
    [wishlist, setWishlist] = useState<Wishlist[]>([]),
    [membership, setMembership] = useState<Membership | null>(null),
    [notifications, setNotifications] = useState<Notification[]>([]),
    [consents, setConsents] = useState<{ purpose: string; granted: boolean }[]>(
      [],
    );
  const csrf = useRef("");
  const api = useCallback(
    async <T,>(
      path: string,
      method = "GET",
      body?: unknown,
      key?: string,
    ): Promise<T> => {
      const response = await fetch(
        `/api/v1/storefront/${encodeURIComponent(slug)}/customer${path}`,
        {
          credentials: "include",
          cache: "no-store",
          method,
          headers: {
            "Content-Type": "application/json",
            ...(csrf.current ? { "X-CSRF-Token": csrf.current } : {}),
            ...(key ? { "Idempotency-Key": key } : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message ?? "Please try again.");
      return data;
    },
    [slug],
  );
  const load = useCallback(async () => {
    if (!customer) return;
    if (tab === "Orders") setOrders(await api(`/orders?page=${page}`));
    if (tab === "Addresses") setAddresses(await api("/addresses"));
    if (tab === "Wishlist") setWishlist(await api("/wishlist"));
    if (tab === "Membership") setMembership(await api("/loyalty"));
    if (tab === "Messages") setNotifications(await api("/notifications"));
    if (tab === "Profile") setConsents(await api("/consents"));
  }, [api, customer, tab, page]);
  useEffect(() => {
    let current = true;
    api<{ customer: Customer; csrfToken: string }>("/me")
      .then((data) => {
        if (current) {
          csrf.current = data.csrfToken;
          setCustomer(data.customer);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (current) setReady(true);
      });
    return () => {
      current = false;
    };
  }, [api]);
  useEffect(() => {
    load().catch((err) => setError(message(err)));
  }, [load]);
  async function action(work: () => Promise<unknown>, success = "Saved.") {
    setPending(true);
    setError("");
    setNotice("");
    try {
      await work();
      await load();
      setNotice(success);
    } catch (err) {
      setError(message(err));
    } finally {
      setPending(false);
    }
  }
  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await action(async () => {
      const session = await api<{ customer: Customer; csrfToken: string }>(
        register ? "/register" : "/login",
        "POST",
        {
          ...data,
          ...(register ? { termsAccepted: data.termsAccepted === "on" } : {}),
          client: "web",
        },
      );
      csrf.current = session.csrfToken;
      setCustomer(session.customer);
    }, "Welcome to your boutique account.");
  }
  const money = (value: string, currency = "MAD") =>
    new Intl.NumberFormat("en-MA", { style: "currency", currency }).format(
      Number(value),
    );
  return (
    <main className="account-shell">
      <a className="store-wordmark" href={`/${slug}`}>
        ← Back to the boutique
      </a>
      <div className="account-heading">
        <span className="store-eyebrow">YOUR BOUTIQUE ACCOUNT</span>
        <h1>
          {customer
            ? `Hello, ${customer.name.split(" ")[0]}.`
            : "A place for your favourites."}
        </h1>
        <p>Your orders, personal edit, and membership in one place.</p>
      </div>
      {error && (
        <p className="store-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="account-notice" role="status">
          {notice}
        </p>
      )}
      {!ready ? (
        <p>Opening your account…</p>
      ) : !customer ? (
        <div className="account-login">
          <div>
            <h2>{register ? "Join your boutique." : "Welcome back."}</h2>
            <p>Each boutique has its own customer account.</p>
          </div>
          <form className="store-checkout" onSubmit={authenticate}>
            <fieldset disabled={pending}>
              {register && (
                <>
                  <label>
                    Your name
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={100}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Moroccan phone
                    <input
                      name="phone"
                      type="tel"
                      required
                      pattern="(\+212|0)[5-7][0-9]{8}"
                      autoComplete="tel"
                    />
                  </label>
                </>
              )}
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={register ? 12 : 1}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                />
              </label>
              {register && (
                <label className="account-check">
                  <input name="termsAccepted" type="checkbox" required />I agree
                  to create a boutique account. My contact details are used for
                  my orders and account; marketing is optional.
                </label>
              )}
              <button className="store-cta dark">
                {pending
                  ? "Please wait…"
                  : register
                    ? "Create account"
                    : "Sign in"}
              </button>
            </fieldset>
          </form>
          <button
            className="account-text-button"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register
              ? "Already a member? Sign in"
              : "New here? Create an account"}
          </button>
          <AccountRecovery
            locale={locale}
            endpoint={`/api/v1/storefront/${encodeURIComponent(slug)}/customer/recovery`}
          />
        </div>
      ) : (
        <>
          <nav className="account-tabs" aria-label="Account pages">
            {[
              "Orders",
              "Wishlist",
              "Membership",
              "Addresses",
              "Messages",
              "Profile",
            ].map((name) => (
              <button
                key={name}
                className={tab === name ? "active" : ""}
                onClick={() => {
                  setTab(name);
                  setError("");
                  setNotice("");
                }}
              >
                {name}
              </button>
            ))}
            <button
              disabled={pending}
              onClick={() =>
                action(async () => {
                  await api("/logout", "POST", {});
                  csrf.current = "";
                  setCustomer(null);
                }, "Signed out.")
              }
            >
              Sign out
            </button>
          </nav>
          <section className="account-content">
            {tab === "Orders" && (
              <>
                <h2>Your orders</h2>
                {orders.items.length === 0 && (
                  <p>Your first favourite is waiting in the collection.</p>
                )}
                {orders.items.map((order) => (
                  <article className="account-order" key={order.id}>
                    <div>
                      <strong>{order.number}</strong>
                      <span>
                        {new Date(order.createdAt).toLocaleDateString()} ·{" "}
                        {order.store.name}
                      </span>
                      <b>{order.status.replaceAll("_", " ")}</b>
                    </div>
                    {order.items.map((line) => (
                      <p key={line.id}>
                        {line.name} · {line.sku} × {line.quantity}
                        {line.returnedQuantity
                          ? ` (${line.returnedQuantity} returned)`
                          : ""}
                      </p>
                    ))}
                    <p>
                      Total: {money(order.total, order.currency)}
                      {Number(order.refundedTotal ?? 0) > 0 &&
                        ` · Refunded: ${money(order.refundedTotal!, order.currency)}`}
                    </p>
                    {order.reservationExpiresAt && (
                      <p>
                        Reserved until{" "}
                        {new Date(order.reservationExpiresAt).toLocaleString()}
                      </p>
                    )}
                    {order.carrier && (
                      <p>
                        {order.carrier}: {order.trackingNumber}
                      </p>
                    )}
                    <small>
                      For a return or exchange, contact your boutique with this
                      order number.
                    </small>
                  </article>
                ))}
                {orders.total > 24 && (
                  <div className="store-pagination">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </button>
                    <span>
                      {page} / {Math.ceil(orders.total / 24)}
                    </span>
                    <button
                      disabled={page * 24 >= orders.total}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
            {tab === "Wishlist" && (
              <>
                <h2>Your personal edit</h2>
                <div className="account-wishlist">
                  {wishlist.map((item) => (
                    <article key={item.id}>
                      <a href={`/${slug}/products/${item.productId}`}>
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                        />
                        <h3>{item.product.name}</h3>
                      </a>
                      <button
                        disabled={pending}
                        onClick={() =>
                          action(
                            () => api(`/wishlist/${item.productId}`, "DELETE"),
                            "Piece removed.",
                          )
                        }
                      >
                        Remove
                      </button>
                    </article>
                  ))}
                </div>
                {wishlist.length === 0 && (
                  <p>Save a piece from its product page to find it here.</p>
                )}
              </>
            )}
            {tab === "Membership" && membership && (
              <>
                <h2>{membership.program?.name ?? "Boutique membership"}</h2>
                {!membership.program?.enabled ? (
                  <p>The boutique’s membership program is currently paused.</p>
                ) : !membership.account ? (
                  <form
                    className="store-checkout"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const code = new FormData(event.currentTarget).get(
                        "referralCode",
                      );
                      action(
                        () =>
                          api("/loyalty/enroll", "POST", {
                            consent: true,
                            ...(code ? { referralCode: code } : {}),
                          }),
                        "You’re now a member.",
                      );
                    }}
                  >
                    <label className="account-check">
                      <input type="checkbox" required />I choose to join the
                      boutique’s loyalty program and accept its earning,
                      redemption, and expiry rules.
                    </label>
                    <label>
                      Referral code (optional)
                      <input name="referralCode" maxLength={100} />
                    </label>
                    <button className="store-cta dark" disabled={pending}>
                      Join membership
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="member-card">
                      <span className="store-eyebrow">
                        {membership.program.name}
                      </span>
                      <h3>{membership.account.points} points</h3>
                      <p>
                        {membership.program.tiers
                          .filter(
                            (tier) =>
                              tier.threshold <=
                              membership.account!.lifetimePoints,
                          )
                          .at(-1)?.name ?? "Member"}
                      </p>
                      <code>{membership.account.cardCode}</code>
                    </div>
                    <h3>Your rewards</h3>
                    <div className="account-rewards">
                      {membership.rewards.map((reward) => (
                        <article key={reward.id}>
                          <h3>{reward.name}</h3>
                          <p>
                            {reward.pointsCost} points ·{" "}
                            {money(reward.discountValue, membership.currency)}
                          </p>
                          <button
                            className="store-cta dark"
                            disabled={
                              pending ||
                              membership.account!.points < reward.pointsCost
                            }
                            onClick={() =>
                              action(
                                () =>
                                  api(
                                    "/loyalty/redeem",
                                    "POST",
                                    { rewardId: reward.id },
                                    crypto.randomUUID(),
                                  ),
                                "Your voucher is ready below.",
                              )
                            }
                          >
                            Redeem
                          </button>
                        </article>
                      ))}
                    </div>
                    <h3>Vouchers</h3>
                    {membership.account.redemptions.map((voucher) => (
                      <p className="account-voucher" key={voucher.id}>
                        <strong>{voucher.reward.name}</strong>
                        <code>{voucher.code}</code>
                        <span>
                          {voucher.status} ·{" "}
                          {money(voucher.discountValue, membership.currency)}
                        </span>
                      </p>
                    ))}
                    <h3>Points history</h3>
                    {membership.account.entries.map((entry) => (
                      <p className="account-ledger" key={entry.id}>
                        <span>
                          {entry.reason} ·{" "}
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                        <b>
                          {entry.points > 0 ? "+" : ""}
                          {entry.points}
                        </b>
                      </p>
                    ))}
                  </>
                )}
              </>
            )}
            {tab === "Addresses" && (
              <>
                <h2>Your saved addresses</h2>
                <div className="account-addresses">
                  {addresses.map((address) => (
                    <article key={address.id}>
                      <h3>{address.label}</h3>
                      <p>
                        {address.recipient}
                        <br />
                        {address.street}
                        <br />
                        {address.city} {address.postalCode}
                        <br />
                        {address.phone}
                      </p>
                      <button
                        disabled={pending}
                        onClick={() =>
                          action(
                            () => api(`/addresses/${address.id}`, "DELETE"),
                            "Address removed.",
                          )
                        }
                      >
                        Remove
                      </button>
                    </article>
                  ))}
                </div>
                <h3>Add an address</h3>
                <form
                  className="store-checkout account-form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget,
                      data = Object.fromEntries(new FormData(form));
                    action(async () => {
                      await api("/addresses", "POST", {
                        ...data,
                        country: "MA",
                      });
                      form.reset();
                    }, "Address saved.");
                  }}
                >
                  <label>
                    Label
                    <input
                      name="label"
                      required
                      minLength={2}
                      placeholder="Home"
                    />
                  </label>
                  <label>
                    Recipient
                    <input
                      name="recipient"
                      required
                      minLength={2}
                      defaultValue={customer.name}
                    />
                  </label>
                  <label className="account-wide">
                    Street and apartment
                    <input
                      name="street"
                      required
                      minLength={5}
                      maxLength={500}
                      autoComplete="street-address"
                    />
                  </label>
                  <label>
                    City
                    <input
                      name="city"
                      required
                      minLength={2}
                      autoComplete="address-level2"
                    />
                  </label>
                  <label>
                    Postal code
                    <input
                      name="postalCode"
                      required
                      pattern="[0-9]{5}"
                      autoComplete="postal-code"
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      name="phone"
                      required
                      pattern="(\+212|0)[5-7][0-9]{8}"
                      defaultValue={customer.phone}
                    />
                  </label>
                  <button
                    className="store-cta dark"
                    disabled={pending || addresses.length >= 10}
                  >
                    Save address
                  </button>
                </form>
              </>
            )}
            {tab === "Messages" && (
              <>
                <h2>Your boutique messages</h2>
                {notifications.length === 0 && <p>No messages yet.</p>}
                {notifications.map((item) => (
                  <article className="account-order" key={item.id}>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    <small>{new Date(item.createdAt).toLocaleString()}</small>
                    {!item.readAt && (
                      <button
                        disabled={pending}
                        onClick={() =>
                          action(
                            () => api(`/notifications/${item.id}`, "PATCH", {}),
                            "Message marked as read.",
                          )
                        }
                      >
                        Mark as read
                      </button>
                    )}
                  </article>
                ))}
              </>
            )}
            {tab === "Profile" && (
              <>
                <h2>Your details</h2>
                <form
                  className="store-checkout account-form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = Object.fromEntries(
                      new FormData(event.currentTarget),
                    );
                    action(async () =>
                      setCustomer(
                        await api("/profile", "PATCH", {
                          name: data.name,
                          phone: data.phone,
                          birthday: data.birthday || null,
                        }),
                      ),
                    );
                  }}
                >
                  <label>
                    Name
                    <input
                      name="name"
                      defaultValue={customer.name}
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      name="phone"
                      defaultValue={customer.phone}
                      required
                      pattern="(\+212|0)[5-7][0-9]{8}"
                    />
                  </label>
                  <label>
                    Birthday (optional)
                    <input
                      type="date"
                      name="birthday"
                      defaultValue={customer.birthday?.slice(0, 10)}
                      max={new Date().toISOString().slice(0, 10)}
                    />
                  </label>
                  <label>
                    Email
                    <input disabled value={customer.email} />
                  </label>
                  <button className="store-cta dark" disabled={pending}>
                    Save details
                  </button>
                </form>
                <ShoppingPreferences slug={slug} csrf={csrf.current} />
                <h3>Your choices</h3>
                <p>
                  Marketing is optional. These choices are separate from
                  transactional order messages.
                </p>
                {[
                  "IN_APP_MARKETING",
                  "EMAIL_MARKETING",
                  "SMS_MARKETING",
                  "PUSH_MARKETING",
                ].map((purpose) => (
                  <label className="account-check" key={purpose}>
                    <input
                      type="checkbox"
                      disabled={pending}
                      checked={
                        consents.find((item) => item.purpose === purpose)
                          ?.granted ?? false
                      }
                      onChange={(event) =>
                        action(
                          () =>
                            api("/consents", "PUT", {
                              purpose,
                              granted: event.target.checked,
                            }),
                          "Preference saved.",
                        )
                      }
                    />
                    {purpose.replaceAll("_", " ")}
                  </label>
                ))}
                <button
                  className="account-text-button"
                  disabled={pending}
                  onClick={() =>
                    action(async () => {
                      const data = await api("/export");
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(data, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `${slug}-my-data.json`;
                      link.click();
                      URL.revokeObjectURL(url);
                    }, "Your data export is ready.")
                  }
                >
                  Download my account data
                </button>
                <details className="account-delete">
                  <summary>Delete my account</summary>
                  <p>
                    This signs you out, removes your saved details, and cancels
                    unused vouchers. Anonymized financial and audit records are
                    retained. Finish or cancel active orders first.
                  </p>
                  <form
                    className="store-checkout"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = Object.fromEntries(
                        new FormData(event.currentTarget),
                      );
                      action(async () => {
                        await api("/account", "DELETE", {
                          password: data.password,
                        });
                        setCustomer(null);
                        csrf.current = "";
                      }, "Your account has been deleted.");
                    }}
                  >
                    <label>
                      Current password
                      <input
                        type="password"
                        name="password"
                        required
                        autoComplete="current-password"
                      />
                    </label>
                    <label className="account-check">
                      <input type="checkbox" required />I understand that my
                      account will be deleted.
                    </label>
                    <button className="store-cta dark" disabled={pending}>
                      Delete account
                    </button>
                  </form>
                </details>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
