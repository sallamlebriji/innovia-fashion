import { useWords } from "../words";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import type { Session, Tenant } from "@innovia/types";
import { Button, Badge } from "@innovia/ui";
import { ArrowUpRight, Save, Plus, MapPin, Check } from "lucide-react";
import { useWorkspace } from "../App";
import { Modal, Notice, PageTitle, Picture } from "../components";
import { SubscriptionSummary } from "./Subscription";
import { Billing } from "./Billing";
import { RecurringBilling } from "./RecurringBilling";
export function Settings({ storefront = false }: { storefront?: boolean }) {
  const t = useWords();
  const { session, stores } = useWorkspace(),
    client = useQueryClient();
  const tenant = session.tenant!;
  const [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false),
    [saved, setSaved] = useState(false),
    [store, setStore] = useState(false),
    [hero, setHero] = useState(tenant.heroImage);
  const canEdit = session.user.role !== "CASHIER";
  useEffect(() => setHero(tenant.heroImage), [tenant.heroImage]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));
      const updated = await mutate<Tenant>("/settings", data, "PATCH");
      client.setQueryData<Session>(["session"], (old) =>
        old ? { ...old, tenant: updated } : old,
      );
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  async function addStore(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await mutate(
        "/stores",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      await client.invalidateQueries({ queryKey: ["stores"] });
      setStore(false);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <SubscriptionSummary />
      {session.user.role === "OWNER" && <RecurringBilling />}
      <Billing />
      <PageTitle
        title={
          storefront
            ? t("Your brand. Beautifully expressed.")
            : t("Make this workspace yours.")
        }
        subtitle={
          storefront
            ? t("Shape your storefront’s identity and editorial campaign.")
            : t("A considered home for your boutique’s details.")
        }
        eyebrow={storefront ? t("ONLINE STORE") : t("WORKSPACE SETTINGS")}
        action={
          <a
            href={`${session.storefrontOrigin}/${encodeURIComponent(tenant.slug)}`}
            target="_blank"
            rel="noreferrer"
            className="button button-secondary"
          >
            {" "}
            {t("View storefront")} <ArrowUpRight size={15} />
          </a>
        }
      />
      <div className="settings-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                {storefront
                  ? t("Brand & campaign studio")
                  : t("Brand identity")}
              </h2>
              <p> {t("Your changes are shared with your live storefront.")} </p>
            </div>
            <Badge tone="green"> {t("Connected")} </Badge>
          </div>
          <form className="settings-form" key={tenant.id} onSubmit={submit}>
            <fieldset disabled={!canEdit || pending}>
              <div className="form-grid">
                <label className="span-2">
                  {" "}
                  {t("Business name")}{" "}
                  <input name="name" required defaultValue={tenant.name} />
                </label>
                <label>
                  {" "}
                  {t("Accent color")}{" "}
                  <div className="color-input">
                    <input
                      name="accent"
                      type="color"
                      defaultValue={tenant.accent}
                    />
                    <span> {t("Your brand’s signature accent")} </span>
                  </div>
                </label>
                <label>
                  {" "}
                  {t("Storefront language")}{" "}
                  <select name="locale" defaultValue={tenant.locale}>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="ar">العربية</option>
                  </select>
                </label>
                <label>
                  {" "}
                  {t("Currency")}{" "}
                  <select name="currency" defaultValue={tenant.currency}>
                    <option>MAD</option>
                    <option>EUR</option>
                    <option>USD</option>
                  </select>
                  <small>
                    {" "}
                    {t("Currency changes require an empty catalog.")}{" "}
                  </small>
                </label>
                <label>
                  {" "}
                  {t("Store URL")} <input readOnly value={`/${tenant.slug}`} />
                </label>
                <label className="span-2">
                  {" "}
                  {t("Campaign heading")}{" "}
                  <input
                    name="heroTitle"
                    required
                    maxLength={120}
                    defaultValue={tenant.heroTitle}
                  />
                </label>
                <label className="span-2">
                  {" "}
                  {t("Campaign subtitle")}{" "}
                  <input
                    name="heroSubtitle"
                    maxLength={200}
                    defaultValue={tenant.heroSubtitle}
                  />
                </label>
                <label className="span-2">
                  {" "}
                  {t("Campaign image URL")}{" "}
                  <input
                    name="heroImage"
                    value={hero}
                    onChange={(e) => setHero(e.target.value)}
                    placeholder="https://…"
                  />
                  <small>
                    {" "}
                    {t(
                      "Use your own or licensed imagery. Paste an uploaded Media Library URL or an HTTPS image URL. Campaign videos and ordered sections are managed in Storefront Studio.",
                    )}{" "}
                  </small>
                </label>
              </div>
            </fieldset>
            <Notice error={error} />
            {saved && (
              <div className="success-notice" role="status">
                <Check size={16} /> {t("Your brand settings are saved.")}{" "}
              </div>
            )}
            {canEdit && (
              <Button disabled={pending} type="submit">
                <Save size={16} />
                {pending ? t("Saving…") : t("Save brand settings")}
              </Button>
            )}
          </form>
        </section>
        <div className="settings-aside">
          <section className="panel campaign-preview">
            <Picture src={hero} alt={t("Campaign preview")} />
            <div>
              <span className="eyebrow"> {t("CAMPAIGN PREVIEW")} </span>
              <h2>{tenant.heroTitle}</h2>
              <p>{tenant.heroSubtitle}</p>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2> {t("Your locations")} </h2>
                <p>
                  {stores.length} {t("of")} {tenant.plan.storeLimit}{" "}
                  {t("available")}{" "}
                </p>
              </div>
              {canEdit && (
                <button
                  className="icon-button"
                  aria-label={t("Add store")}
                  onClick={() => {
                    setStore(true);
                    setError(null);
                  }}
                >
                  <Plus size={18} />
                </button>
              )}
            </div>
            {stores.map((s) => (
              <div key={s.id} className="store-row">
                <MapPin size={17} />
                <span>
                  <strong>{s.name}</strong>
                  <small>
                    {s.city} · {t(s.kind ?? "STORE")}
                  </small>
                </span>
                <Badge tone="green"> {t("Active")} </Badge>
              </div>
            ))}
          </section>
          <section className="plan-detail">
            <span className="eyebrow"> {t("YOUR PLAN")} </span>
            <h3>{tenant.plan.name}</h3>
            <p>
              {tenant.plan.productLimit.toLocaleString()} {t("products")} ·{" "}
              {tenant.plan.storeLimit} {t("stores")}{" "}
            </p>
            <small>
              {" "}
              {t(
                "Manage paid periods and monthly renewal on this page. Plan limits apply to all operations.",
              )}{" "}
            </small>
          </section>
        </div>
      </div>
      {store && (
        <Modal
          title={t("A new location. More possibilities.")}
          onClose={() => setStore(false)}
        >
          <form onSubmit={addStore} className="modal-body">
            <label>
              {" "}
              {t("Store name")} <input name="name" required minLength={2} />
            </label>
            <label>
              {" "}
              {t("City")} <input name="city" required minLength={2} />
            </label>
            <label>
              {" "}
              {t("Location type")}{" "}
              <select name="kind">
                <option value="STORE"> {t("Retail store")} </option>
                <option value="WAREHOUSE"> {t("Warehouse")} </option>
              </select>
              <small>
                {" "}
                {t(
                  "Warehouses hold inventory but cannot accept checkout or pickup orders.",
                )}{" "}
              </small>
            </label>
            <Notice error={error} />
            <Button disabled={pending} type="submit">
              <Plus size={15} /> {t("Create store")}{" "}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
export async function refreshSession() {
  return request<Session>("/auth/me");
}
