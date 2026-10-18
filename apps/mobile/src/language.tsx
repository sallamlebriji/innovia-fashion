import { Pressable, View, Text } from "react-native";
import { useLocale, useWords, type Locale } from "./locale";
export function LanguageSwitch() {
  const { locale, setLocale } = useLocale(),
    t = useWords();
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {(["en", "fr", "ar"] as Locale[]).map((value) => (
        <Pressable
          key={value}
          accessibilityRole="button"
          accessibilityLabel={`${t("Language")}: ${value === "fr" ? "Français" : value === "ar" ? "العربية" : "English"}`}
          accessibilityState={{ selected: locale === value }}
          onPress={() => setLocale(value)}
          style={{
            minHeight: 44,
            minWidth: 38,
            padding: 8,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: value === locale ? "#e7ded1" : "transparent",
          }}
        >
          <Text style={{ color: "#242424", fontSize: 12 }}>
            {value.toUpperCase()}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
