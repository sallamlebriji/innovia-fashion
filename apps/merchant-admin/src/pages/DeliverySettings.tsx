import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import { Button, Badge, Money } from "@innovia/ui";
import { useWorkspace } from "../App";
import { Modal, Notice, Loading, PageTitle } from "../components";
type Settings = {
  taxRate: string;
  reservationMinutes: number;
  refundShipping: boolean;
  legalName: string;
  invoiceAddress: string;
  taxIdentifier: string;
  contactEmail: string;
  contactPhone: string;
  returnPolicy: string;
  deliveryPolicy: string;
};
type Zone = {
  id: string;
  name: string;
  cities: string[];
  fee: string;
  active: boolean;
};
export function DeliverySettings() {
  const { session } = useWorkspace(),
    client = useQueryClient();
  const [zone, setZone] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(),
    [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["commerce"],
    queryFn: () => request<{ settings: Settings; zones: Zone[] }>("/commerce"),
  });
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setPending(true);
    setError(null);
    try {
      if (zone)
        await mutate("/commerce/zones", {
          ...data,
          cities: String(data.cities)
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
        });
      else
        await mutate(
          "/commerce/settings",
          {
            ...data,
            refundShipping: data.refundShipping === "on",
            reservationMinutes: Number(data.reservationMinutes),
          },
          "PUT",
        );
      await client.invalidateQueries({ queryKey: ["commerce"] });
      setZone(false);
      setMessage("Commerce settings saved.");
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="DELIVERY & COMMERCE"
        title="Consider every last detail."
        subtitle="Configure delivery zones, inclusive tax information, reservations and boutique policies."
      />
      <Notice error={error || query.error} />
      {message && <p role="status">{message}</p>}
      {query.isPending ? (
        <Loading />
      ) : (
        <div className="settings-layout">
          <section className="panel">
            <div className="panel-heading">
              <h2>Business and checkout details</h2>
            </div>
            <form className="settings-form" onSubmit={submit}>
              <fieldset disabled={session.user.role === "CASHIER" || pending}>
                <div className="form-grid">
                  {(
                    [
                      "legalName",
                      "taxIdentifier",
                      "contactEmail",
                      "contactPhone",
                    ] as const
                  ).map((k) => (
                    <label key={k}>
                      {
                        {
                          legalName: "Invoice legal name",
                          taxIdentifier: "Tax identifier",
                          contactEmail: "Contact email",
                          contactPhone: "Contact phone",
                        }[k]
                      }
                      <input
                        name={k}
                        type={k === "contactEmail" ? "email" : "text"}
                        defaultValue={query.data?.settings[k]}
                      />
                    </label>
                  ))}
                  <label className="span-2">
                    Invoice address
                    <textarea
                      name="invoiceAddress"
                      maxLength={500}
                      defaultValue={query.data?.settings.invoiceAddress}
                    />
                  </label>
                  <label>
                    Included tax rate (%)
                    <input
                      name="taxRate"
                      inputMode="decimal"
                      required
                      defaultValue={query.data?.settings.taxRate}
                    />
                    <small>
                      Entered product and shipping prices include this
                      configured tax. Choose the rate applicable to your
                      business.
                    </small>
                  </label>
                  <label>
                    Reservation duration (minutes)
                    <input
                      type="number"
                      name="reservationMinutes"
                      min={15}
                      max={10080}
                      required
                      defaultValue={query.data?.settings.reservationMinutes}
                    />
                  </label>
                  <label className="check-label span-2">
                    <input
                      name="refundShipping"
                      type="checkbox"
                      defaultChecked={query.data?.settings.refundShipping}
                    />
                    Return the shipping fee on a full return
                  </label>
                  <label className="span-2">
                    Return policy
                    <textarea
                      name="returnPolicy"
                      rows={5}
                      maxLength={5000}
                      defaultValue={query.data?.settings.returnPolicy}
                    />
                  </label>
                  <label className="span-2">
                    Delivery policy
                    <textarea
                      name="deliveryPolicy"
                      rows={5}
                      maxLength={5000}
                      defaultValue={query.data?.settings.deliveryPolicy}
                    />
                  </label>
                </div>
                <Button disabled={pending} type="submit">
                  Save commerce settings
                </Button>
              </fieldset>
            </form>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Delivery zones</h2>
              {session.user.role !== "CASHIER" && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setZone(true);
                    setError(null);
                  }}
                >
                  Add zone
                </Button>
              )}
            </div>
            {query.data?.zones.map((z) => (
              <div className="store-row" key={z.id}>
                <span>
                  <strong>{z.name}</strong>
                  <small>{z.cities.join(", ")}</small>
                  <Money value={z.fee} currency={session.tenant!.currency} />
                </span>
                <Badge tone={z.active ? "green" : "neutral"}>
                  {z.active ? "Active" : "Paused"}
                </Badge>
                {session.user.role !== "CASHIER" && (
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={async () => {
                      setPending(true);
                      try {
                        await mutate(
                          `/commerce/zones/${z.id}`,
                          { active: !z.active },
                          "PATCH",
                        );
                        await client.invalidateQueries({
                          queryKey: ["commerce"],
                        });
                      } catch (err) {
                        setError(err);
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    {z.active ? "Pause" : "Activate"}
                  </Button>
                )}
              </div>
            ))}
            {!query.data?.zones.length && (
              <p className="modal-body">
                Add a delivery zone to enable cash-on-delivery checkout.
              </p>
            )}
          </section>
        </div>
      )}
      {zone && (
        <Modal title="A new destination." onClose={() => setZone(false)}>
          <form className="modal-body" onSubmit={submit}>
            <label>
              Zone name
              <input name="name" required minLength={2} />
            </label>
            <label>
              Covered cities
              <textarea
                name="cities"
                required
                placeholder="Casablanca, Mohammedia"
              />
              <small>Separate city names with commas.</small>
            </label>
            <label>
              Shipping fee ({session.tenant!.currency})
              <input name="fee" required inputMode="decimal" />
            </label>
            <Notice error={error} />
            <Button type="submit" disabled={pending}>
              Create zone
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
