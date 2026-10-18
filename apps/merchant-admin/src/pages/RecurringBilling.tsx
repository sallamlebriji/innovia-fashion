import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate, ApiError } from "@innovia/api-client";
import { Badge, Button, Money } from "@innovia/ui";
import { Notice, Loading } from "../components";
import { usePreferences } from "../state";

const labels = {
  en: {
    title: "Monthly renewal",
    plan: "Subscription plan",
    start: "Start monthly subscription",
    consent:
      "I agree to the displayed monthly charge and automatic renewal until I cancel.",
    immediate:
      "Billing starts immediately and ends any remaining free trial. Your paid access continues until the end of each paid period.",
    unavailable:
      "Recurring billing is awaiting an approved payment account. Existing manual invoice payments remain available.",
    amount: "Your agreed monthly price",
    period: "Current paid period ends",
    perMonth: "/ month",
    payment: "Manage payment method",
    cancel: "Cancel renewal",
    cancelConsent: "Stop future renewals at the end of the current period.",
    canceled:
      "Renewal is canceled. Access remains available for your paid period.",
    change:
      "To change plans, cancel renewal and choose another plan after your paid period ends.",
    ENROLLING: "Not started",
    CHECKOUT: "Checkout pending",
    ACTIVE: "Active",
    PAST_DUE: "Payment overdue",
    ACTION_REQUIRED: "Payment needs attention",
    CANCELED: "Canceled",
    EXPIRED: "Checkout expired",
    INCOMPLETE: "Payment pending",
    INCOMPLETE_EXPIRED: "Expired",
    TRIALING: "Trial",
    PAUSED: "Paused",
    UNPAID: "Unpaid",
  },
  fr: {
    title: "Renouvellement mensuel",
    plan: "Formule d’abonnement",
    start: "Démarrer l’abonnement mensuel",
    consent:
      "J’accepte le montant mensuel affiché et le renouvellement automatique jusqu’à ma résiliation.",
    immediate:
      "La facturation commence immédiatement et met fin à l’essai gratuit restant. L’accès est maintenu jusqu’à la fin de chaque période payée.",
    unavailable:
      "Le paiement récurrent attend un compte de paiement agréé. Les factures manuelles restent disponibles.",
    amount: "Votre tarif mensuel convenu",
    period: "Fin de la période payée",
    perMonth: "/ mois",
    payment: "Gérer le moyen de paiement",
    cancel: "Arrêter le renouvellement",
    cancelConsent:
      "Arrêter les prochains renouvellements à la fin de la période en cours.",
    canceled:
      "Le renouvellement est arrêté. L’accès est maintenu pour la période payée.",
    change:
      "Pour changer de formule, arrêtez le renouvellement et choisissez une autre formule à la fin de la période payée.",
    ENROLLING: "Non démarré",
    CHECKOUT: "Paiement en attente",
    ACTIVE: "Actif",
    PAST_DUE: "Paiement en retard",
    ACTION_REQUIRED: "Action de paiement requise",
    CANCELED: "Résilié",
    EXPIRED: "Paiement expiré",
    INCOMPLETE: "Paiement en attente",
    INCOMPLETE_EXPIRED: "Expiré",
    TRIALING: "Essai",
    PAUSED: "En pause",
    UNPAID: "Impayé",
  },
  ar: {
    title: "التجديد الشهري",
    plan: "خطة الاشتراك",
    start: "بدء الاشتراك الشهري",
    consent:
      "أوافق على المبلغ الشهري المعروض والتجديد التلقائي حتى إلغاء الاشتراك.",
    immediate:
      "تبدأ الفوترة فوراً وتنهي ما تبقى من الفترة التجريبية المجانية. يستمر الوصول حتى نهاية كل فترة مدفوعة.",
    unavailable:
      "ينتظر الدفع المتكرر حساب دفع معتمداً. تبقى الفواتير اليدوية متاحة.",
    amount: "السعر الشهري المتفق عليه",
    period: "نهاية الفترة المدفوعة الحالية",
    perMonth: "/ شهر",
    payment: "إدارة وسيلة الدفع",
    cancel: "إلغاء التجديد",
    cancelConsent: "إيقاف التجديدات المقبلة في نهاية الفترة الحالية.",
    canceled: "تم إلغاء التجديد. يستمر الوصول خلال الفترة المدفوعة.",
    change:
      "لتغيير الخطة، ألغِ التجديد ثم اختر خطة أخرى بعد انتهاء الفترة المدفوعة.",
    ENROLLING: "لم يبدأ",
    CHECKOUT: "الدفع قيد الانتظار",
    ACTIVE: "نشط",
    PAST_DUE: "دفع متأخر",
    ACTION_REQUIRED: "الدفع يتطلب إجراءً",
    CANCELED: "ملغى",
    EXPIRED: "انتهت صفحة الدفع",
    INCOMPLETE: "الدفع قيد الانتظار",
    INCOMPLETE_EXPIRED: "منتهي",
    TRIALING: "تجريبي",
    PAUSED: "متوقف مؤقتاً",
    UNPAID: "غير مدفوع",
  },
} as const;
type Enrollment = {
  id: string;
  planId: string;
  planName: string;
  monthlyPrice: string;
  currency: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};
