import { useWords } from "../../src/locale";
import { useState } from "react";
import { Image, Text, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, assetUrl } from "../../src/api";
import { type Boutique, type Product, money, useBag } from "../../src/state";
import {
  Screen,
  Title,
  Field,
  Loading,
  ErrorText,
  Action,
  styles,
} from "../../src/ui";
export default function BoutiquePage() {
  const t = useWords();

  const { slug } = useLocalSearchParams<{ slug: string }>(),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
      category: "",
      brand: "",
      size: "",
      color: "",
      collection: "",
      minPrice: "",
      maxPrice: "",
    }),
    [refine, setRefine] = useState(false),
    [sort, setSort] = useState("newest");
  const facets = useQuery({
    queryKey: ["facets", slug],
    queryFn: () => api<Record<string, string[]>>(`/storefront/${slug}/facets`),
  });
  const boutique = useQuery({
    queryKey: ["boutique", slug],
    queryFn: () => api<Boutique>(`/storefront/${encodeURIComponent(slug)}`),
  });
  const products = useQuery({
    queryKey: ["catalog", slug, q, page, filters, sort],
    queryFn: () =>
      api<{ items: Product[]; total: number }>(
        `/storefront/${encodeURIComponent(slug)}/products?${new URLSearchParams({ q, page: String(page), sort, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) })}`,
      ),
  });
  const count = useBag((state) =>
    (state.bags[slug] ?? []).reduce((sum, line) => sum + line.quantity, 0),
  );
  return (
    <Screen>
      <Title
        eyebrow={t("THE BOUTIQUE")}
        subtitle={boutique.data?.tenant.heroSubtitle}
      >
        {boutique.data?.tenant.name ?? "A new discovery."}
      </Title>
      <View style={styles.row}>
        <Action
          secondary
          onPress={() =>
            router.push({ pathname: "/account/[slug]", params: { slug } })
          }
        >
          {t("Your account")}
        </Action>
        <Action
          onPress={() =>
            router.push({ pathname: "/bag/[slug]", params: { slug } })
          }
        >{`Your bag · ${count}`}</Action>
      </View>
      <Field
        label={t("Search the collection")}
        value={q}
        onChange={(value) => {
          setQ(value);
          setPage(1);
        }}
      />
      <ErrorText error={boutique.error || products.error} />
      <Action secondary onPress={() => setRefine(!refine)}>
        {t("Refine the collection")}
      </Action>
      {refine && (
        <View style={styles.card}>
          {(
            [
              ["category", "categories"],
              ["collection", "collections"],
              ["brand", "brands"],
              ["size", "sizes"],
              ["color", "colors"],
            ] as const
          ).map(([field, facet]) => (
            <View key={field}>
              <Text style={styles.eyebrow}>{t(field)}</Text>
              <View style={styles.chips}>
                <Pressable
                  accessibilityRole="button"
                  style={styles.chip}
                  onPress={() => {
                    setFilters({ ...filters, [field]: "" });
                    setPage(1);
                  }}
                >
                  <Text>{t("All")}</Text>
                </Pressable>
                {facets.data?.[facet]?.map((value) => (
                  <Pressable
                    accessibilityRole="button"
                    key={value}
                    onPress={() => {
                      setFilters({ ...filters, [field]: value });
                      setPage(1);
                    }}
                    style={[
                      styles.chip,
                      filters[field] === value && styles.chipActive,
                    ]}
                  >
                    <Text>{value}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          <Field
            label={t("Minimum price")}
            value={filters.minPrice}
            onChange={(value) => {
              setFilters({ ...filters, minPrice: value });
              setPage(1);
            }}
            type="decimal-pad"
          />
          <Field
            label={t("Maximum price")}
            value={filters.maxPrice}
            onChange={(value) => {
              setFilters({ ...filters, maxPrice: value });
              setPage(1);
            }}
            type="decimal-pad"
          />
          <View style={styles.chips}>
            {[
              ["newest", "Newest"],
              ["price_asc", "Price ↑"],
              ["price_desc", "Price ↓"],
            ].map(([value, label]) => (
              <Pressable
                accessibilityRole="button"
                key={value}
                onPress={() => {
                  setSort(value!);
                  setPage(1);
                }}
                style={[styles.chip, sort === value && styles.chipActive]}
              >
                <Text>{t(label!)}</Text>
              </Pressable>
            ))}
          </View>
          <Action
            secondary
            onPress={() => {
              setFilters({
                category: "",
                brand: "",
                size: "",
                color: "",
                collection: "",
                minPrice: "",
                maxPrice: "",
              });
              setPage(1);
            }}
          >
            {t("Clear filters")}
          </Action>
        </View>
      )}
      {products.isPending ? (
        <Loading />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {products.data?.items.map((product) => (
            <Pressable
              accessibilityRole="button"
              key={product.id}
              style={{ width: "47%", paddingBottom: 24 }}
              onPress={() =>
                router.push({
                  pathname: "/product/[slug]/[id]",
                  params: { slug, id: product.id },
                })
              }
            >
              <Image
                source={{ uri: assetUrl(product.imageUrl) }}
                style={styles.image}
              />
              <Text
                style={[styles.eyebrow, { marginTop: 15, marginBottom: 8 }]}
              >
                {product.category}
              </Text>
              <Text style={{ color: "#242424", fontSize: 13, marginBottom: 9 }}>
                {product.name}
              </Text>
              <Text>
                {money(
                  product.variants[0]?.price ?? 0,
                  boutique.data?.tenant.currency,
                )}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {products.data?.total === 0 && (
        <Text style={styles.copy}>{t("No pieces match your search.")}</Text>
      )}
      {(products.data?.total ?? 0) > 24 && (
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
            disabled={page * 24 >= (products.data?.total ?? 0)}
            onPress={() => setPage(page + 1)}
          >
            {t("Next")}
          </Action>
        </View>
      )}
      <Text style={[styles.copy, { marginTop: 25 }]}>
        {boutique.data?.settings.returnPolicy}
      </Text>
    </Screen>
  );
}
