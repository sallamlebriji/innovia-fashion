import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api } from "./api";
import * as SecureStore from "expo-secure-store";
const currentTokens = new Map<string, string>();
export async function registerPush(slug: string) {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!Device.isDevice || !projectId)
    throw new Error(
      "Notifications are unavailable on this device. Your messages remain in your account.",
    );
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("default", {
      name: "Boutique updates",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted")
    permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error(
      "Notifications were not enabled. You can still read updates in your account.",
    );
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api(`/storefront/${slug}/customer/push/devices`, slug, "POST", {
    token,
  });
  currentTokens.set(slug, token);
  await SecureStore.setItemAsync(`innovia.push.${slug}`, token);
}
export async function unregisterPush(slug: string) {
  const token =
    currentTokens.get(slug) ??
    (await SecureStore.getItemAsync(`innovia.push.${slug}`));
  if (token) {
    await api(`/storefront/${slug}/customer/push/devices`, slug, "DELETE", {
      token,
    });
    currentTokens.delete(slug);
    await SecureStore.deleteItemAsync(`innovia.push.${slug}`);
  }
}