type Billing = {
  configured: boolean;
  enrollment: Enrollment | null;
  plans: { id: string; name: string; monthlyPrice: string }[];
};
export function RecurringBilling() {
  const locale = usePreferences((s) => s.locale),
    text = labels[locale] ?? labels.en;
  const client = useQueryClient(),
    keys = useRef(new Map<string, string>());
  const [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>();
  const query = useQuery({
    queryKey: ["billing", "recurring"],
    queryFn: () => request<Billing>("/billing/recurring"),
    refetchInterval: 30000,
  });
  const data = query.data,
    enrollment = data?.enrollment;
  const active =
    enrollment &&
    !["CANCELED", "EXPIRED", "INCOMPLETE_EXPIRED"].includes(enrollment.status);
  const managing =
    active && !["ENROLLING", "CHECKOUT"].includes(enrollment.status);
  function redirect(url: string, portal = false) {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !==
        (portal ? "billing.stripe.com" : "checkout.stripe.com")
    )
      throw new Error("The payment provider returned an unsupported page.");
    window.location.assign(url);
  }
  async function start(planId: string) {
    setPending(true);
    setError(null);
    const key = keys.current.get(planId) ?? crypto.randomUUID();
    keys.current.set(planId, key);
    try {
      const result = await mutate<{ url: string }>(
        "/billing/recurring/checkout",
        { planId, consent: "monthly-renewal-v1" },
        "POST",
        key,
      );
      redirect(result.url);
    } catch (err) {
      if (err instanceof ApiError && err.status === 410)
        keys.current.delete(planId);
      setError(err);
      await client.invalidateQueries({ queryKey: ["billing"] });
    } finally {
      setPending(false);
    }
  }
  async function manage(cancel = false) {
    if (!enrollment) return;
    setPending(true);
    setError(null);
    try {
      const result = await mutate<{ url?: string }>(
        `/billing/recurring/${enrollment.id}/${cancel ? "cancel" : "payment-method"}`,
        cancel ? { confirmed: true } : {},
      );
      if (result.url) redirect(result.url, true);
      await client.invalidateQueries({ queryKey: ["billing"] });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel settings-form">
      <h2>{text.title}</h2>
      <Notice error={error ?? query.error} />
      {query.isPending && <Loading />}
      {data && (
        <>
          {!data.configured && <p>{text.unavailable}</p>}
          {enrollment && (
            <>
              <Badge tone={enrollment.status === "ACTIVE" ? "green" : "gold"}>
                {text[enrollment.status as keyof typeof text] ??
                  enrollment.status}
              </Badge>
              <h3>{enrollment.planName}</h3>
              <p>
                {text.amount}:{" "}
                <Money
                  value={enrollment.monthlyPrice}
                  currency={enrollment.currency}
                />{" "}
                {text.perMonth}
              </p>
              {enrollment.currentPeriodEnd && (
                <p>
                  {text.period}:{" "}
                  {new Date(enrollment.currentPeriodEnd).toLocaleDateString(
                    locale,
                  )}
                </p>
              )}
              {enrollment.cancelAtPeriodEnd && (
                <p role="status">{text.canceled}</p>
              )}
            </>
          )}
          {managing ? (
            <>
              <Button
                disabled={pending || !data.configured}
                variant="secondary"
                onClick={() => void manage()}
              >
                {text.payment}
              </Button>
              {!enrollment.cancelAtPeriodEnd && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void manage(true);
                  }}
                >
                  <fieldset disabled={pending || !data.configured}>
                    <label className="renewal-consent">
                      <input type="checkbox" required />
                      {text.cancelConsent}
                    </label>
                    <Button type="submit" variant="secondary">
                      {text.cancel}
                    </Button>
                  </fieldset>
                </form>
              )}
              <p className="field-help">{text.change}</p>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void start(String(new FormData(e.currentTarget).get("planId")));
              }}
            >
              <fieldset disabled={pending || !data.configured}>
                <label>
                  {text.plan}
                  <select
                    name="planId"
                    defaultValue={active ? enrollment.planId : undefined}
                    required
                  >
                    {data.plans.map((plan) => (
                      <option value={plan.id} key={plan.id}>
                        {plan.name} · {plan.monthlyPrice} MAD {text.perMonth}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="field-help">{text.immediate}</p>
                <label className="renewal-consent">
                  <input type="checkbox" required />
                  {text.consent}
                </label>
                <Button type="submit">{text.start}</Button>
              </fieldset>
            </form>
          )}
        </>
      )}
    </section>
  );
}
