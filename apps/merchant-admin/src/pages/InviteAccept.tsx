import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { mutate, setCsrfToken } from "@innovia/api-client";
import { Button } from "@innovia/ui";
import type { Session } from "@innovia/types";
import { Notice } from "../components";
export function InviteAccept({ token }: { token: string }) {
  const client = useQueryClient(),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setError(null);
    try {
      const session = await mutate<Session>("/auth/accept-invite", {
        ...data,
        token,
      });
      setCsrfToken(session.csrfToken);
      window.history.replaceState({}, "", "/");
      client.clear();
      client.setQueryData(["session"], session);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-form">
        <span className="wordmark">INNOVIA</span>
        <h1>A place on the team.</h1>
        <p>Use the invited email address to activate your workspace access.</p>
        <Notice error={error} />
        <form onSubmit={submit}>
          <fieldset disabled={pending}>
            <label>
              Your name
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
              />
            </label>
            <label>
              Invited email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Create a password
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </label>
            <Button disabled={pending}>
              {pending ? "Activating…" : "Accept invitation"}
            </Button>
          </fieldset>
        </form>
      </section>
    </main>
  );
}
