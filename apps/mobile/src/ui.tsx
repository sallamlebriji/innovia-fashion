import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";
import { useLocale, useWords } from "./locale";
export function Screen({ children }: { children: React.ReactNode }) {
  const locale = useLocale((state) => state.locale);
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "#f8f6f2",
        direction: locale === "ar" ? "rtl" : "ltr",
      }}
      edges={["bottom", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          entering={FadeInDown.duration(350).reduceMotion(ReduceMotion.System)}
        >
          {children}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
export function Title({
  eyebrow,
  children,
  subtitle,
}: {
  eyebrow?: string;
  children: string;
  subtitle?: string;
}) {
  return (
    <View style={{ marginBottom: 28 }}>
      {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <Text style={styles.title}>{children}</Text>
      {subtitle && <Text style={styles.copy}>{subtitle}</Text>}
    </View>
  );
}
export function Action({
  children,
  onPress,
  disabled,
  secondary = false,
}: {
  children: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        secondary && styles.secondary,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={{ color: secondary ? "#242424" : "#fff", fontSize: 13 }}>
        {children}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  secure,
  type,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  secure?: boolean;
  type?: "email-address" | "phone-pad" | "numeric" | "decimal-pad";
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={{ marginVertical: 9 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        keyboardType={type}
        autoCapitalize={
          type === "email-address" || secure ? "none" : "sentences"
        }
        multiline={multiline}
        placeholder={placeholder}
        style={[
          styles.input,
          multiline && { minHeight: 85, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}
export function ErrorText({ error }: { error: unknown }) {
  const t = useWords();
  return error ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {t(error instanceof Error ? error.message : String(error))}
    </Text>
  ) : null;
}
export function Loading() {
  return <ActivityIndicator style={{ margin: 30 }} color="#b1946b" />;
}
export const styles = StyleSheet.create({
  screen: { padding: 24, paddingBottom: 60 },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 2,
    color: "#837c6e",
    marginBottom: 18,
  },
  title: {
    fontSize: 38,
    lineHeight: 43,
    fontFamily: "serif",
    color: "#242424",
    marginBottom: 18,
  },
  copy: { color: "#6b655b", fontSize: 14, lineHeight: 24 },
  action: {
    minHeight: 48,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#242424",
    marginVertical: 8,
  },
  secondary: {
    backgroundColor: "#e7ded1",
    borderWidth: 1,
    borderColor: "#d2c3b0",
  },
  label: { fontSize: 12, color: "#514d46", marginBottom: 9 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#d2c3b0",
    padding: 13,
    backgroundColor: "#fdfcf9",
    color: "#242424",
    fontSize: 14,
  },
  error: {
    backgroundColor: "#fae9e5",
    color: "#973e2e",
    padding: 15,
    lineHeight: 22,
    marginVertical: 15,
  },
  card: {
    borderBottomWidth: 1,
    borderBottomColor: "#d2c3b0",
    paddingVertical: 22,
    gap: 12,
  },
  heading: { fontSize: 20, color: "#242424", fontFamily: "serif" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  image: { width: "100%", aspectRatio: 3 / 4, backgroundColor: "#e7ded1" },
  chip: {
    minHeight: 44,
    minWidth: 44,
    padding: 13,
    borderWidth: 1,
    borderColor: "#d2c3b0",
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: "#e7ded1", borderColor: "#242424" },
  chips: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginVertical: 15,
  },
});
