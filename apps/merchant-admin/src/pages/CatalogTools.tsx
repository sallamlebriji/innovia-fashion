import { useWords } from "../words";
import { useCountWords } from "../count-words";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { mutate, request } from "@innovia/api-client";
import type { Product } from "@innovia/types";
import { Button, Badge } from "@innovia/ui";
import { useWorkspace } from "../App";
import { Modal, Notice, Loading, downloadCsv } from "../components";

export function ProductEditor({
  product: initial,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const t = useWords();
  const { stores, session } = useWorkspace(),
    client = useQueryClient();
  const [tab, setTab] = useState("details"),
    [error, setError] = useState<unknown>(),
    [saved, setSaved] = useState(false),
    [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ["products", "detail", initial.id],
    queryFn: () => request<Product>(`/products/${initial.id}`),
    initialData: initial,
    staleTime: 0,
  });
  const product = query.data;
  async function save(path: string, payload: unknown, method = "PATCH") {
    setError(null);
    setSaved(false);
    setPending(true);
    try {
      await mutate(path, payload, method);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["categories"] }),
        client.invalidateQueries({ queryKey: ["analytics"] }),
      ]);
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  function values(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget));
  }
  return (
    <Modal title={`${t("Edit")} ${product.name}`} onClose={onClose} wide>
      <div className="tabs editor-tabs">
        {["details", "variants", "media", "size chart", "duplicate"].map(
          (tabKey) => (
            <button
              key={tabKey}
              className={tab === tabKey ? "active" : ""}
              onClick={() => {
                setTab(tabKey);
                setSaved(false);
                setError(null);
              }}
            >
              {t(tabKey[0]!.toUpperCase() + tabKey.slice(1))}
            </button>
          ),
        )}
      </div>
      <div className="modal-body">
        <Notice error={error || query.error} />
        {saved && (
          <p role="status">
            <Badge tone="green">{t("Saved")}</Badge>{" "}
            {t("Your catalog is up to date.")}
          </p>
        )}
        {tab === "duplicate" && (
          <form
            onSubmit={async (e) => {
              const fields = values(e);
              setPending(true);
              setError(null);
              try {
                await mutate("/catalog/duplicate", {
                  ...fields,
                  sourceId: product.id,
                });
                await client.invalidateQueries({ queryKey: ["products"] });
                onClose();
              } catch (err) {
                setError(err);
              } finally {
                setPending(false);
              }
            }}
          >
            <fieldset disabled={pending}>
              <p>
                {t(
                  "Create a draft with the same catalog details and gallery. New SKUs are generated; inventory starts at zero.",
                )}
              </p>
              <label>
                {t("New product name")}
                <input
                  name="name"
                  defaultValue={`${product.name.slice(0, 140)} ${t("copy")}`}
                  required
                  minLength={2}
                  maxLength={150}
                />
              </label>
              <label>
                {t("Opening location")}
                <select name="storeId" required>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit">{t("Create draft copy")}</Button>
            </fieldset>
          </form>
        )}
        {tab === "variants" && (
          <form
            onSubmit={(e) => {
              const fields = values(e);
              void save(
                "/catalog/prices",
                {
                  items: product.variants.map((variant) => ({
                    variantId: variant.id,
                    price: fields[variant.id],
                  })),
                },
                "POST",
              );
            }}
          >
            <fieldset disabled={pending}>
              <h3>{t("Update all selling prices")}</h3>
              <p>
                {t(
                  "Save the entire set together. Completed sales retain their original prices and costs.",
                )}
              </p>
              <div className="form-grid">
                {product.variants.map((variant) => (
                  <label key={variant.id}>
                    {variant.sku} · {variant.size} / {variant.color}
                    <input
                      name={variant.id}
                      defaultValue={variant.price}
                      type="number"
                      min="0"
                      max="99999999.99"
                      step="0.01"
                      required
                    />
                  </label>
                ))}
              </div>
              <Button type="submit">{t("Save all prices")}</Button>
            </fieldset>
          </form>
        )}
        {tab === "details" && (
          <form
            key={product.id}
            onSubmit={(e) => {
              const fields = values(e);
              void save(`/products/${product.id}`, fields);
            }}
          >
            <fieldset disabled={pending}>
              <div className="form-grid">
                <label className="span-2">
                  {t("Product name")}
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={150}
                    defaultValue={product.name}
                  />
                </label>
                {(
                  [
                    "category",
                    "brand",
                    "collection",
                    "season",
                    "audience",
                    "material",
                    "fit",
                  ] as const
                ).map((k) => (
                  <label key={k}>
                    {t(k[0]!.toUpperCase() + k.slice(1))}
                    <input
                      name={k}
                      required={k === "category"}
                      defaultValue={product[k] ?? ""}
                      maxLength={k === "material" ? 200 : 80}
                    />
                  </label>
                ))}
                <label>
                  {t("Status")}
                  <select
                    name="status"
                    aria-label={t("Status")}
                    defaultValue={product.status}
                  >
                    <option value="ACTIVE">{t("ACTIVE")}</option>
                    <option value="DRAFT">{t("DRAFT")}</option>
                    <option value="ARCHIVED">{t("ARCHIVED")}</option>
                  </select>
                </label>
                <label className="span-2">
                  {t("Cover image URL")}
                  <input
                    name="imageUrl"
                    dir="ltr"
                    defaultValue={product.imageUrl}
                  />
                </label>
                <label className="span-2">
                  {t("Description")}
                  <textarea
                    name="description"
                    rows={4}
                    maxLength={5000}
                    defaultValue={product.description}
                  />
                </label>
                <label className="span-2">
                  {t("Care instructions")}
                  <textarea
                    name="care"
                    maxLength={2000}
                    defaultValue={product.care ?? ""}
                  />
                </label>
              </div>
              <Button type="submit">
                {t(pending ? "Saving…" : "Save product details")}
              </Button>
            </fieldset>
          </form>
        )}
        {tab === "variants" && (
          <>
            <p>
              {t(
                "Each SKU keeps its own price, cost, size and barcode. Stock changes belong in Inventory.",
              )}
            </p>
            {product.variants.map((v) => (
              <form
                className="variant-editor"
                key={v.id}
                onSubmit={(e) => {
                  const data = values(e);
                  void save(`/variants/${v.id}`, data);
                }}
              >
                <fieldset disabled={pending}>
                  <h3>{v.sku}</h3>
                  <div className="form-grid">
                    {(
                      [
                        "sku",
                        "size",
                        "color",
                        "barcode",
                        "price",
                        "cost",
                      ] as const
                    ).map((k) => (
                      <label key={k}>
                        {t(k[0]!.toUpperCase() + k.slice(1))}
                        {k === "price" || k === "cost"
                          ? ` (${session.tenant!.currency})`
                          : ""}
                        <input
                          name={k}
                          dir={
                            k === "sku" || k === "barcode" ? "ltr" : undefined
                          }
                          defaultValue={v[k] ?? ""}
                          required={k !== "barcode"}
                        />
                      </label>
                    ))}
                  </div>
                  <Button type="submit" variant="secondary">
                    {t("Save this variant")}
                  </Button>
                </fieldset>
              </form>
            ))}
            <form
              className="variant-editor"
              onSubmit={(e) => {
                const data = values(e);
                void save(
                  `/products/${product.id}/variants`,
                  {
                    ...data,
                    quantity: Number(data.quantity),
                    reorderPoint: Number(data.reorderPoint),
                  },
                  "POST",
                );
              }}
            >
              <fieldset disabled={pending}>
                <h3>{t("Add another variant")}</h3>
                <div className="form-grid">
                  {["sku", "size", "color", "barcode", "price", "cost"].map(
                    (k) => (
                      <label key={k}>
                        {t(k[0]!.toUpperCase() + k.slice(1))}
                        <input
                          name={k}
                          dir={
                            k === "sku" || k === "barcode" ? "ltr" : undefined
                          }
                          required={k !== "barcode"}
                          defaultValue={
                            k === "price" || k === "cost" ? "0.00" : ""
                          }
                        />
                      </label>
                    ),
                  )}
                  <label>
                    {t("Opening units")}
                    <input
                      name="quantity"
                      type="number"
                      min={0}
                      max={100000}
                      defaultValue={0}
                      required
                    />
                  </label>
                  <label>
                    {t("Reorder threshold")}
                    <input
                      name="reorderPoint"
                      type="number"
                      min={0}
                      max={10000}
                      defaultValue={5}
                      required
                    />
                  </label>
                  <label className="span-2">
                    {t("Opening location")}
                    <select name="storeId" required>
                      {stores.map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <Button type="submit">{t("Create variant")}</Button>
              </fieldset>
            </form>
          </>
        )}
        {tab === "media" && (
          <MediaEditor
            product={product}
            pending={pending}
            save={(items) =>
              save(`/products/${product.id}/media`, { items }, "PUT")
            }
          />
        )}
        {tab === "size chart" && (
          <SizeChartEditor
            product={product}
            pending={pending}
            save={(sizeChart) => save(`/products/${product.id}`, { sizeChart })}
          />
        )}
        {tab === "details" && (
          <form
            className="variant-editor"
            onSubmit={(e) => {
              const data = values(e);
              void save(`/products/${product.id}`, {
                tryOnEnabled: data.tryOnEnabled === "on",
                tryOnImageUrl: data.tryOnImageUrl,
                arLensId: data.arLensId,
                arGroupId: data.arGroupId,
              });
            }}
          >
            <fieldset disabled={pending}>
              <h3>{t("Virtual fitting garment")}</h3>
              <p>
                {t(
                  "Use a licensed, clear garment image suitable for the provider. The boutique’s virtual fitting setting and plan allowance must also be enabled.",
                )}
              </p>
              <label>
                {t("Garment image URL")}
                <input
                  name="tryOnImageUrl"
                  dir="ltr"
                  defaultValue={product.tryOnImageUrl ?? ""}
                  placeholder={t("Media library URL or https://…")}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  name="tryOnEnabled"
                  defaultChecked={product.tryOnEnabled}
                />{" "}
                {t("Offer virtual fitting for this product")}
              </label>
              <Button type="submit">{t("Save fitting settings")}</Button>
              <h3>{t("Licensed AR lens")}</h3>
              <label>
                {t("Snap lens ID")}
                <input
                  name="arLensId"
                  dir="ltr"
                  defaultValue={product.arLensId ?? ""}
                />
              </label>
              <label>
                {t("Lens group ID")}
                <input
                  name="arGroupId"
                  dir="ltr"
                  defaultValue={product.arGroupId ?? ""}
                />
              </label>
              <p>
                {t(
                  "Use a licensed lens of the actual product. The operator must approve Camera Kit before this becomes available.",
                )}
              </p>
            </fieldset>
          </form>
        )}
      </div>
    </Modal>
  );
}

