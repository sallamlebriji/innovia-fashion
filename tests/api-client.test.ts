import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { mutate, setCsrfToken } from "../packages/api-client/src/index.js";
beforeEach(() => setCsrfToken(crypto.randomUUID()));
afterEach(() => vi.restoreAllMocks());
it("reuses an unconfirmed mutation key and gives confirmed repetitions a new key", async () => {
  const keys: string[] = [];
  let calls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) => {
    keys.push((options!.headers as Record<string, string>)["Idempotency-Key"]!);
    calls++;
    return new Response(
      JSON.stringify(
        calls === 1
          ? { error: { message: "Unconfirmed" } }
          : { id: "movement" },
      ),
      {
        status: calls === 1 ? 500 : 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  });
  await expect(
    mutate("/registers/fixture/movements", { amount: "10.00" }),
  ).rejects.toMatchObject({ status: 500 });
  await mutate("/registers/fixture/movements", { amount: "10.00" });
  await mutate("/registers/fixture/movements", { amount: "10.00" });
  expect(keys[0]).toMatch(/^[a-f0-9-]{36}$/);
  expect(keys[1]).toBe(keys[0]);
  expect(keys[2]).not.toBe(keys[0]);
});
it("preserves an explicit financial request key", async () => {
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response('{"id":"order"}', {
        headers: { "Content-Type": "application/json" },
      }),
    );
  await mutate("/pos/checkout", {}, "POST", "explicit_sale_123");
  expect(
    (spy.mock.calls[0]![1]!.headers as Record<string, string>)[
      "Idempotency-Key"
    ],
  ).toBe("explicit_sale_123");
});
it("does not carry an unconfirmed request across authenticated users", async () => {
  const keys: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) => {
    keys.push((options!.headers as Record<string, string>)["Idempotency-Key"]!);
    throw new TypeError("Network unavailable");
  });
  await expect(mutate("/campaigns", { name: "Fixture" })).rejects.toThrow();
  setCsrfToken("new-user-csrf");
  await expect(mutate("/campaigns", { name: "Fixture" })).rejects.toThrow();
  expect(keys[0]).not.toBe(keys[1]);
});
