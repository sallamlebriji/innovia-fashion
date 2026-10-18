import { useLocale, useWords } from "../src/locale";
import { LanguageSwitch } from "../src/language";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
export default function Layout() {
  const t = useWords();
  const locale = useLocale((state) => state.locale);

  return (
    <GestureHandlerRootView
      style={{ flex: 1, direction: locale === "ar" ? "rtl" : "ltr" }}
    >
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: "#f8f6f2" },
              headerTintColor: "#242424",
              headerShadowVisible: false,
              headerRight: () => <LanguageSwitch />,
              contentStyle: { backgroundColor: "#f8f6f2" },
            }}
          >
            <Stack.Screen
              name="index"
              options={{ title: t("INNOVIA / Discover") }}
            />
            <Stack.Screen
              name="boutique/[slug]"
              options={{ title: t("The boutique") }}
            />
            <Stack.Screen
              name="product/[slug]/[id]"
              options={{ title: t("Your next favourite") }}
            />
            <Stack.Screen
              name="bag/[slug]"
              options={{ title: t("Your bag") }}
            />
            <Stack.Screen
              name="fitting/[slug]/[id]"
              options={{ title: t("Your fitting room") }}
            />
            <Stack.Screen
              name="account/[slug]"
              options={{ title: t("Your account") }}
            />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
