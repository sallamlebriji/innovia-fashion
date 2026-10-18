import { useCommerceWords as useWords } from "../commerce-words";
import { usePreferences } from "../state";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import { Button, Badge, Money } from "@innovia/ui";
import { PageTitle, Notice, Loading } from "../components";
import { useWorkspace } from "../App";
type Coupon = {
  id: string;
  code: string;
  name: string;
  kind: string;
  value: string;
  minimum: string;
  channel: string;
  used: number;
  maximumUses: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
};
export function Promotions() {
  const t = useWords();
  const locale = usePreferences((state) => state.locale);
  const { session } = useWorkspace(),
    currency = session.tenant!.currency,
    client = useQueryClient(),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ["coupons"],
    queryFn: () => request<Coupon[]>("/coupons"),
  });
  async function save(path: string, body: unknown, method = "POST") {
    setPending(true);
    setError(null);
    try {
      await mutate(path, body, method);
      await client.invalidateQueries({ queryKey: ["coupons"] });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow={t("A REASON TO RETURN")}
        title={t("Promotions.")}
        subtitle={t("Scheduled codes for your boutique and online collection.")}
      />
      <Notice error={error ?? query.error} />
      <section className="panel" style={{ padding: 24 }}>
        <h2>{t("Create a promotion")}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.currentTarget));
            void save("/coupons", {
              ...data,
              maximumUses: Number(data.maximumUses),
              startsAt: new Date(String(data.startsAt)).toISOString(),
              endsAt: new Date(String(data.endsAt)).toISOString(),
            });
          }}
        >
          <fieldset disabled={pending}>
            <div className="form-grid promotion-fields">
              <label>
                {t("Campaign name")}
                <input name="name" required minLength={2} maxLength={100} />
              </label>
              <label>
                {t("Promotion code")}
                <input
                  name="code"
                  dir="ltr"
                  required
                  pattern="[A-Za-z0-9_-]{3,50}"
                  maxLength={50}
                />
              </label>
              <label>
                {t("Discount type")}
                <select name="kind">
                  <option value="PERCENT">{t("Percentage")}</option>
                  <option value="FIXED">{t("Fixed amount")}</option>
                </select>
              </label>
              <label>
                {t("Value")}
                <input
                  name="value"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>
              <label>
                {t("Minimum basket")} ({currency})
                <input
                  name="minimum"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0.00"
                  required
                />
              </label>
              <label>
                {t("Channel")}
                <select name="channel">
                  <option value="ALL">{t("ALL")}</option>
                  <option value="POS">{t("POS")}</option>
                  <option value="ONLINE">{t("ONLINE")}</option>
                </select>
              </label>
              <label>
                {t("Total uses")}
                <input
                  name="maximumUses"
                  type="number"
                  min={1}
                  max={1000000}
                  defaultValue={100}
                  required
                />
              </label>
              <label>
                {t("Starts at")}
                <input name="startsAt" type="datetime-local" required />
              </label>
              <label>
                {t("Ends at")}
                <input name="endsAt" type="datetime-local" required />
              </label>
            </div>
            <Button type="submit">{t("Create promotion")}</Button>
          </fieldset>
        </form>
        <p>
          {t(
            "Prices include tax. The discount applies to goods before delivery fees. One code or reward voucher per order; cancelled reservations release their reserved use.",
          )}
        </p>
      </section>
      <section className="panel" style={{ marginTop: 24, padding: 24 }}>
        <h2>{t("Your latest 100 promotions")}</h2>
        {query.isPending && <Loading />}
        {query.data?.map((coupon) => (
          <article key={coupon.id} className="variant-editor">
            <h3>
              {coupon.name} <code dir="ltr">{coupon.code}</code>
            </h3>
            <p>
              {coupon.kind === "PERCENT" ? (
                new Intl.NumberFormat(`${locale}-MA`, {
                  style: "percent",
                  maximumFractionDigits: 2,
                }).format(Number(coupon.value) / 100)
              ) : (
                <Money
                  value={coupon.value}
                  currency={currency}
                  locale={`${locale}-MA`}
                />
              )}{" "}
              · {t(coupon.channel)} ·{" "}
              <bdi>
                {coupon.used}/{coupon.maximumUses}
              </bdi>{" "}
              {t("uses")} · {t("Minimum")}{" "}
              <Money
                value={coupon.minimum}
                currency={currency}
                locale={`${locale}-MA`}
              />
            </p>
            <p>
              {new Date(coupon.startsAt).toLocaleString(`${locale}-MA`)}{" "}
              {locale === "ar" ? "←" : "→"}{" "}
              {new Date(coupon.endsAt).toLocaleString(`${locale}-MA`)}
            </p>
            <Badge tone={coupon.active ? "green" : "gold"}>
              {t(coupon.active ? "Enabled" : "Paused")}
            </Badge>{" "}
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                void save(
                  `/coupons/${coupon.id}`,
                  { active: !coupon.active },
                  "PATCH",
                )
              }
            >
              {t(coupon.active ? "Pause" : "Enable")}
            </Button>
          </article>
        ))}
      </section>
    </>
  );
}
