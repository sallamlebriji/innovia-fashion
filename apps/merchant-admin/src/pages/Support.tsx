import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import { Button, Badge } from "@innovia/ui";
import { Notice, Loading, PageTitle } from "../components";
type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  tenant?: { name: string };
  messages: {
    id: string;
    authorName: string;
    body: string;
    internal: boolean;
    createdAt: string;
  }[];
};
export function Support({ operator = false }: { operator?: boolean }) {
  const client = useQueryClient(),
    path = operator ? "/platform/workspaces/support" : "/support";
  const [selected, setSelected] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>();
  const query = useQuery({
    queryKey: ["support", operator],
    queryFn: () => request<Ticket[]>(path),
  });
  const current = query.data?.find((ticket) => ticket.id === selected);
  async function submit(
    event: React.FormEvent<HTMLFormElement>,
    reply: boolean,
  ) {
    event.preventDefault();
    const form = event.currentTarget,
      data = Object.fromEntries(new FormData(form));
    setPending(true);
    setError(null);
    try {
      const result = await mutate<Ticket>(
        reply ? `${path}/${selected}/messages` : path,
        { ...data, ...(operator ? { internal: data.internal === "on" } : {}) },
      );
      if (!reply) setSelected(result.id);
      form.reset();
      await client.invalidateQueries({ queryKey: ["support"] });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow={operator ? "PLATFORM SUPPORT" : "WORKSPACE SUPPORT"}
        title="Let’s keep things moving."
        subtitle="A private conversation between your workspace and the INNOVIA operator."
      />
      <Notice error={error || query.error} />
      {query.isPending ? (
        <Loading />
      ) : (
        <div className="studio-layout">
          <aside className="panel settings-form">
            <h2>Your requests</h2>
            {query.data?.map((ticket) => (
              <button
                key={ticket.id}
                className={`studio-section ${selected === ticket.id ? "active" : ""}`}
                onClick={() => setSelected(ticket.id)}
              >
                <div>
                  <strong>{ticket.subject}</strong>
                  <small>{ticket.tenant?.name ?? ticket.priority}</small>
                </div>
                <Badge>{ticket.status}</Badge>
              </button>
            ))}
            {!operator && (
              <button
                className="button button-secondary"
                onClick={() => setSelected("")}
              >
                New request
              </button>
            )}
          </aside>
          <section className="panel settings-form">
            {current ? (
              <>
                <h2>{current.subject}</h2>
                <Badge>{current.status}</Badge>
                {current.messages.map((item) => (
                  <article
                    className={`support-message ${item.internal ? "internal" : ""}`}
                    key={item.id}
                  >
                    <strong>
                      {item.authorName}
                      {item.internal && " · Operator note"}
                    </strong>
                    <p>{item.body}</p>
                    <small>{new Date(item.createdAt).toLocaleString()}</small>
                  </article>
                ))}
                <form onSubmit={(event) => submit(event, true)}>
                  <fieldset disabled={pending}>
                    <label>
                      Your reply
                      <textarea
                        name="body"
                        required
                        minLength={3}
                        maxLength={5000}
                        rows={5}
                      />
                    </label>
                    {operator && (
                      <>
                        <label>
                          Status
                          <select name="status" defaultValue={current.status}>
                            <option>OPEN</option>
                            <option>IN_PROGRESS</option>
                            <option>RESOLVED</option>
                          </select>
                        </label>
                        <label className="check-label">
                          <input type="checkbox" name="internal" />
                          Private operator note
                        </label>
                      </>
                    )}
                    <Button disabled={pending}>Send reply</Button>
                  </fieldset>
                </form>
              </>
            ) : !operator ? (
              <form onSubmit={(event) => submit(event, false)}>
                <fieldset disabled={pending}>
                  <h2>How can we help?</h2>
                  <label>
                    Subject
                    <input
                      name="subject"
                      required
                      minLength={3}
                      maxLength={150}
                    />
                  </label>
                  <label>
                    Priority
                    <select name="priority">
                      <option>MEDIUM</option>
                      <option>LOW</option>
                      <option>HIGH</option>
                    </select>
                  </label>
                  <label>
                    Your request
                    <textarea
                      name="body"
                      required
                      minLength={3}
                      maxLength={5000}
                      rows={7}
                    />
                  </label>
                  <p className="field-help">
                    Keep passwords, payment details and customer photos out of
                    support messages.
                  </p>
                  <Button disabled={pending}>Create request</Button>
                </fieldset>
              </form>
            ) : (
              <p>Select a request to reply.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
