import { useWords } from "../words";
import { useQuery } from "@tanstack/react-query";
import { request } from "@innovia/api-client";
import { Badge, Money } from "@innovia/ui";
import { Notice } from "../components";
export function SubscriptionSummary() {
  const t = useWords();
  const query = useQuery({
    queryKey: ["subscription"],
    queryFn: () =>
      request<{
        subscriptionStatus: string;
        trialEndsAt: string | null;
        paidThrough: string | null;
        plan: {
          name: string;
          monthlyPrice: string;
          productLimit: number;
          storeLimit: number;
          employeeLimit: number;
          aiCredits: number;
        };
        usage: { products: number; stores: number; employees: number };
        provider: string;
      }>("/subscription"),
  });
  const data = query.data,
    trialExpired =
      data?.subscriptionStatus === "TRIAL" &&
      data.trialEndsAt &&
      new Date(data.trialEndsAt) <= new Date(),
    paidExpired =
      data?.subscriptionStatus === "ACTIVE" &&
      data.paidThrough &&
      new Date(data.paidThrough) <= new Date(),
    expired = trialExpired || paidExpired;
  return (
    <section className="panel settings-form">
      <h2> {t("Your subscription")} </h2>
      <Notice error={query.error} />
      {data && (
        <>
          <Badge
            tone={
              expired ||
              ["PAST_DUE", "SUSPENDED"].includes(data.subscriptionStatus)
                ? "gold"
                : "green"
            }
          >
            {trialExpired
              ? t("Trial ended")
              : paidExpired
                ? t("Paid period ended")
                : t(data.subscriptionStatus)}
          </Badge>
          <h3>
            {data.plan.name} · <Money value={data.plan.monthlyPrice} />{" "}
            {t("/ month")}{" "}
          </h3>
          {data.trialEndsAt && (
            <p>
              {" "}
              {t("Trial ends")}{" "}
              {new Date(data.trialEndsAt).toLocaleDateString()}
            </p>
          )}
          <p>
            {data.usage.products} / {data.plan.productLimit} {t("products")}{" "}
            <br />
            {data.usage.stores} / {data.plan.storeLimit} {t("locations")} <br />
            {data.usage.employees} / {data.plan.employeeLimit}{" "}
            {t("active employees")}{" "}
          </p>
          {data.paidThrough && (
            <p>
              {" "}
              {t("Paid through")}{" "}
              {new Date(data.paidThrough).toLocaleDateString()}
            </p>
          )}
          <p className="field-help">
            {" "}
            {t(
              "Online billing requires an operator-configured provider. Contact support for activation or a plan change. Existing financial records remain available if a trial expires.",
            )}{" "}
          </p>
          <a className="button button-secondary" href="/support">
            {" "}
            {t("Contact subscription support →")}{" "}
          </a>
        </>
      )}
    </section>
  );
}
