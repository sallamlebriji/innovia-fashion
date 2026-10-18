import { useWords } from "../../src/locale";
import { useEffect, useRef, useState } from "react";
import { Text, View, Image, Pressable, Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { useQuery } from "@tanstack/react-query";
import { api, assetUrl, restoreSession } from "../../src/api";
import { type Boutique, useBag, money } from "../../src/state";
import {
  Screen,
  Title,
  Action,
  Field,
  ErrorText,
  Loading,
  styles,
} from "../../src/ui";
export default function Bag() {
  const t = useWords();

  const { slug } = useLocalSearchParams<{ slug: string }>(),
    lines = useBag((state) => state.bags[slug]),
    change = useBag((state) => state.change),
    clear = useBag((state) => state.clear);
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [storeId, setStoreId] = useState(""),
    [zoneId, setZoneId] = useState(""),
    [delivery, setDelivery] = useState(false),
    [street, setStreet] = useState(""),
    [city, setCity] = useState(""),
    [postalCode, setPostalCode] = useState(""),
    [rewardCode, setRewardCode] = useState(""),
    [couponCode, setCouponCode] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(),
    [confirmation, setConfirmation] = useState<{
      number: string;
      total: string;
      trackingToken: string;
    } | null>(null);
  const key = useRef(Crypto.randomUUID()),
    boutique = useQuery({
      queryKey: ["boutique", slug],
      queryFn: () => api<Boutique>(`/storefront/${slug}`),
    });
  useEffect(() => {
    key.current = Crypto.randomUUID();
  }, [
    lines,
    name,
    email,
    phone,
    storeId,
    zoneId,
    delivery,
    street,
    city,
    postalCode,
    rewardCode,
    couponCode,
  ]);
  useEffect(() => {
    if (boutique.data) {
      setStoreId((old) => old || boutique.data.stores[0]?.id || "");
      setZoneId((old) => old || boutique.data.zones[0]?.id || "");
    }
  }, [boutique.data]);
  useEffect(() => {
    let active = true;
    restoreSession(slug)
      .then(() =>
        api<{ customer: { name: string; email: string; phone: string } }>(
          `/storefront/${slug}/customer/me`,
          slug,
        ),
      )
      .then((result) => {
        if (active) {
          setName(result.customer.name);
          setEmail(result.customer.email);
          setPhone(result.customer.phone);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [slug]);
  const total = (lines ?? []).reduce(
      (sum, line) =>
        sum + Math.round(Number(line.variant.price) * 100) * line.quantity,
      0,
    ),
    zone = boutique.data?.zones.find((item) => item.id === zoneId),
    currency = boutique.data?.tenant.currency ?? "MAD";
  async function checkout() {
    setPending(true);
    setError(null);
    try {
      const result = await api<{
        number: string;
        total: string;
        trackingToken: string;
      }>(
        `/storefront/${slug}/checkout`,
        undefined,
        "POST",
        {
          storeId,
          customerName: name,
          email,
          phone,
          channel: "ONLINE",
          paymentMethod: delivery ? "CASH_ON_DELIVERY" : "PICKUP",
          ...(rewardCode ? { rewardCode } : {}),
          ...(couponCode ? { couponCode } : {}),
          ...(delivery
            ? {
                deliveryZoneId: zoneId,
                shippingAddress: {
                  recipient: name,
                  street,
                  city,
                  postalCode,
                  phone,
                  country: "MA",
                },
              }
            : {}),
          items: (lines ?? []).map((line) => ({
            variantId: line.variant.id,
            quantity: line.quantity,
          })),
        },
        key.current,
      );
      setConfirmation(result);
      clear(slug);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <Screen>
      <Title eyebrow={boutique.data?.tenant.name}>{t("Your bag.")}</Title>
      <ErrorText error={error || boutique.error} />
      {boutique.isPending ? (
        <Loading />
      ) : confirmation ? (
        <>
          <Text style={styles.heading}>{t("Your next favourite awaits.")}</Text>
          <Text style={styles.copy}>
            {confirmation.number} · {money(confirmation.total, currency)}{" "}
            {t("due")} {delivery ? t("on delivery") : t("at collection")}.
          </Text>
          <Text style={styles.copy}>
            {t(
              "Your order is reserved. Keep the private tracking link and contact your boutique to arrange fulfilment.",
            )}{" "}
          </Text>
          <Action
            onPress={() => {
              const site = process.env.EXPO_PUBLIC_STOREFRONT_URL;
              if (!site) {
                setError(
                  new Error(
                    "Order tracking is temporarily unavailable. Contact your boutique with your order number.",
                  ),
                );
                return;
              }
              Linking.openURL(
                `${site}/${slug}/tracking?${new URLSearchParams({ number: confirmation.number, token: confirmation.trackingToken })}`,
              );
            }}
          >
            {t("Track order →")}
          </Action>
        </>
      ) : !lines?.length ? (
        <Text style={styles.copy}>
          {t("A little space for something beautiful.")}
        </Text>
      ) : (
        <>
          {lines.map((line) => (
            <View style={styles.card} key={line.variant.id}>
              <View style={styles.row}>
                <Image
                  source={{ uri: assetUrl(line.product.imageUrl) }}
                  style={{ width: 65, height: 85 }}
                />
                <View style={{ flex: 1 }}>
                  <Text>{line.product.name}</Text>
                  <Text style={styles.copy}>
                    {line.variant.color} / {line.variant.size}
                  </Text>
                  <Text>{money(line.variant.price, currency)}</Text>
                </View>
              </View>
              <View style={styles.row}>
                <Action
                  secondary
                  disabled={pending}
                  onPress={() => change(slug, line.variant.id, -1)}
                >
                  −
                </Action>
                <Text>{line.quantity}</Text>
                <Action
                  secondary
                  disabled={pending}
                  onPress={() => change(slug, line.variant.id, 1)}
                >
                  +
                </Action>
              </View>
            </View>
          ))}
          <Text style={[styles.heading, { marginVertical: 25 }]}>
            {t("Subtotal")} {money(total / 100, currency)}
          </Text>
          <Text style={styles.copy}>
            {t(
              "Prices include configured tax. Your boutique confirms the final total and reserves stock when you submit.",
            )}{" "}
          </Text>
          <View style={styles.chips}>
            <Pressable
              disabled={pending}
              style={[styles.chip, !delivery && styles.chipActive]}
              onPress={() => setDelivery(false)}
            >
              <Text>{t("Boutique pickup")}</Text>
            </Pressable>
            {!!boutique.data?.zones.length && (
              <Pressable
                disabled={pending}
                style={[styles.chip, delivery && styles.chipActive]}
                onPress={() => setDelivery(true)}
              >
                <Text>{t("Cash on delivery")}</Text>
              </Pressable>
            )}
          </View>
          <Field label={t("Your name")} value={name} onChange={setName} />
          <Field
            label={t("Email")}
            value={email}
            onChange={setEmail}
            type="email-address"
          />
          <Field
            label={t("Moroccan phone")}
            value={phone}
            onChange={setPhone}
            type="phone-pad"
          />
          <Text style={styles.label}>
            {delivery ? t("Dispatch boutique") : t("Pickup boutique")}
          </Text>
          <View style={styles.chips}>
            {boutique.data?.stores.map((store) => (
              <Pressable
                disabled={pending}
                key={store.id}
                style={[styles.chip, storeId === store.id && styles.chipActive]}
                onPress={() => setStoreId(store.id)}
              >
                <Text>{store.name}</Text>
              </Pressable>
            ))}
          </View>
          {delivery && (
            <>
              <Text style={styles.label}>{t("Delivery area")}</Text>
              <View style={styles.chips}>
                {boutique.data?.zones.map((item) => (
                  <Pressable
                    disabled={pending}
                    key={item.id}
                    style={[
                      styles.chip,
                      zoneId === item.id && styles.chipActive,
                    ]}
                    onPress={() => {
                      setZoneId(item.id);
                      setCity(item.cities[0] ?? "");
                    }}
                  >
                    <Text>
                      {item.name} · {money(item.fee, currency)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Field
                label={t("Street and apartment")}
                value={street}
                onChange={setStreet}
                multiline
              />
              <Field
                label={`${t("City")} (${zone?.cities.join(", ") ?? ""})`}
                value={city}
                onChange={setCity}
              />
              <Field
                label={t("Postal code")}
                value={postalCode}
                onChange={setPostalCode}
                type="numeric"
              />
              <Text style={styles.copy}>
                {t("Delivery:")} {money(zone?.fee ?? 0, currency)}
              </Text>
            </>
          )}
          <Field
            label={t("Membership voucher (optional)")}
            value={rewardCode}
            onChange={setRewardCode}
          />
          <Field
            label={t("Promotion code (optional, use one code or voucher)")}
            value={couponCode}
            onChange={setCouponCode}
          />
          <Text style={styles.copy}>
            {t(
              "Your contact details are used to fulfil this order. Marketing consent is separate.",
            )}{" "}
          </Text>
          <Action disabled={pending || !storeId} onPress={checkout}>
            {pending
              ? t("Reserving your pieces…")
              : delivery
                ? t("Confirm delivery order")
                : t("Confirm pickup reservation")}
          </Action>
        </>
      )}
    </Screen>
  );
}
