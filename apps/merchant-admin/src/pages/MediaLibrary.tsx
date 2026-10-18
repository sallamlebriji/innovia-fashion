import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import { Button } from "@innovia/ui";
import { useWorkspace } from "../App";
import { Notice, Loading, PageTitle, Pagination } from "../components";
import { useWords } from "../words";
import { usePreferences } from "../state";
export function MediaLibrary() {
  const t = useWords(),
    { locale } = usePreferences();
  const { session } = useWorkspace(),
    client = useQueryClient(),
    input = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(),
    [message, setMessage] = useState("");
  const manager = session.user.role !== "CASHIER";
  const query = useQuery({
    queryKey: ["media", page],
    queryFn: () =>
      request<{
        items: { id: string; url: string; bytes: number; createdAt: string }[];
        total: number;
      }>(`/media?page=${page}`),
  });
  async function upload(file: File) {
    setPending(true);
    setError(null);
    setMessage("");
    try {
      if (
        file.size > 10 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        throw new Error("Choose a JPEG, PNG or WebP image up to 10 MB.");
      const response = await fetch("/api/v1/media", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": file.type,
          "X-CSRF-Token": session.csrfToken,
        },
        body: file,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message ?? "Upload failed.");
      await client.invalidateQueries({ queryKey: ["media"] });
      setMessage(
        "Image uploaded. Copy its URL into a product or storefront section.",
      );
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
      if (input.current) input.current.value = "";
    }
  }
  async function remove(id: string) {
    setPending(true);
    setError(null);
    try {
      await mutate(`/media/${id}`, {}, "DELETE");
      await client.invalidateQueries({ queryKey: ["media"] });
      setMessage("Unused image removed.");
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  const shownError = error || query.error;
  return (
    <>
      <PageTitle
        eyebrow={t("MEDIA LIBRARY")}
        title={t("Images that tell your story.")}
        subtitle={t(
          "Upload licensed images for products and campaigns. Images are resized and location metadata is removed.",
        )}
        action={
          manager && (
            <>
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload(file);
                }}
              />
              <Button disabled={pending} onClick={() => input.current?.click()}>
                {t(pending ? "Processing…" : "Upload image")}
              </Button>
            </>
          )
        }
      />
      <Notice
        error={shownError instanceof Error ? t(shownError.message) : shownError}
      />
      {message && <p role="status">{t(message)}</p>}
      {query.isPending ? (
        <Loading />
      ) : (
        <section className="panel">
          <div className="media-library-grid">
            {query.data?.items.map((asset) => (
              <article key={asset.id}>
                <img
                  src={asset.url}
                  alt={t("Uploaded boutique asset")}
                  loading="lazy"
                />
                <div>
                  <small>
                    {Math.ceil(asset.bytes / 1024).toLocaleString(locale)}{" "}
                    {t("KB")} ·{" "}
                    {new Date(asset.createdAt).toLocaleDateString(locale)}
                  </small>
                  <input
                    aria-label={t("Image URL")}
                    dir="ltr"
                    readOnly
                    value={asset.url}
                    onFocus={(event) => event.target.select()}
                  />
                  <div className="action-row">
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(asset.url);
                          setMessage("Image URL copied.");
                        } catch {
                          setMessage("Select the image URL above and copy it.");
                        }
                      }}
                    >
                      {t("Copy URL")}
                    </Button>
                    {manager && (
                      <Button
                        disabled={pending}
                        variant="ghost"
                        onClick={() => remove(asset.id)}
                      >
                        {t("Delete unused")}
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {query.data?.total === 0 && (
            <p>{t("Upload your first product or campaign image.")}</p>
          )}
          <Pagination
            page={page}
            total={query.data?.total ?? 0}
            onChange={setPage}
          />
        </section>
      )}
    </>
  );
}
