import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import { Button, Badge } from "@innovia/ui";
import { Notice, Loading } from "../components";
type Configuration = {
  enabled: boolean;
  providerConfigured: boolean;
  credits: number;
  used: number;
  period: string;
  jobs: { status: string; _count: number }[];
};
export function VirtualFitting() {
  const client = useQueryClient(),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false);
  const config = useQuery({
    queryKey: ["ai"],
    queryFn: () => request<Configuration>("/ai"),
  });
  async function toggle() {
    setPending(true);
    setError(null);
    try {
      await mutate("/ai", { enabled: !config.data?.enabled }, "PUT");
      await client.invalidateQueries({ queryKey: ["ai"] });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A DIFFERENT PERSPECTIVE</span>
          <h1>Virtual fitting.</h1>
          <p>Private photo previews with a monthly credit allowance.</p>
        </div>
      </div>
      <Notice error={error ?? config.error} />
      {config.isPending && <Loading />}
      {config.data && (
        <section className="panel" style={{ padding: 28 }}>
          <Badge tone={config.data.providerConfigured ? "green" : "gold"}>
            {config.data.providerConfigured
              ? "Provider configured"
              : "Provider setup required"}
          </Badge>
          <h2>
            {config.data.used} / {config.data.credits} credits used
          </h2>
          <p>
            Allowance period: {config.data.period} (UTC calendar month). Failed
            jobs return their credits automatically.
          </p>
          <p>
            Customers must sign in, confirm they are adults, and consent to
            processing their own photo by Fal. Photos and results expire after
            24 hours and can be deleted sooner.
          </p>
          {!config.data.providerConfigured && (
            <p>
              The platform operator must configure FAL_KEY and approve the
              provider’s privacy and processing terms before this feature can be
              enabled.
            </p>
          )}
          <Button
            disabled={
              pending ||
              (!config.data.enabled &&
                (!config.data.providerConfigured || !config.data.credits))
            }
            onClick={toggle}
          >
            {pending
              ? "Saving…"
              : config.data.enabled
                ? "Disable virtual fitting"
                : "Enable virtual fitting"}
          </Button>
          <div className="action-row" style={{ marginTop: 24 }}>
            {config.data.jobs.map((job) => (
              <Badge key={job.status}>
                {job.status.toLowerCase()}: {job._count}
              </Badge>
            ))}
          </div>
          <p>
            Configure each eligible product’s garment image in the product
            editor. Generated previews illustrate appearance; they do not
            measure the customer or guarantee fit.
          </p>
        </section>
      )}
    </>
  );
}
