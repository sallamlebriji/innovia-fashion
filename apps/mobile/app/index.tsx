import { useWords } from "../src/locale";
import { useState } from "react";
import { View, Text, Image, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, assetUrl } from "../src/api";
import { Welcome } from "../src/welcome";
import {
  Screen,
  Title,
  Field,
  ErrorText,
  Loading,
  Action,
  styles,
} from "../src/ui";
type Boutique = {
  id: string;
  slug: string;
  name: string;
  heroImage: string;
  heroSubtitle: string;
  demo: boolean;
};
export default function Discover() {
  const t = useWords();

  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["discovery", search, page],
    queryFn: () =>
      api<{ items: Boutique[]; total: number }>(
        `/storefront?q=${encodeURIComponent(search)}&page=${page}&limit=12`,
      ),
  });
  return (
    <Screen>
      <Welcome>
        <Title
          eyebrow={t("INNOVIA / INDEPENDENT FASHION")}
          subtitle={t(
            "Find a boutique. Discover your next everyday favourite.",
          )}
        >
          {t("A considered collection.")}
        </Title>
        <Field
          label={t("Find a boutique")}
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <ErrorText error={query.error} />
        {query.isPending ? (
          <Loading />
        ) : (
          query.data?.items.map((boutique) => (
            <Pressable
              key={boutique.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/boutique/[slug]",
                  params: { slug: boutique.slug },
                })
              }
              style={styles.card}
            >
              {boutique.heroImage && (
                <Image
                  source={{ uri: assetUrl(boutique.heroImage) }}
                  style={{ width: "100%", aspectRatio: 1.5 }}
                />
              )}
              <Text style={styles.heading}>{boutique.name}</Text>
              <Text style={styles.copy}>{boutique.heroSubtitle}</Text>
              {boutique.demo && (
                <Text style={styles.eyebrow}>
                  {t("FICTIONAL DEMO BOUTIQUE")}
                </Text>
              )}
            </Pressable>
          ))
        )}
        {query.data && query.data.total === 0 && (
          <Text style={styles.copy}>
            {t("No boutiques match your search.")}
          </Text>
        )}
        {(query.data?.total ?? 0) > 12 && (
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
              disabled={page * 12 >= (query.data?.total ?? 0)}
              onPress={() => setPage(page + 1)}
            >
              {t("Next")}
            </Action>
          </View>
        )}
      </Welcome>
    </Screen>
  );
}
