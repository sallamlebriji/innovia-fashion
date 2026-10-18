import { useCommerceWords as useWords } from "./commerce-words";
import { usePreferences } from "./state";
import { Badge, Money, EmptyState } from "@innovia/ui";
import type { Order } from "@innovia/types";
import { Receipt, Check, ShoppingBag } from "lucide-react";
export function OrderTable({
  orders,
  currency = "MAD",
}: {
  orders: Order[];
  currency?: string;
}) {
  const t = useWords();
  const locale = usePreferences((state) => state.locale);
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{t("Order / customer")}</th>
            <th>{t("Channel")}</th>
            <th>{t("Status")}</th>
            <th className="align-end">{t("Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <strong>
                  <bdi>{order.number}</bdi>
                </strong>
                <small>{order.customerName}</small>
              </td>
              <td>
                <span className="channel-pill">
                  {order.channel === "POS" ? (
                    <Receipt size={13} />
                  ) : (
                    <GlobeIcon />
                  )}
                  {t(order.channel === "POS" ? "In store" : "Online")}
                </span>
              </td>
              <td>
                <Badge
                  tone={
                    order.status === "COMPLETED"
                      ? "green"
                      : order.status === "PENDING"
                        ? "gold"
                        : "neutral"
                  }
                >
                  {order.status === "COMPLETED" && <Check size={11} />}{" "}
                  {t(order.status.toLowerCase())}
                </Badge>
              </td>
              <td className="align-end">
                <strong>
                  <Money
                    value={order.total}
                    currency={order.currency ?? currency}
                    locale={`${locale}-MA`}
                  />
                </strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!orders.length && (
        <EmptyState title={t("Your first order starts here.")}>
          {t("Sales will appear as your boutique grows.")}
        </EmptyState>
      )}
    </div>
  );
}
function GlobeIcon() {
  return <ShoppingBag size={13} />;
}
