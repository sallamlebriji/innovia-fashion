import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, mutate } from "@innovia/api-client";
import { Button, Badge } from "@innovia/ui";
import type { z } from "zod";
import type { cmsPageSchema, cmsSectionSchema } from "@innovia/validation";
import { storefrontDesignSchema } from "@innovia/validation";
import { useWorkspace } from "../App";
import { PageTitle, Notice, Loading } from "../components";
type Section = z.infer<typeof cmsSectionSchema>;
type Page = z.infer<typeof cmsPageSchema>;
type StoredPage = Page & { publishedAt: string | null };
const kinds: Section["kind"][] = [
  "HERO",
  "EDITORIAL",
  "FEATURED_COLLECTION",
  "PROMO",
  "BRAND_STORY",
  "VIDEO",
  "NEWSLETTER",
];
export function StorefrontStudio() {
  const { session } = useWorkspace(),
    client = useQueryClient(),
    tenant = session.tenant!;
  const [page, setPage] = useState<Page>({
      title: tenant.name,
      seoTitle: "",
      seoDescription: "",
      design: storefrontDesignSchema.parse({}),
      sections: [],
    }),
    [selected, setSelected] = useState(0),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(),
    [message, setMessage] = useState(""),
    [previewUrl, setPreviewUrl] = useState("");
  const query = useQuery({
    queryKey: ["cms"],
    queryFn: () => request<StoredPage | null>("/cms"),
  });
  const manager = session.user.role !== "CASHIER";
  useEffect(() => {
    if (query.data)
      setPage({
        title: query.data.title,
        seoTitle: query.data.seoTitle,
        seoDescription: query.data.seoDescription,
        design: query.data.design ?? storefrontDesignSchema.parse({}),
        sections: query.data.sections,
      });
  }, [query.data]);
  function update<K extends keyof Section>(key: K, value: Section[K]) {
    setPage((old) => ({
      ...old,
      sections: old.sections.map((s, i) =>
        i === selected ? { ...s, [key]: value } : s,
      ),
    }));
    setMessage("");
  }
  function add(kind: Section["kind"]) {
    setPage((old) => ({
      ...old,
      sections: [
        ...old.sections,
        {
          kind,
          title: kind === "HERO" ? tenant.heroTitle : "",
          body: kind === "HERO" ? tenant.heroSubtitle : "",
          imageUrl: kind === "HERO" ? tenant.heroImage : "",
          ctaLabel: "",
          ctaHref: "",
          collection: "",
          active: true,
          startsAt: null,
          endsAt: null,
        },
      ],
    }));
    setSelected(page.sections.length);
  }
  function move(step: number) {
    setPage((old) => {
      const sections = [...old.sections],
        target = selected + step;
      if (target < 0 || target >= sections.length) return old;
      [sections[selected], sections[target]] = [
        sections[target]!,
        sections[selected]!,
      ];
      return { ...old, sections };
    });
    setSelected(selected + step);
  }
  async function save(action: "save" | "publish" | "preview") {
    setPending(true);
    setError(null);
    setMessage("");
    try {
      await mutate("/cms", page, "PUT");
      if (action === "publish") await mutate("/cms/publish", {});
      if (action === "preview") {
        const result = await mutate<{ url: string }>("/cms/preview", {});
        setPreviewUrl(result.url);
      }
      await client.invalidateQueries({ queryKey: ["cms"] });
      setMessage(
        action === "publish"
          ? "Your storefront has been published."
          : action === "preview"
            ? "Private preview is ready for ten minutes."
            : "Draft saved. Your live storefront keeps the published version.",
      );
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  const section = page.sections[selected];
  return (
    <>
      <PageTitle
        eyebrow="STOREFRONT STUDIO"
        title="Your world. In your own words."
        subtitle="Arrange editorial sections, schedule campaigns, preview privately, and publish when ready."
        action={
          manager && (
            <div className="action-row">
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => save("preview")}
              >
                Preview
              </Button>
              <Button disabled={pending} onClick={() => save("publish")}>
                Publish storefront
              </Button>
            </div>
          )
        }
      />
      <Notice error={error || query.error} />
      {message && (
        <p role="status">
          <Badge tone="green">Saved</Badge> {message}
        </p>
      )}
      {previewUrl && (
        <p>
          <a href={previewUrl} target="_blank" rel="noreferrer">
            Open private preview ↗
          </a>
        </p>
      )}
      {query.isPending ? (
        <Loading />
      ) : (
        <div className="studio-layout">
          <aside className="panel studio-sections">
            <h2>Your composition</h2>
            <p>
              {query.data?.publishedAt
                ? `Published ${new Date(query.data.publishedAt).toLocaleDateString()}`
                : "Draft · not yet published"}
            </p>
            {page.sections.map((s, i) => (
              <button
                className={`studio-section ${selected === i ? "active" : ""}`}
                key={i}
                onClick={() => setSelected(i)}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{s.kind.replaceAll("_", " ")}</strong>
                  <small>{s.title || "Untitled section"}</small>
                </div>
                <Badge tone={s.active ? "green" : "neutral"}>
                  {s.active ? "On" : "Off"}
                </Badge>
              </button>
            ))}
            {manager && (
              <label>
                Add a section
                <select
                  disabled={page.sections.length >= 20 || pending}
                  value=""
                  onChange={(e) => add(e.target.value as Section["kind"])}
                >
                  <option value="">Choose a section</option>
                  {kinds.map((k) => (
                    <option key={k} value={k}>
                      {k.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <small>
              The searchable catalog remains available below your campaign
              sections.
            </small>
          </aside>
          <section className="panel studio-editor">
            <fieldset disabled={!manager || pending}>
              <div className="form-grid">
                <label>
                  Page title
                  <input
                    value={page.title}
                    required
                    onChange={(e) =>
                      setPage((old) => ({ ...old, title: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Search engine title
                  <input
                    value={page.seoTitle}
                    maxLength={150}
                    onChange={(e) =>
                      setPage((old) => ({ ...old, seoTitle: e.target.value }))
                    }
                  />
                </label>
                <label className="span-2">
                  Search engine description
                  <textarea
                    value={page.seoDescription}
                    maxLength={500}
                    onChange={(e) =>
                      setPage((old) => ({
                        ...old,
                        seoDescription: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <h2>Brand and layout</h2>
              <div className="form-grid">
                {(["logoUrl", "faviconUrl", "footerText"] as const).map(
                  (key) => (
                    <label key={key}>
                      {key === "logoUrl"
                        ? "Logo URL"
                        : key === "faviconUrl"
                          ? "Favicon URL"
                          : "Footer text"}
                      <input
                        value={page.design[key]}
                        onChange={(e) =>
                          setPage((old) => ({
                            ...old,
                            design: { ...old.design, [key]: e.target.value },
                          }))
                        }
                      />
                    </label>
                  ),
                )}
                <label>
                  Heading style
                  <select
                    value={page.design.headingFont}
                    onChange={(e) =>
                      setPage((old) => ({
                        ...old,
                        design: {
                          ...old.design,
                          headingFont: e.target
                            .value as Page["design"]["headingFont"],
                        },
                      }))
                    }
                  >
                    <option value="SERIF">Editorial serif</option>
                    <option value="SANS">Modern sans serif</option>
                  </select>
                </label>
                <label>
                  Catalog spacing
                  <select
                    value={page.design.spacing}
                    onChange={(e) =>
                      setPage((old) => ({
                        ...old,
                        design: {
                          ...old.design,
                          spacing: e.target.value as Page["design"]["spacing"],
                        },
                      }))
                    }
                  >
                    <option value="AIRY">Airy</option>
                    <option value="COMPACT">Compact</option>
                  </select>
                </label>
              </div>
              {(["navigation", "socialLinks"] as const).map((key) => (
                <div key={key}>
                  <h3>
                    {key === "navigation"
                      ? "Navigation links"
                      : "Social profiles"}
                  </h3>
                  {page.design[key].map((link, index) => (
                    <div className="form-grid" key={index}>
                      <label>
                        Link label
                        <input
                          value={link.label}
                          maxLength={40}
                          onChange={(e) =>
                            setPage((old) => ({
                              ...old,
                              design: {
                                ...old.design,
                                [key]: old.design[key].map((item, i) =>
                                  i === index
                                    ? { ...item, label: e.target.value }
                                    : item,
                                ),
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Link destination
                        <input
                          value={link.href}
                          onChange={(e) =>
                            setPage((old) => ({
                              ...old,
                              design: {
                                ...old.design,
                                [key]: old.design[key].map((item, i) =>
                                  i === index
                                    ? { ...item, href: e.target.value }
                                    : item,
                                ),
                              },
                            }))
                          }
                        />
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setPage((old) => ({
                            ...old,
                            design: {
                              ...old.design,
                              [key]: old.design[key].filter(
                                (_, i) => i !== index,
                              ),
                            },
                          }))
                        }
                      >
                        Remove link
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={page.design[key].length >= 6}
                    onClick={() =>
                      setPage((old) => ({
                        ...old,
                        design: {
                          ...old.design,
                          [key]: [...old.design[key], { label: "", href: "" }],
                        },
                      }))
                    }
                  >
                    Add{" "}
                    {key === "navigation"
                      ? "navigation link"
                      : "social profile"}
                  </Button>
                </div>
              ))}
              {section ? (
                <>
                  <div className="form-section-title">
                    <h2>{section.kind.replaceAll("_", " ")}</h2>
                    <div className="action-row">
                      <Button
                        type="button"
                        variant="secondary"
                        aria-label="Move section earlier"
                        disabled={selected === 0}
                        onClick={() => move(-1)}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        aria-label="Move section later"
                        disabled={selected === page.sections.length - 1}
                        onClick={() => move(1)}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setPage((old) => ({
                            ...old,
                            sections: old.sections.filter(
                              (_, i) => selected !== i,
                            ),
                          }));
                          setSelected(Math.max(0, selected - 1));
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div className="form-grid">
                    <label className="span-2">
                      Heading
                      <input
                        maxLength={150}
                        value={section.title}
                        onChange={(e) => update("title", e.target.value)}
                      />
                    </label>
                    <label className="span-2">
                      Editorial copy
                      <textarea
                        rows={4}
                        maxLength={3000}
                        value={section.body}
                        onChange={(e) => update("body", e.target.value)}
                      />
                    </label>
                    {["HERO", "EDITORIAL", "VIDEO"].includes(section.kind) && (
                      <label className="span-2">
                        {section.kind === "VIDEO" ? "Video" : "Image"} URL
                        <input
                          value={section.imageUrl}
                          onChange={(e) => update("imageUrl", e.target.value)}
                          placeholder="Licensed HTTPS asset URL"
                        />
                      </label>
                    )}
                    {section.kind === "FEATURED_COLLECTION" && (
                      <label className="span-2">
                        Collection name
                        <input
                          value={section.collection}
                          maxLength={80}
                          onChange={(e) => update("collection", e.target.value)}
                        />
                        <small>
                          Uses the collection stored on your products.
                        </small>
                      </label>
                    )}
                    <label>
                      Action label
                      <input
                        value={section.ctaLabel}
                        maxLength={80}
                        onChange={(e) => update("ctaLabel", e.target.value)}
                      />
                    </label>
                    <label>
                      Action destination
                      <input
                        value={section.ctaHref}
                        onChange={(e) => update("ctaHref", e.target.value)}
                        placeholder="#collection or https://…"
                      />
                    </label>
                    <label>
                      Schedule starts
                      <input
                        type="datetime-local"
                        value={
                          section.startsAt ? section.startsAt.slice(0, 16) : ""
                        }
                        onChange={(e) =>
                          update(
                            "startsAt",
                            e.target.value
                              ? new Date(`${e.target.value}Z`).toISOString()
                              : null,
                          )
                        }
                      />
                      <small>UTC time. Leave blank to show immediately.</small>
                    </label>
                    <label>
                      Schedule ends
                      <input
                        type="datetime-local"
                        value={
                          section.endsAt ? section.endsAt.slice(0, 16) : ""
                        }
                        onChange={(e) =>
                          update(
                            "endsAt",
                            e.target.value
                              ? new Date(`${e.target.value}Z`).toISOString()
                              : null,
                          )
                        }
                      />
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={section.active}
                        onChange={(e) => update("active", e.target.checked)}
                      />
                      Show this section
                    </label>
                  </div>
                </>
              ) : (
                <div className="studio-empty">
                  <h2>A little space for your next story.</h2>
                  <p>Choose an editorial section to begin.</p>
                </div>
              )}
              <Button disabled={pending} onClick={() => save("save")}>
                {pending ? "Saving…" : "Save draft"}
              </Button>
            </fieldset>
          </section>
        </div>
      )}
    </>
  );
}