function MediaEditor({
  product,
  pending,
  save,
}: {
  product: Product;
  pending: boolean;
  save: (
    items: { url: string; alt: string; kind: "IMAGE" | "VIDEO" }[],
  ) => Promise<void>;
}) {
  const t = useWords();
  const [items, setItems] = useState(
    product.media?.map(({ url, alt, kind }) => ({ url, alt, kind })) ?? [],
  );
  function move(index: number, step: number) {
    setItems((old) => {
      const next = [...old],
        target = index + step;
      if (target < 0 || target >= next.length) return old;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(items);
      }}
    >
      <fieldset disabled={pending}>
        <p>
          {t(
            "Add licensed images or videos and arrange the order your customers see.",
          )}
        </p>
        {items.map((item, i) => (
          <div className="variant-editor" key={i}>
            <div className="form-grid">
              <label className="span-2">
                {t("Asset URL")}
                <input
                  dir="ltr"
                  required
                  value={item.url}
                  onChange={(e) =>
                    setItems((old) =>
                      old.map((v, j) =>
                        j === i ? { ...v, url: e.target.value } : v,
                      ),
                    )
                  }
                  placeholder="https://…"
                />
              </label>
              <label>
                {t("Accessible description")}
                <input
                  value={item.alt}
                  maxLength={200}
                  onChange={(e) =>
                    setItems((old) =>
                      old.map((v, j) =>
                        j === i ? { ...v, alt: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <label>
                {t("Asset type")}
                <select
                  value={item.kind}
                  onChange={(e) =>
                    setItems((old) =>
                      old.map((v, j) =>
                        j === i
                          ? { ...v, kind: e.target.value as "IMAGE" | "VIDEO" }
                          : v,
                      ),
                    )
                  }
                >
                  <option value="IMAGE">{t("IMAGE")}</option>
                  <option value="VIDEO">{t("VIDEO")}</option>
                </select>
              </label>
            </div>
            <div className="action-row">
              <Button
                type="button"
                variant="secondary"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                {t("Move earlier")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={i === items.length - 1}
                onClick={() => move(i, 1)}
              >
                {t("Move later")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setItems((old) => old.filter((_, j) => i !== j))}
              >
                {t("Remove asset")}
              </Button>
            </div>
          </div>
        ))}
        <div className="action-row">
          <Button
            type="button"
            variant="secondary"
            disabled={items.length >= 20}
            onClick={() =>
              setItems((old) => [...old, { url: "", alt: "", kind: "IMAGE" }])
            }
          >
            {t("Add gallery asset")}
          </Button>
          <Button type="submit">{t("Save gallery order")}</Button>
        </div>
      </fieldset>
    </form>
  );
}
function SizeChartEditor({
  product,
  pending,
  save,
}: {
  product: Product;
  pending: boolean;
  save: (
    items: {
      size: string;
      chest?: number;
      waist?: number;
      length?: number;
      footLength?: number;
      equivalentSizes?: string;
    }[],
  ) => Promise<void>;
}) {
  const t = useWords();
  const [items, setItems] = useState(
    (product.sizeChart ?? []).map((item) => ({
      size: item.size,
      chest: String(item.chest ?? ""),
      waist: String(item.waist ?? ""),
      length: String(item.length ?? ""),
      footLength: String(item.footLength ?? ""),
      equivalentSizes: item.equivalentSizes ?? "",
    })),
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          items.map((item) => ({
            size: item.size,
            ...(item.chest ? { chest: Number(item.chest) } : {}),
            ...(item.waist ? { waist: Number(item.waist) } : {}),
            ...(item.length ? { length: Number(item.length) } : {}),
            ...(item.footLength ? { footLength: Number(item.footLength) } : {}),
            ...(item.equivalentSizes
              ? { equivalentSizes: item.equivalentSizes }
              : {}),
          })),
        );
      }}
    >
      <fieldset disabled={pending}>
        <p>
          {t(
            "Enter garment measurements or brand-provided foot lengths in centimetres. Shoe equivalents must come from the brand’s chart for this product.",
          )}
        </p>
        {items.map((item, i) => (
          <div className="variant-editor" key={i}>
            <div className="form-grid">
              {(
                [
                  "size",
                  "chest",
                  "waist",
                  "length",
                  "footLength",
                  "equivalentSizes",
                ] as const
              ).map((k) => (
                <label key={k}>
                  {t(
                    k === "footLength"
                      ? "Foot length"
                      : k === "equivalentSizes"
                        ? "Equivalent sizes"
                        : k[0]!.toUpperCase() + k.slice(1),
                  )}
                  {k !== "size" && k !== "equivalentSizes" && " (cm)"}
                  <input
                    required={k === "size"}
                    type={
                      k === "size" || k === "equivalentSizes"
                        ? "text"
                        : "number"
                    }
                    min={
                      k === "size" || k === "equivalentSizes" ? undefined : 0.1
                    }
                    max={
                      k === "size" || k === "equivalentSizes"
                        ? undefined
                        : k === "footLength"
                          ? 60
                          : 300
                    }
                    step={
                      k === "size" || k === "equivalentSizes" ? undefined : 0.1
                    }
                    value={item[k]}
                    onChange={(e) =>
                      setItems((old) =>
                        old.map((v, j) =>
                          i === j ? { ...v, [k]: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setItems((old) => old.filter((_, j) => i !== j))}
            >
              {t("Remove size")}
            </Button>
          </div>
        ))}
        <div className="action-row">
          <Button
            type="button"
            variant="secondary"
            disabled={items.length >= 50}
            onClick={() =>
              setItems((old) => [
                ...old,
                {
                  size: "",
                  chest: "",
                  waist: "",
                  length: "",
                  footLength: "",
                  equivalentSizes: "",
                },
              ])
            }
          >
            {t("Add size")}
          </Button>
          <Button type="submit">{t("Save size chart")}</Button>
        </div>
      </fieldset>
    </form>
  );
}
type ImportReport = {
  rows: number;
  products: number;
  variants: number;
  imported: boolean;
  errors: { row: number; message: string }[];
};
export function CatalogImport({ onClose }: { onClose: () => void }) {
  const t = useWords();
  const countWords = useCountWords();
  const { stores } = useWorkspace(),
    client = useQueryClient();
  const [csv, setCsv] = useState(""),
    [storeId, setStoreId] = useState(stores[0]?.id ?? ""),
    [report, setReport] = useState<ImportReport | null>(null),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false);
  async function run(preview: boolean) {
    setPending(true);
    setError(null);
    try {
      const result = await mutate<ImportReport>("/catalog/import", {
        csv,
        storeId,
        preview,
      });
      setReport(result);
      if (result.imported)
        await Promise.all(
          ["products", "categories", "analytics"].map((k) =>
            client.invalidateQueries({ queryKey: [k] }),
          ),
        );
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal title={t("Bring your collection together.")} onClose={onClose} wide>
      <div className="modal-body">
        <p>
          {t(
            "Import up to 100 SKU rows per file. Rows sharing a product name become variants of one product. Existing SKUs are rejected; the import is applied in one transaction.",
          )}
        </p>
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv("innovia-catalog-template.csv", [
              [
                "name",
                "category",
                "brand",
                "collection",
                "description",
                "imageUrl",
                "status",
                "sku",
                "size",
                "color",
                "barcode",
                "price",
                "cost",
                "quantity",
                "reorderPoint",
              ],
              [
                "Linen shirt",
                "Shirts",
                "Your brand",
                "Summer",
                "Linen shirt",
                "",
                "DRAFT",
                "LINEN-M",
                "M",
                "Ivory",
                "",
                "390.00",
                "150.00",
                10,
                3,
              ],
            ])
          }
        >
          {t("Download CSV template")}
        </Button>
        <label>
          {t("CSV file")}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={pending}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 100000) {
                setError(new Error("Choose a CSV file smaller than 100 KB."));
                return;
              }
              setCsv(await file.text());
              setReport(null);
              setError(null);
            }}
          />
        </label>
        <label>
          {t("Opening inventory location")}
          <select
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value);
              setReport(null);
            }}
            disabled={pending}
          >
            {stores.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <Notice error={error} />
        {pending && <Loading />}
        {report && (
          <section className="import-report">
            <h3>
              {t(report.imported ? "Import completed." : "Import preview")}
            </h3>
            <p>
              {countWords(report.rows, "row")} ·{" "}
              {countWords(report.products, "product")} ·{" "}
              {countWords(report.variants, "variant")}
            </p>
            {report.errors.length ? (
              <ul>
                {report.errors.map((err, i) => (
                  <li key={i}>
                    {err.row ? `${t("Row")} ${err.row}` : t("Import")}:{" "}
                    {t(err.message)}
                  </li>
                ))}
              </ul>
            ) : (
              <Badge tone="green">
                {t(
                  report.imported ? "Saved to your catalog" : "Ready to import",
                )}
              </Badge>
            )}
          </section>
        )}
        <div className="action-row">
          <Button
            variant="secondary"
            disabled={!csv || !storeId || pending || !!report?.imported}
            onClick={() => run(true)}
          >
            {t("Validate and preview")}
          </Button>
          {report && !report.imported && !report.errors.length && (
            <Button disabled={pending} onClick={() => run(false)}>
              {t("Import")} {countWords(report.products, "product")}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
