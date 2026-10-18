let csrfToken = "";
const pendingKeys = new Map<string, string>();
export function setCsrfToken(value: string) {
  if (value !== csrfToken) pendingKeys.clear();
  csrfToken = value;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
  base = "/api/v1",
): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error?.message ?? "The request could not be completed.",
      response.status,
      data.error?.details,
    );
  return data as T;
}
export async function mutate<T>(
  path: string,
  data: unknown,
  method = "POST",
  key?: string,
) {
  const fingerprint = `${method}:${path}:${JSON.stringify(data)}`,
    automatic = key === undefined;
  const requestKey = key ?? pendingKeys.get(fingerprint) ?? crypto.randomUUID();
  if (automatic) pendingKeys.set(fingerprint, requestKey);
  try {
    const result = await request<T>(path, {
      method,
      body: JSON.stringify(data),
      headers: { "Idempotency-Key": requestKey },
    });
    if (automatic) pendingKeys.delete(fingerprint);
    return result;
  } catch (error) {
    if (automatic && error instanceof ApiError && error.status < 500)
      pendingKeys.delete(fingerprint);
    throw error;
  }
}
