import { useCommerceWords as useWords } from "../commerce-words";
import { useCountWords } from "../count-words";
import { usePreferences } from "../state";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import { Button, Money, Badge } from "@innovia/ui";
import type { Order } from "@innovia/types";
import { Modal, Loading, Notice, Pagination } from "../components";
import { useWorkspace } from "../App";
type Profile = {
  customer: {
    name: string;
    email: string;
    phone: string;
    notes: string;
    preferences: {
      sizes: string[];
      categories: string[];
      preferredStoreId: string | null;
    } | null;
    consents: { purpose: string; granted: boolean }[];
    loyaltyAccount: null | {
      points: number;
      cardCode: string;
      redemptions: { id: string; status: string; reward: { name: string } }[];
    };
  };
  summary: {
    fulfilledPurchases: number;
    repeat: boolean;
    lifetimeNetSales: string;
    estimateMethod: string;
    stores: { storeId: string; name: string; _count: number }[];
  };
  orders: { items: Order[]; total: number };
};
export function CustomerProfile({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const t = useWords();
  const countWords = useCountWords();
  const locale = usePreferences((state) => state.locale);
  const { session } = useWorkspace(),
    client = useQueryClient(),
    [page, setPage] = useState(1),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ["crm", id, page],
    queryFn: () => request<Profile>(`/crm/customers/${id}?page=${page}`),
  });
  const profile = query.data;
  return (
    <Modal
      title={profile?.customer.name ?? t("Customer profile")}
      onClose={onClose}
      wide
    >
      <div className="modal-body">
        <Notice error={error ?? query.error} />
        {query.isPending && <Loading />}
        {profile && (
          <>
            <p>
              <bdi>{profile.customer.email}</bdi> ·{" "}
              <bdi>{profile.customer.phone}</bdi>
            </p>
            <div className="form-grid customer-profile-grid">
              <section>
                <h3>{t("Recorded customer value")}</h3>
                <h2>
                  <Money
                    value={profile.summary.lifetimeNetSales}
                    currency={session.tenant!.currency}
                    locale={`${locale}-MA`}
                  />
                </h2>
                <p>{t(profile.summary.estimateMethod)}</p>
                <Badge>
                  {t(
                    profile.summary.repeat
                      ? "Repeat customer"
                      : "First purchase or new customer",
                  )}
                </Badge>
                <p>
                  {t("Recorded fulfilled purchases")}:{" "}
                  {profile.summary.fulfilledPurchases.toLocaleString(
                    `${locale}-MA`,
                  )}
                </p>
                <h3>{t("Stores visited")}</h3>
                {profile.summary.stores.map((store) => (
                  <p key={store.storeId}>
                    {store.name} · {countWords(store._count, "order")}
                  </p>
                ))}
              </section>
              <section>
                <h3>{t("Membership & consent")}</h3>
                {profile.customer.loyaltyAccount ? (
                  <p>
                    {t("Points")}:{" "}
                    {profile.customer.loyaltyAccount.points.toLocaleString(
                      `${locale}-MA`,
                    )}{" "}
                    ·{" "}
                    <code dir="ltr">
                      {profile.customer.loyaltyAccount.cardCode}
                    </code>
                  </p>
                ) : (
                  <p>{t("Not enrolled.")}</p>
                )}
                {profile.customer.consents.map((consent) => (
                  <p key={consent.purpose}>
                    {t(consent.purpose.toLowerCase().replaceAll("_", " "))}:{" "}
                    {t(consent.granted ? "Opted in" : "Opted out")}
                  </p>
                ))}
                <h3>{t("Shopping preferences")}</h3>
                <p>
                  {profile.customer.preferences
                    ? `${t("Sizes:")} ${profile.customer.preferences.sizes.join(", ") || t("Not supplied")}. ${t("Categories:")} ${profile.customer.preferences.categories.join(", ") || t("Not supplied")}.`
                    : t("Not supplied by the customer.")}
                </p>
              </section>
            </div>
            <h3>{t("Manager notes")}</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const notes = new FormData(e.currentTarget).get("notes");
                setPending(true);
                setError(null);
                try {
                  await mutate(`/crm/customers/${id}`, { notes }, "PATCH");
                  await client.invalidateQueries({ queryKey: ["crm", id] });
                } catch (err) {
                  setError(err);
                } finally {
                  setPending(false);
                }
              }}
            >
              <label>
                {t("Notes")}
                <textarea
                  name="notes"
                  aria-label={t("Notes")}
                  key={profile.customer.notes}
                  defaultValue={profile.customer.notes}
                  maxLength={2000}
                  rows={4}
                />
              </label>
              <Button type="submit" disabled={pending}>
                {t("Save private notes")}
              </Button>
            </form>
            <h3>{t("Purchase history")}</h3>
            {profile.orders.items.map((order) => (
              <div key={order.id} className="receipt-line">
                <span>
                  <bdi>{order.number}</bdi> · {t(order.status.toLowerCase())}
                  <small>
                    {new Date(order.createdAt).toLocaleString(`${locale}-MA`)} ·{" "}
                    {order.store.name}
                  </small>
                </span>
                <Money
                  value={Number(order.total) - Number(order.refundedTotal ?? 0)}
                  currency={order.currency}
                  locale={`${locale}-MA`}
                />
              </div>
            ))}
            <Pagination
              page={page}
              total={profile.orders.total}
              onChange={setPage}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
