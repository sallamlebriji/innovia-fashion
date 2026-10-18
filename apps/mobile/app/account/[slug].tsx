import { useWords } from "../../src/locale";
import { useEffect, useState } from "react";
import { Text, View, Pressable, Switch, Share } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";
import * as Crypto from "expo-crypto";
import { api, restoreSession, saveSession, clearSession } from "../../src/api";
import { registerPush, unregisterPush } from "../../src/push";
import { type Boutique, money } from "../../src/state";
import {
  Screen,
  Title,
  Action,
  Field,
  Loading,
  ErrorText,
  styles,
} from "../../src/ui";
type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthday: string | null;
  preferences?: {
    sizes: string[];
    categories: string[];
    preferredStoreId: string | null;
  } | null;
};
type AccountData = {
  orders?: {
    items: {
      id: string;
      number: string;
      status: string;
      total: string;
      currency: string;
      deliveryStatus: string;
      carrier: string;
      trackingNumber: string;
      items: { id: string; name: string; quantity: number }[];
    }[];
    total: number;
  };
  wishlist?: { id: string; product: { id: string; name: string } }[];
  loyalty?: {
    account: null | {
      points: number;
      lifetimePoints: number;
      cardCode: string;
      entries: { id: string; points: number; reason: string }[];
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
      tiers: { name: string; threshold: number; benefits: string }[];
    };
    rewards: {
      id: string;
      name: string;
      pointsCost: number;
      discountValue: string;
    }[];
  };
  addresses?: {
    id: string;
    label: string;
    street: string;
    city: string;
    postalCode: string;
    recipient: string;
    phone: string;
  }[];
  notifications?: {
    id: string;
    title: string;
    body: string;
    readAt: string | null;
  }[];
  consents?: { purpose: string; granted: boolean }[];
};
export default function Account() {
  const t = useWords();

  const { slug } = useLocalSearchParams<{ slug: string }>(),
    client = useQueryClient(),
    path = `/storefront/${slug}/customer`;
  const [ready, setReady] = useState(false),
    [customer, setCustomer] = useState<Customer | null>(null),
    [register, setRegister] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [password, setPassword] = useState(""),
    [birthday, setBirthday] = useState(""),
    [consent, setConsent] = useState(false),
    [referralCode, setReferralCode] = useState(""),
    [deleteConsent, setDeleteConsent] = useState(false),
    [tab, setTab] = useState<keyof AccountData>("orders"),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [page, setPage] = useState(1);
  const [label, setLabel] = useState("Home"),
    [street, setStreet] = useState(""),
    [city, setCity] = useState(""),
    [postalCode, setPostalCode] = useState("");
  const [sizes, setSizes] = useState(""),
    [categories, setCategories] = useState(""),
    [preferredStoreId, setPreferredStoreId] = useState<string | null>(null);
  const boutique = useQuery({
      queryKey: ["boutique", slug],
      queryFn: () => api<Boutique>(`/storefront/${slug}`),
    }),
    currency = boutique.data?.tenant.currency ?? "MAD";
  useEffect(() => {
    let current = true;
    restoreSession(slug)
      .then(() => api<{ customer: Customer }>(`${path}/me`, slug))
      .then((result) => {
        if (current) {
          setCustomer(result.customer);
          setName(result.customer.name);
          setEmail(result.customer.email);
          setPhone(result.customer.phone);
          setBirthday(result.customer.birthday?.slice(0, 10) ?? "");
          setSizes(result.customer.preferences?.sizes.join(", ") ?? "");
          setCategories(
            result.customer.preferences?.categories.join(", ") ?? "",
          );
          setPreferredStoreId(
            result.customer.preferences?.preferredStoreId ?? null,
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (current) setReady(true);
      });
    return () => {
      current = false;
    };
  }, [path, slug]);
  const query = useQuery({
    queryKey: ["account", slug, customer?.id, tab, page],
    enabled: ready && !!customer,
    queryFn: async () =>
      ({
        [tab]: await api(
          `${path}/${tab}${tab === "orders" ? `?page=${page}` : ""}`,
          slug,
        ),
      }) as AccountData,
  });
  async function action(work: () => Promise<unknown>, success = "Saved.") {
    setPending(true);
    setError(null);
    setNotice("");
    try {
      await work();
      await client.invalidateQueries({ queryKey: ["account", slug] });
      setNotice(success);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  async function authenticate() {
    await action(async () => {
      const result = await api<{ customer: Customer; token: string }>(
        `${path}/${register ? "register" : "login"}`,
        undefined,
        "POST",
        {
          name,
          email,
          phone,
          password,
          client: "native",
          ...(register ? { termsAccepted: consent } : {}),
        },
      );
      await saveSession(slug, result.token);
      setCustomer(result.customer);
      setName(result.customer.name);
      setPhone(result.customer.phone);
      setBirthday(result.customer.birthday?.slice(0, 10) ?? "");
      setSizes(result.customer.preferences?.sizes.join(", ") ?? "");
      setCategories(result.customer.preferences?.categories.join(", ") ?? "");
      setPreferredStoreId(
        result.customer.preferences?.preferredStoreId ?? null,
      );
      setPassword("");
      client.removeQueries({ queryKey: ["account", slug] });
    }, "Welcome to your boutique account.");
  }
  const membership = query.data?.loyalty;
  return (
    <Screen>
      <Title
        eyebrow={boutique.data?.tenant.name}
        subtitle={t("Your purchases, membership, and personal edit.")}
      >
        {customer
          ? `${t("Hello")}, ${customer.name.split(" ")[0]}.`
          : t("A place for your favourites.")}
      </Title>
      <ErrorText error={error || query.error} />
      {notice && (
        <Text accessibilityRole="alert" style={styles.copy}>
          {t(notice)}
        </Text>
      )}
      {!ready ? (
        <Loading />
      ) : !customer ? (
        <>
          <Text style={styles.heading}>
            {register ? t("Join your boutique") : t("Welcome back")}
          </Text>
          {register && (
            <>
              <Field label={t("Your name")} value={name} onChange={setName} />
              <Field
                label={t("Moroccan phone")}
                value={phone}
                onChange={setPhone}
                type="phone-pad"
              />
            </>
          )}
          <Field
            label={t("Email address")}
            value={email}
            onChange={setEmail}
            type="email-address"
          />
          <Field
            label={t("Password")}
            value={password}
            onChange={setPassword}
            secure
          />
          {register && (
            <View style={styles.row}>
              <Text style={[styles.copy, { flex: 1 }]}>
                {t(
                  "I agree to create a boutique account. Marketing is optional.",
                )}{" "}
              </Text>
              <Switch
                accessibilityLabel={t("Accept account terms")}
                value={consent}
                onValueChange={setConsent}
              />
            </View>
          )}
          <Action
            disabled={pending || (register && !consent)}
            onPress={authenticate}
          >
            {pending
              ? t("Please wait…")
              : register
                ? t("Create account")
                : t("Sign in")}
          </Action>
          <Action
            secondary
            disabled={pending}
            onPress={() =>
              action(async () => {
                const result = await api<{ message: string }>(
                  `${path}/recovery/request`,
                  undefined,
                  "POST",
                  { email },
                );
                setNotice(result.message);
              }, "If this email has an account, its recovery link will be sent.")
            }
          >
            {t("Recover your account by email")}
          </Action>
          <Action
            secondary
            onPress={() => {
              setRegister(!register);
              setError(null);
            }}
          >
            {register
              ? t("Already a member? Sign in")
              : t("New here? Create an account")}
          </Action>
        </>
      ) : (
        <>
          <View style={styles.chips}>
            {(
              [
                "orders",
                "wishlist",
                "loyalty",
                "addresses",
                "notifications",
                "consents",
              ] as const
            ).map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item}
                style={[styles.chip, tab === item && styles.chipActive]}
                onPress={() => {
                  setTab(item);
                  setError(null);
                }}
              >
                <Text>
                  {item === "loyalty"
                    ? t("Membership")
                    : item === "consents"
                      ? t("Profile")
                      : t(item[0].toUpperCase() + item.slice(1))}
                </Text>
              </Pressable>
            ))}
          </View>
          {query.isPending ? (
            <Loading />
          ) : (
            <>
              {tab === "orders" && (
                <>
                  {query.data?.orders?.items.map((order) => (
                    <View style={styles.card} key={order.id}>
                      <Text style={styles.heading}>{order.number}</Text>
                      <Text style={styles.eyebrow}>{t(order.status)}</Text>
                      {order.items.map((line) => (
                        <Text key={line.id}>
                          {line.name} × {line.quantity}
                        </Text>
                      ))}
                      <Text>{money(order.total, order.currency)}</Text>
                      {order.carrier && (
                        <Text>
                          {order.carrier}: {order.trackingNumber}
                        </Text>
                      )}
                      <Text style={styles.copy}>
                        {t(
                          "Contact your boutique with this number for returns and exchanges.",
                        )}{" "}
                      </Text>
                    </View>
                  ))}
                  {query.data?.orders?.total === 0 && (
                    <Text style={styles.copy}>
                      {t(
                        "Your first favourite is waiting in the collection.",
                      )}{" "}
                    </Text>
                  )}
                  {(query.data?.orders?.total ?? 0) > 24 && (
                    <View style={styles.row}>
                      <Action
                        secondary
                        disabled={page === 1}
                        onPress={() => setPage(page - 1)}
                      >
                        {t("Previous")}
                      </Action>
                      <Text>{page}</Text>
                      <Action
                        secondary
                        disabled={page * 24 >= (query.data?.orders?.total ?? 0)}
                        onPress={() => setPage(page + 1)}
                      >
                        {t("Next")}
                      </Action>
                    </View>
                  )}
                </>
              )}
              {tab === "wishlist" &&
                query.data?.wishlist?.map((item) => (
                  <View style={styles.card} key={item.id}>
                    <Text style={styles.heading}>{item.product.name}</Text>
                    <Action
                      secondary
                      onPress={() =>
                        router.push({
                          pathname: "/product/[slug]/[id]",
                          params: { slug, id: item.product.id },
                        })
                      }
                    >
                      {t("View piece")}
                    </Action>
                    <Action
                      secondary
                      disabled={pending}
                      onPress={() =>
                        action(
                          () =>
                            api(
                              `${path}/wishlist/${item.product.id}`,
                              slug,
                              "DELETE",
                            ),
                          "Piece removed.",
                        )
                      }
                    >
                      {t("Remove from personal edit")}
                    </Action>
                  </View>
                ))}
              {tab === "loyalty" &&
                membership &&
                (!membership.program?.enabled ? (
                  <Text style={styles.copy}>
                    {t(
                      "Your boutique’s membership program is currently paused.",
                    )}{" "}
                  </Text>
                ) : !membership.account ? (
                  <>
                    <View style={styles.row}>
                      <Text style={[styles.copy, { flex: 1 }]}>
                        {t(
                          "I choose to join the loyalty program and accept its earning, redemption, and expiry rules.",
                        )}{" "}
                      </Text>
                      <Switch
                        accessibilityLabel={t("Consent to membership")}
                        value={consent}
                        onValueChange={setConsent}
                      />
                    </View>
                    <Field
                      label={t("Referral code (optional)")}
                      value={referralCode}
                      onChange={setReferralCode}
                    />
                    <Action
                      disabled={pending || !consent}
                      onPress={() =>
                        action(
                          () =>
                            api(`${path}/loyalty/enroll`, slug, "POST", {
                              consent: true,
                              ...(referralCode ? { referralCode } : {}),
                            }),
                          "You’re now a member.",
                        )
                      }
                    >
                      {t("Join membership")}
                    </Action>
                  </>
                ) : (
                  <>
                    <View
                      style={{
                        backgroundColor: "#242424",
                        padding: 28,
                        marginVertical: 20,
                        gap: 20,
                      }}
                    >
                      <Text style={[styles.eyebrow, { color: "#c6a87c" }]}>
                        {membership.program.name}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "serif",
                          fontSize: 40,
                          color: "#f8f6f2",
                        }}
                      >
                        {membership.account.points} {t("points")}{" "}
                      </Text>
                      <Text style={{ color: "#f8f6f2" }}>
                        {membership.program.tiers
                          .filter(
                            (tier) =>
                              tier.threshold <=
                              membership.account!.lifetimePoints,
                          )
                          .at(-1)?.name ?? "Member"}
                      </Text>
                      <View
                        style={{
                          backgroundColor: "white",
                          padding: 15,
                          alignSelf: "flex-start",
                        }}
                      >
                        <QRCode
                          value={membership.account.cardCode}
                          size={140}
                        />
                      </View>
                      <Text
                        selectable
                        style={{ fontSize: 10, color: "#f8f6f2" }}
                      >
                        {membership.account.cardCode}
                      </Text>
                    </View>
                    <Text style={styles.heading}>{t("Your rewards")}</Text>
                    {membership.rewards.map((reward) => (
                      <View style={styles.card} key={reward.id}>
                        <Text>{reward.name}</Text>
                        <Text style={styles.copy}>
                          {reward.pointsCost} {t("points ·")}{" "}
                          {money(reward.discountValue, currency)}
                        </Text>
                        <Action
                          disabled={
                            pending ||
                            membership.account!.points < reward.pointsCost
                          }
                          onPress={() =>
                            action(
                              () =>
                                api(
                                  `${path}/loyalty/redeem`,
                                  slug,
                                  "POST",
                                  { rewardId: reward.id },
                                  Crypto.randomUUID(),
                                ),
                              "Your voucher is ready.",
                            )
                          }
                        >
                          {t("Redeem reward")}
                        </Action>
                      </View>
                    ))}
                    <Text style={[styles.heading, { marginTop: 30 }]}>
                      {t("Vouchers")}{" "}
                    </Text>
                    {membership.account.redemptions.map((voucher) => (
                      <View style={styles.card} key={voucher.id}>
                        <Text>
                          {voucher.reward.name} · {t(voucher.status)}
                        </Text>
                        <Text selectable>{voucher.code}</Text>
                        <Text>{money(voucher.discountValue, currency)}</Text>
                      </View>
                    ))}
                    <Text style={[styles.heading, { marginTop: 30 }]}>
                      {t("Points history")}{" "}
                    </Text>
                    {membership.account.entries.map((entry) => (
                      <View style={styles.card} key={entry.id}>
                        <Text>{entry.reason}</Text>
                        <Text>
                          {entry.points > 0 ? "+" : ""}
                          {entry.points}
                        </Text>
                      </View>
                    ))}
                  </>
                ))}
              {tab === "addresses" && (
                <>
                  {query.data?.addresses?.map((address) => (
                    <View style={styles.card} key={address.id}>
                      <Text style={styles.heading}>{address.label}</Text>
                      <Text style={styles.copy}>
                        {address.recipient}
                        {"\n"}
                        {address.street}
                        {"\n"}
                        {address.city} {address.postalCode}
                        {"\n"}
                        {address.phone}
                      </Text>
                      <Action
                        secondary
                        disabled={pending}
                        onPress={() =>
                          action(
                            () =>
                              api(
                                `${path}/addresses/${address.id}`,
                                slug,
                                "DELETE",
                              ),
                            "Address removed.",
                          )
                        }
                      >
                        {t("Remove address")}
                      </Action>
                    </View>
                  ))}
                  <Text style={[styles.heading, { marginTop: 30 }]}>
                    {t("Add an address")}{" "}
                  </Text>
                  <Field
                    label={t("Address label")}
                    value={label}
                    onChange={setLabel}
                  />
                  <Field
                    label={t("Recipient")}
                    value={name}
                    onChange={setName}
                  />
                  <Field
                    label={t("Street and apartment")}
                    value={street}
                    onChange={setStreet}
                    multiline
                  />
                  <Field label={t("City")} value={city} onChange={setCity} />
                  <Field
                    label={t("Postal code")}
                    value={postalCode}
                    onChange={setPostalCode}
                    type="numeric"
                  />
                  <Field
                    label={t("Delivery phone")}
                    value={phone}
                    onChange={setPhone}
                    type="phone-pad"
                  />
                  <Action
                    disabled={pending}
                    onPress={() =>
                      action(async () => {
                        await api(`${path}/addresses`, slug, "POST", {
                          label,
                          recipient: name,
                          street,
                          city,
                          postalCode,
                          phone,
                          country: "MA",
                        });
                        setStreet("");
                        setPostalCode("");
                      })
                    }
                  >
                    {t("Save address")}
                  </Action>
                </>
              )}
              {tab === "notifications" && (
                <>
                  <Action
                    secondary
                    disabled={pending}
                    onPress={() =>
                      action(
                        () => registerPush(slug),
                        "Boutique notifications enabled for this device.",
                      )
                    }
                  >
                    {t("Enable device notifications")}
                  </Action>
                  <Action
                    secondary
                    disabled={pending}
                    onPress={() =>
                      action(
                        () => unregisterPush(slug),
                        "Device notifications disabled.",
                      )
                    }
                  >
                    {t("Disable device notifications")}
                  </Action>
                  {query.data?.notifications?.map((item) => (
                    <View style={styles.card} key={item.id}>
                      <Text style={styles.heading}>{item.title}</Text>
                      <Text style={styles.copy}>{item.body}</Text>
                      {!item.readAt && (
                        <Action
                          secondary
                          disabled={pending}
                          onPress={() =>
                            action(
                              () =>
                                api(
                                  `${path}/notifications/${item.id}`,
                                  slug,
                                  "PATCH",
                                  {},
                                ),
                              "Message marked as read.",
                            )
                          }
                        >
                          {t("Mark as read")}
                        </Action>
                      )}
                    </View>
                  ))}
                  {query.data?.notifications?.length === 0 && (
                    <Text style={styles.copy}>{t("No messages yet.")}</Text>
                  )}
                </>
              )}
              {tab === "consents" && (
                <>
                  <Field
                    label={t("Your name")}
                    value={name}
                    onChange={setName}
                  />
                  <Field
                    label={t("Phone")}
                    value={phone}
                    onChange={setPhone}
                    type="phone-pad"
                  />
                  <Field
                    label={t("Birthday (YYYY-MM-DD, optional)")}
                    value={birthday}
                    onChange={setBirthday}
                  />
                  <Action
                    disabled={pending}
                    onPress={() =>
                      action(async () =>
                        setCustomer(
                          await api(`${path}/profile`, slug, "PATCH", {
                            name,
                            phone,
                            birthday: birthday || null,
                          }),
                        ),
                      )
                    }
                  >
                    {t("Save profile")}
                  </Action>
                  <Text style={[styles.heading, { marginTop: 30 }]}>
                    {t("Your personal edit")}{" "}
                  </Text>
                  <Field
                    label={t("Preferred sizes (comma separated, up to 10)")}
                    value={sizes}
                    onChange={setSizes}
                  />
                  <Field
                    label={t(
                      "Favourite categories (comma separated, up to 10)",
                    )}
                    value={categories}
                    onChange={setCategories}
                  />
                  <Text style={styles.copy}>
                    {t("Preferred boutique location")}
                  </Text>
                  <View style={styles.chips}>
                    {[
                      { id: "", name: "No preference" },
                      ...(boutique.data?.stores ?? []),
                    ].map((store) => (
                      <Pressable
                        key={store.id}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: (preferredStoreId ?? "") === store.id,
                        }}
                        style={[
                          styles.chip,
                          (preferredStoreId ?? "") === store.id &&
                            styles.chipActive,
                        ]}
                        onPress={() => setPreferredStoreId(store.id || null)}
                      >
                        <Text>{store.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Action
                    disabled={pending}
                    onPress={() =>
                      action(async () => {
                        const split = (value: string) => [
                          ...new Set(
                            value
                              .split(",")
                              .map((item) => item.trim())
                              .filter(Boolean),
                          ),
                        ];
                        setCustomer(
                          await api(`${path}/preferences`, slug, "PUT", {
                            sizes: split(sizes),
                            categories: split(categories),
                            preferredStoreId,
                          }),
                        );
                      }, "Preferences saved.")
                    }
                  >
                    {t("Save shopping preferences")}
                  </Action>
                  <Text style={[styles.heading, { marginTop: 30 }]}>
                    {t("Your choices")}{" "}
                  </Text>
                  <Text style={styles.copy}>
                    {t(
                      "Marketing preferences are separate from transactional order messages.",
                    )}{" "}
                  </Text>
                  {[
                    "IN_APP_MARKETING",
                    "EMAIL_MARKETING",
                    "SMS_MARKETING",
                    "PUSH_MARKETING",
                  ].map((purpose) => (
                    <View
                      key={purpose}
                      style={[styles.row, { marginVertical: 15 }]}
                    >
                      <Text>{t(purpose)}</Text>
                      <Switch
                        accessibilityLabel={t(purpose)}
                        disabled={pending}
                        value={
                          query.data?.consents?.find(
                            (item) => item.purpose === purpose,
                          )?.granted ?? false
                        }
                        onValueChange={(granted) =>
                          action(() =>
                            api(`${path}/consents`, slug, "PUT", {
                              purpose,
                              granted,
                            }),
                          )
                        }
                      />
                    </View>
                  ))}
                  <Action
                    secondary
                    disabled={pending}
                    onPress={() =>
                      action(async () => {
                        const data = await api(`${path}/export`, slug);
                        await Share.share({
                          message: JSON.stringify(data, null, 2),
                          title: t("My boutique data"),
                        });
                      }, "Data export prepared.")
                    }
                  >
                    {t("Export my account data")}
                  </Action>
                  <View style={styles.card}>
                    <Text style={styles.heading}>{t("Delete account")}</Text>
                    <Text style={styles.copy}>
                      {t(
                        "Saved personal details and unused vouchers are removed. Anonymized financial and audit records remain. Finish active orders first.",
                      )}{" "}
                    </Text>
                    <Field
                      label={t("Current password")}
                      value={password}
                      onChange={setPassword}
                      secure
                    />
                    <View style={styles.row}>
                      <Text style={[styles.copy, { flex: 1 }]}>
                        {t("I understand my account will be deleted.")}{" "}
                      </Text>
                      <Switch
                        accessibilityLabel={t("Confirm account deletion")}
                        value={deleteConsent}
                        onValueChange={setDeleteConsent}
                      />
                    </View>
                    <Action
                      secondary
                      disabled={pending || !deleteConsent}
                      onPress={() =>
                        action(async () => {
                          await api(`${path}/account`, slug, "DELETE", {
                            password,
                          });
                          await clearSession(slug);
                          setCustomer(null);
                          setPassword("");
                          client.removeQueries({ queryKey: ["account", slug] });
                        }, "Account deleted.")
                      }
                    >
                      {t("Delete account")}
                    </Action>
                  </View>
                </>
              )}
            </>
          )}
          <Action secondary disabled={pending} onPress={() => query.refetch()}>
            {t("Refresh")}
          </Action>
          <Action
            secondary
            disabled={pending}
            onPress={() =>
              action(async () => {
                await api(`${path}/logout`, slug, "POST", {});
                await clearSession(slug);
                setCustomer(null);
                setPassword("");
                client.removeQueries({ queryKey: ["account", slug] });
              }, "Signed out.")
            }
          >
            {t("Sign out")}
          </Action>
        </>
      )}
    </Screen>
  );
}
