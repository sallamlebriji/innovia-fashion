import { useCommerceWords as useWords } from "../commerce-words";
import { useState } from "react";
import { mutate } from "@innovia/api-client";
import { Button } from "@innovia/ui";
import type { Order } from "@innovia/types";
import { Notice } from "../components";
export function DeliveryActions({
  order,
  onDone,
}: {
  order: Order;
  onDone: () => Promise<void>;
}) {
  const t = useWords();
  const [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await mutate(
        `/orders/${order.id}/delivery`,
        {
          status: order.status === "PENDING" ? "SHIPPED" : "RETURNED",
          ...data,
        },
        "POST",
        crypto.randomUUID(),
      );
      await onDone();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  if (
    order.paymentMethod !== "CASH_ON_DELIVERY" ||
    !["PENDING", "IN_FULFILMENT"].includes(order.status)
  )
    return null;
  return (
    <form onSubmit={submit} className="delivery-action">
      <h3>
        {t(
          order.status === "PENDING"
            ? "Arrange delivery"
            : "Delivery in progress",
        )}
      </h3>
      <p>
        {order.shippingAddress?.recipient}
        <br />
        {order.shippingAddress?.street}
        <br />
        {order.shippingAddress?.city} {order.shippingAddress?.postalCode}
        <br />
        <bdi>{order.shippingAddress?.phone}</bdi>
      </p>
      {order.status === "PENDING" ? (
        <div className="form-grid">
          <label>
            {t("Carrier")}
            <input name="carrier" required maxLength={100} />
          </label>
          <label>
            {t("Tracking reference")}
            <input name="trackingNumber" dir="ltr" required maxLength={150} />
          </label>
          <label className="check-label span-2">
            <input type="checkbox" required />
            {t("These pieces have been handed to the carrier.")}
          </label>
        </div>
      ) : (
        <>
          <p>
            {order.carrier} · <bdi>{order.trackingNumber}</bdi>
          </p>
          <label className="check-label">
            <input type="checkbox" required />
            {t(
              "Delivery failed and every piece has been returned in sellable condition. No payment was collected.",
            )}
          </label>
        </>
      )}
      <Notice error={error} />
      <Button disabled={pending} variant="secondary">
        {t(
          pending
            ? "Saving…"
            : order.status === "PENDING"
              ? "Record dispatch"
              : "Record failed delivery & restock",
        )}
      </Button>
    </form>
  );
}
