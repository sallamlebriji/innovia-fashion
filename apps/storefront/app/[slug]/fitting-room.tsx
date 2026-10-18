"use client";
import { useEffect, useState } from "react";
type Job = {
  id: string;
  productId: string;
  photoId: string;
  outputId: string | null;
  status: string;
  creditedBack: boolean;
  expiresAt: string;
};
export function FittingRoom({
  slug,
  productId,
}: {
  slug: string;
  productId: string;
}) {
  const base = `/api/v1/storefront/${encodeURIComponent(slug)}`;
  const [enabled, setEnabled] = useState(false),
    [open, setOpen] = useState(false),
    [file, setFile] = useState<File>(),
    [consent, setConsent] = useState(false),
    [adult, setAdult] = useState(false),
    [csrf, setCsrf] = useState(""),
    [jobs, setJobs] = useState<Job[]>([]),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [compare, setCompare] = useState(50),
    [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`${base}/try-on`)
      .then((r) => r.json())
      .then((data) => {
        if (active) setEnabled(data.enabled === true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [base]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    async function load() {
      try {
        const session = await fetch(`${base}/customer/me`, {
          cache: "no-store",
          credentials: "include",
        });
        if (session.status === 401) {
          if (active) setSignedIn(false);
          return;
        }
        const data = await session.json();
        if (!session.ok) throw new Error(data.error?.message);
        const response = await fetch(`${base}/customer/try-on`, {
          cache: "no-store",
          credentials: "include",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message);
        if (active) {
          setSignedIn(true);
          setCsrf(data.csrfToken);
          setJobs(result.filter((job: Job) => job.productId === productId));
        }
      } catch (err) {
        if (active)
          setError(err instanceof Error ? err.message : "Please try again.");
      }
    }
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [open, base, productId]);
  async function action(path: string, method: string, body?: unknown) {
    const response = await fetch(`${base}/customer${path}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf,
        "Idempotency-Key": crypto.randomUUID(),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error?.message ?? "Please try again.");
    return data;
  }
  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !consent || !adult) return;
    setPending(true);
    setError("");
    let photoId = "";
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 10 * 1024 * 1024
      )
        throw new Error("Choose a JPEG, PNG or WebP photo smaller than 10 MB.");
      const response = await fetch(`${base}/customer/media`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": file.type,
          "X-CSRF-Token": csrf,
          "X-Photo-Consent": "self-photo-v1",
        },
        body: file,
      });
      const photo = await response.json();
      if (!response.ok) throw new Error(photo.error?.message);
      photoId = photo.id;
      const job = await action("/try-on", "POST", {
        productId,
        photoId,
        consent: true,
        adult: true,
      });
      setJobs((old) => [job, ...old]);
      setFile(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
      if (photoId) await action(`/media/${photoId}`, "DELETE").catch(() => {});
    } finally {
      setPending(false);
    }
  }
  async function remove(job: Job) {
    setPending(true);
    setError("");
    try {
      await action(`/try-on/${job.id}`, "DELETE");
      setJobs((old) => old.filter((item) => item.id !== job.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }
  async function download(job: Job) {
    setError("");
    try {
      const response = await fetch(`${base}/customer/media/${job.outputId}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("This preview has expired.");
      const url = URL.createObjectURL(await response.blob()),
        link = document.createElement("a");
      link.href = url;
      link.download = "innovia-fitting-preview.webp";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    }
  }
  if (!enabled) return null;
  return (
    <details
      className="fitting-room"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Try this piece on your photo</summary>
      <p>A private preview of the look. Size and fit are not guaranteed.</p>
      {!signedIn ? (
        <p>
          <a href={`/${slug}/account`}>Sign in to use the fitting room →</a>
        </p>
      ) : (
        <form className="store-checkout" onSubmit={generate}>
          <label>
            Your full-length photo
            <input
              key={file?.name ?? "empty"}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(e) => setFile(e.target.files?.[0])}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={adult}
              onChange={(e) => setAdult(e.target.checked)}
              required
            />{" "}
            I am 18 or older and this is a photo of me.
          </label>
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />{" "}
            I agree to send my photo to Fal to generate this preview. INNOVIA
            stores it privately for up to 24 hours. I have read this boutique’s
            privacy policy.
          </label>
          <button
            className="store-cta dark"
            disabled={pending || !file || !consent || !adult}
          >
            {pending ? "Preparing…" : "Create my fitting preview"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="store-error">
          {error}
        </p>
      )}
      {jobs.map((job) => (
        <article className="fitting-job" key={job.id} aria-live="polite">
          <p>
            {job.status === "COMPLETED"
              ? "Your preview is ready."
              : job.status === "FAILED"
                ? `This preview could not be created.${job.creditedBack ? " The boutique’s credit was returned." : ""}`
                : job.status === "CANCELLED"
                  ? "Cancelled"
                  : "Creating your preview…"}
          </p>
          {job.outputId && (
            <>
              <div className="fitting-compare">
                <img
                  src={`${base}/customer/media/${job.photoId}`}
                  alt="Your original photo"
                />
                <img
                  className="fitting-result"
                  style={{ clipPath: `inset(0 0 0 ${compare}%)` }}
                  src={`${base}/customer/media/${job.outputId}`}
                  alt="Generated fitting preview"
                />
              </div>
              <label>
                Before / after
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={compare}
                  onChange={(e) => setCompare(Number(e.target.value))}
                />
              </label>
              <button
                className="account-text-button"
                onClick={() => void download(job)}
              >
                Download preview
              </button>
            </>
          )}
          <p>Expires {new Date(job.expiresAt).toLocaleString()}.</p>
          <button
            disabled={pending}
            className="account-text-button"
            onClick={() => void remove(job)}
          >
            Delete this preview and its photos
          </button>
        </article>
      ))}
    </details>
  );
}
