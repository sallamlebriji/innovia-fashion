import * as SecureStore from "expo-secure-store";
const sessions = new Map<string, string>();
export const apiBase = () =>
  (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
export function assetUrl(url: string) {
  if (!url.startsWith("/")) return url;
  const base = apiBase();
  return base ? new URL(url, base).toString() : "";
}
export async function restoreSession(slug: string) {
  if (await SecureStore.isAvailableAsync()) {
    const token = await SecureStore.getItemAsync(`innovia.customer.${slug}`);
    if (token) sessions.set(slug, token);
  }
}
export async function saveSession(slug: string, token: string) {
  sessions.set(slug, token);
  if (await SecureStore.isAvailableAsync())
    await SecureStore.setItemAsync(`innovia.customer.${slug}`, token);
}
export async function clearSession(slug: string) {
  sessions.delete(slug);
  if (await SecureStore.isAvailableAsync())
    await SecureStore.deleteItemAsync(`innovia.customer.${slug}`);
}
export function privateImage(slug: string, id: string) {
  return {
    uri: `${apiBase()}/storefront/${encodeURIComponent(slug)}/customer/media/${id}`,
    headers: { Authorization: `Bearer ${sessions.get(slug) ?? ""}` },
  };
}
export async function uploadPhoto(slug: string, base64: string, mime: string) {
  const decoded = atob(base64),
    bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index++)
    bytes[index] = decoded.charCodeAt(index);
  if (bytes.length > 10 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 10 MB.");
  const response = await fetch(
    `${apiBase()}/storefront/${encodeURIComponent(slug)}/customer/media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessions.get(slug) ?? ""}`,
        "Content-Type": mime,
        "X-Photo-Consent": "self-photo-v1",
      },
      body: bytes.buffer,
    },
  );
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      result.error?.message ?? "Photo upload failed.",
      response.status,
    );
  return result as { id: string };
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  slug?: string,
  method = "GET",
  data?: unknown,
  key?: string,
): Promise<T> {
  const base = apiBase();
  if (!base)
    throw new Error(
      "Set EXPO_PUBLIC_API_URL to your reachable API URL, including /api/v1.",
    );
  const token = slug ? sessions.get(slug) : undefined;
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      result.error?.message ?? "Please try again.",
      response.status,
    );
  return result;
}
