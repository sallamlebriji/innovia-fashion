export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function requireFound<T>(
  value: T | null | undefined,
  message = "This record could not be found.",
): T {
  if (value == null) throw new HttpError(404, "NOT_FOUND", message);
  return value;
}
