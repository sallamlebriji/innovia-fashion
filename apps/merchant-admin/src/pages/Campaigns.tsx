import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import { Button, Badge } from "@innovia/ui";
import { PageTitle, Notice, Loading, Pagination } from "../components";
type Campaign = {
  id: string;
  name: string;
  title: string;
  body: string;
  segment: string;
  status: string;
  scheduledAt: string | null;
  _count: { deliveries: number };
};
export function Campaigns() {
  const client = useQueryClient(),
    [page, setPage] = useState(1),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ["campaigns", page],
    queryFn: () =>
      request<{ items: Campaign[]; total: number }>(`/campaigns?page=${page}`),
    refetchInterval: 30000,
  });
  async function save(path: string, body: unknown) {
    setPending(true);
    setError(null);
    try {
      await mutate(path, body);
      await client.invalidateQueries({ queryKey: ["campaigns"] });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR COMMUNITY, CONSIDERED"
        title="Customer campaigns."
        subtitle="Send scheduled announcements to customers who choose to hear from you."
      />
      <Notice error={error ?? query.error} />
      <section className="panel" style={{ padding: 24 }}>
        <h2>Draft an announcement</h2>
        <p>
          Messages appear in customer accounts and the mobile inbox. Each
          recipient must explicitly consent to in-app marketing. Email, SMS and
          push delivery require configured providers.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.currentTarget));
            void save("/campaigns", {
              ...data,
              scheduledAt: data.scheduledAt
                ? new Date(String(data.scheduledAt)).toISOString()
                : null,
            });
          }}
        >
          <fieldset disabled={pending}>
            <div className="form-grid">
              <label>
                Internal campaign name
                <input name="name" minLength={2} maxLength={100} required />
              </label>
              <label>
                Audience
                <select name="segment">
                  <option value="ALL">All opted-in account holders</option>
                  <option value="MEMBERS">Loyalty members</option>
                  <option value="REPEAT">
                    At least two fulfilled purchases
                  </option>
                  <option value="LAPSED">
                    Last fulfilled purchase over 90 days ago
                  </option>
                </select>
              </label>
              <label className="span-2">
                Message title
                <input name="title" minLength={2} maxLength={160} required />
              </label>
              <label className="span-2">
                Message
                <textarea
                  name="body"
                  minLength={5}
                  maxLength={2000}
                  rows={5}
                  required
                />
              </label>
              <label>
                Send at (optional)
                <input name="scheduledAt" type="datetime-local" />
              </label>
            </div>
            <Button type="submit">Save announcement draft</Button>
          </fieldset>
        </form>
      </section>
      <section className="panel" style={{ padding: 24, marginTop: 24 }}>
        {query.isPending && <Loading />}
        {query.data?.items.map((campaign) => (
          <article className="variant-editor" key={campaign.id}>
            <h3>
              {campaign.name} <Badge>{campaign.status.toLowerCase()}</Badge>
            </h3>
            <h4>{campaign.title}</h4>
            <p style={{ whiteSpace: "pre-wrap" }}>{campaign.body}</p>
            <p>
              {campaign.segment.toLowerCase()} · {campaign._count.deliveries}{" "}
              inbox deliveries
              {campaign.scheduledAt
                ? ` · ${new Date(campaign.scheduledAt).toLocaleString()}`
                : ""}
            </p>
            <div className="action-row">
              {campaign.status === "DRAFT" && (
                <Button
                  disabled={pending}
                  onClick={() =>
                    void save(`/campaigns/${campaign.id}/publish`, {})
                  }
                >
                  {campaign.scheduledAt
                    ? "Schedule this announcement"
                    : "Publish this announcement"}
                </Button>
              )}
              {["DRAFT", "SCHEDULED", "PUBLISHING"].includes(
                campaign.status,
              ) && (
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    void save(`/campaigns/${campaign.id}/cancel`, {})
                  }
                >
                  Cancel remaining deliveries
                </Button>
              )}
            </div>
          </article>
        ))}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </section>
    </>
  );
}
