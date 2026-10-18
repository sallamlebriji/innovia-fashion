import { useWords } from "../../../src/locale";
import { useState } from "react";
import { View, Text, Image, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { api, assetUrl, restoreSession, ApiError } from "../../../src/api";
import { type Product, type Boutique, useBag, money } from "../../../src/state";
import {
  Screen,
  Title,
  Loading,
  ErrorText,
  Action,
  Field,
  styles,
} from "../../../src/ui";
export default function ProductPage() {
  const t = useWords();

  const { slug, id } = useLocalSearchParams<{ slug: string; id: string }>(),
    [variantId, setVariantId] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false),
    [image, setImage] = useState("");
  const [chest, setChest] = useState(""),
    [waist, setWaist] = useState(""),
    [footLength, setFootLength] = useState(""),
    [comparison, setComparison] = useState("");
  const query = useQuery({
      queryKey: ["product", slug, id],
      queryFn: () =>
        api<Product>(
          `/storefront/${encodeURIComponent(slug)}/products/${encodeURIComponent(id)}`,
        ),
    }),
    ar = useQuery({
      queryKey: ["ar", slug, id],
      queryFn: () =>
        api<{ enabled: boolean }>(`/storefront/${slug}/products/${id}/ar`),
    }),
    boutique = useQuery({
      queryKey: ["boutique", slug],
      queryFn: () => api<Boutique>(`/storefront/${encodeURIComponent(slug)}`),
    });
  const add = useBag((state) => state.add),
    product = query.data,
    variant = product?.variants.find((item) => item.id === variantId);
  async function wishlist() {
    setPending(true);
    setError(null);
    try {
      await restoreSession(slug);
      await api(`/storefront/${slug}/customer/wishlist`, slug, "POST", {
        productId: id,
      });
      setNotice("Saved to your personal edit.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401)
        router.push({ pathname: "/account/[slug]", params: { slug } });
      else setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <Screen>
      <ErrorText error={query.error || error} />
      {query.isPending ? (
        <Loading />
      ) : (
        product && (
          <>
            <Image
              source={{ uri: assetUrl(image || product.imageUrl) }}
              style={styles.image}
            />
            <View style={styles.chips}>
              {product.media
                .filter((asset) => asset.kind === "IMAGE")
                .map((asset, index) => (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    onPress={() => setImage(asset.url)}
                  >
                    <Image
                      source={{ uri: assetUrl(asset.url) }}
                      accessibilityLabel={asset.alt}
                      style={{ width: 60, height: 80 }}
                    />
                  </Pressable>
                ))}
            </View>
            <Title eyebrow={product.brand} subtitle={product.description}>
              {product.name}
            </Title>
            <Text style={styles.heading}>
              {money(
                variant?.price ?? product.variants[0]?.price ?? 0,
                boutique.data?.tenant.currency,
              )}
            </Text>
            <View style={styles.chips}>
              {product.variants.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.color}, size ${item.size}`}
                  disabled={
                    !item.availability.some((stock) => stock.available > 0)
                  }
                  onPress={() => setVariantId(item.id)}
                  style={[
                    styles.chip,
                    item.id === variantId && styles.chipActive,
                    !item.availability.some((stock) => stock.available > 0) && {
                      opacity: 0.35,
                    },
                  ]}
                >
                  <Text>{item.size}</Text>
                  <Text style={{ fontSize: 10 }}>{item.color}</Text>
                </Pressable>
              ))}
            </View>
            <Action
              disabled={!variant}
              onPress={() => {
                if (variant) {
                  add(slug, product, variant);
                  setNotice("Added to your bag.");
                }
              }}
            >
              {t("Add to bag +")}
            </Action>
            <Action secondary disabled={pending} onPress={wishlist}>
              {t("Save to your personal edit ♡")}
            </Action>
            {product.tryOnEnabled && (
              <Action
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/fitting/[slug]/[id]",
                    params: { slug, id: product.id },
                  })
                }
              >
                {t("Try this piece on your photo")}
              </Action>
            )}
            {notice && (
              <Text accessibilityRole="alert" style={styles.copy}>
                {t(notice)}
              </Text>
            )}
            <Action
              secondary
              onPress={() =>
                router.push({ pathname: "/bag/[slug]", params: { slug } })
              }
            >
              {t("View your bag →")}
            </Action>
            <View style={styles.card}>
              <Text style={styles.heading}>{t("Details & care")}</Text>
              <Text style={styles.copy}>
                {product.material} · {product.fit}
              </Text>
              <Text style={styles.copy}>
                {product.care || "Contact your boutique for care instructions."}
              </Text>
            </View>
            {ar.data?.enabled && process.env.EXPO_PUBLIC_STOREFRONT_URL && (
              <Action
                secondary
                onPress={async () => {
                  try {
                    await WebBrowser.openBrowserAsync(
                      `${process.env.EXPO_PUBLIC_STOREFRONT_URL}/${encodeURIComponent(slug)}/products/${encodeURIComponent(id)}`,
                    );
                  } catch (err) {
                    setError(err);
                  }
                }}
              >
                {t("Open live AR in your browser")}
              </Action>
            )}
            {!!product.sizeChart?.length && (
              <View style={styles.card}>
                <Text style={styles.heading}>{t("Size guide")}</Text>
                <Text style={styles.copy}>
                  {t(
                    "Garment measurements in cm. Compare with a piece you own; fit is not guaranteed.",
                  )}{" "}
                </Text>
                {product.sizeChart.map((row, index) => (
                  <Text key={index} style={styles.copy}>
                    {row.size} {t("· Chest")} {row.chest ?? "—"} {t("· Waist")}{" "}
                    {row.waist ?? "—"} {t("· Length")} {row.length ?? "—"}{" "}
                    {row.footLength != null
                      ? `· Foot ${row.footLength} cm`
                      : ""}{" "}
                    {row.equivalentSizes ?? ""}
                  </Text>
                ))}
                <Field
                  label={t("Preferred garment chest (cm)")}
                  value={chest}
                  onChange={setChest}
                  type="decimal-pad"
                />
                <Field
                  label={t("Preferred garment waist (cm)")}
                  value={waist}
                  onChange={setWaist}
                  type="decimal-pad"
                />
                {product.sizeChart.some((row) => row.footLength != null) && (
                  <Field
                    label={t("Measured foot length (cm)")}
                    value={footLength}
                    onChange={setFootLength}
                    type="decimal-pad"
                  />
                )}
                <Action
                  secondary
                  onPress={async () => {
                    const c = Number(chest),
                      w = Number(waist);
                    try {
                      const result = await api<{
                        explanation: string;
                        basis: string;
                        alternative: { size: string } | null;
                      }>(
                        `/storefront/${slug}/products/${id}/size-advisor`,
                        undefined,
                        "POST",
                        {
                          ...(chest ? { chest: c } : {}),
                          ...(waist ? { waist: w } : {}),
                          ...(footLength
                            ? { footLength: Number(footLength) }
                            : {}),
                        },
                      );
                      setComparison(
                        `${result.explanation}${result.alternative ? ` Alternative: ${result.alternative.size}.` : ""} ${result.basis}`,
                      );
                    } catch (err) {
                      setComparison(
                        err instanceof Error
                          ? err.message
                          : t("Please try again."),
                      );
                    }
                  }}
                >
                  {t("Compare measurements")}
                </Action>
                {!!comparison && (
                  <Text accessibilityRole="alert" style={styles.copy}>
                    {comparison}
                  </Text>
                )}
              </View>
            )}
            <Text style={[styles.copy, { marginTop: 25 }]}>
              {boutique.data?.settings.deliveryPolicy}
            </Text>
            <Text style={styles.copy}>
              {boutique.data?.settings.returnPolicy}
            </Text>
          </>
        )
      )}
    </Screen>
  );
}
