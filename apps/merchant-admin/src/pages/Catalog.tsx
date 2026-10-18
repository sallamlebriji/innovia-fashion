import { useWords } from "../words";
import { usePreferences } from "../state";
import { useCountWords } from "../count-words";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Download,
  Trash2,
  ArrowUpRight,
} from "lucide-react";
import { request, mutate } from "@innovia/api-client";
import { Button, Badge, EmptyState, Money } from "@innovia/ui";
import type { Product } from "@innovia/types";
import type { ProductInput } from "@innovia/validation";
import { useWorkspace } from "../App";
import { ProductEditor, CatalogImport } from "./CatalogTools";
import {
  downloadCsv,
  Loading,
  Modal,
  Notice,
  PageTitle,
  Pagination,
  Picture,
} from "../components";
export function Catalog() {
  const t = useWords();
  const countWords = useCountWords();
  const locale = usePreferences((state) => state.locale);
  const { session } = useWorkspace(),
    client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? ""),
    [page, setPage] = useState(1),
    [category, setCategory] = useState(""),
    [status, setStatus] = useState(""),
    [view, setView] = useState<"grid" | "list">("list"),
    [selected, setSelected] = useState<Product | null>(null),
    [editing, setEditing] = useState<Product | null>(null),
    [importing, setImporting] = useState(false),
    [creating, setCreating] = useState(params.get("new") === "1");
  const canEdit = session.user.role !== "CASHIER";
  useEffect(() => {
    setQ(params.get("q") ?? "");
    if (params.get("new") === "1") setCreating(true);
  }, [params]);
  const query = useQuery({
    queryKey: ["products", q, page, category, status],
    queryFn: () =>
      request<{ items: Product[]; total: number }>(
        `/products?${new URLSearchParams({ q, page: String(page), ...(category ? { category } : {}), ...(status ? { status } : {}) })}`,
      ),
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => request<string[]>("/categories"),
  });
  const items = query.data?.items ?? [];
  async function changeStatus(p: Product) {
    await mutate(
      `/products/${p.id}`,
      { status: p.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" },
      "PATCH",
    );
    await client.invalidateQueries({ queryKey: ["products"] });
    setSelected(null);
  }
  return (
    <>
      <PageTitle
        title={t("A collection of possibilities.")}
        subtitle={t("Every piece, every variant, every detail. In one place.")}
        eyebrow={t("YOUR CATALOG")}
        action={
          canEdit && (
            <div className="action-row">
              <Button variant="secondary" onClick={() => setImporting(true)}>
                {t("Import CSV")}
              </Button>
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} />
                {t("Add product")}
              </Button>
            </div>
          )
        }
      />
      <section className="panel catalog-panel">
        <div className="filterbar">
          <div className="filter-search">
            <Search size={16} />
            <input
              aria-label={t("Search catalog")}
              placeholder={t("Search products or scan a SKU…")}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label={t("Product category")}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("All categories")}</option>
            {categories.data?.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label={t("Publication status")}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("All statuses")}</option>
            <option value="ACTIVE">{t("Active")}</option>
            <option value="DRAFT">{t("Draft")}</option>
            <option value="ARCHIVED">{t("Archived")}</option>
          </select>
          <div className="view-toggle">
            <button
              className={view === "list" ? "selected" : ""}
              onClick={() => setView("list")}
              aria-label={t("List view")}
            >
              <List size={17} />
            </button>
            <button
              className={view === "grid" ? "selected" : ""}
              onClick={() => setView("grid")}
              aria-label={t("Grid view")}
            >
              <LayoutGrid size={17} />
            </button>
          </div>
          <button
            className="icon-button"
            aria-label={t("Export visible products")}
            onClick={() =>
              downloadCsv("catalog-page.csv", [
                ["Name", "SKU", "Size", "Color", "Price", "Available"].map(t),
                ...items.flatMap((p) =>
                  p.variants.map((v) => [
                    p.name,
                    v.sku,
                    v.size,
                    v.color,
                    v.price,
                    v.inventory.reduce((s, i) => s + i.onHand - i.reserved, 0),
                  ]),
                ),
              ])
            }
          >
            <Download size={17} />
          </button>
        </div>
        <Notice error={query.error} />
        {query.isPending ? (
          <Loading />
        ) : items.length === 0 ? (
          <EmptyState
            title={t("Space for something extraordinary.")}
            action={
              canEdit && (
                <Button onClick={() => setCreating(true)}>
                  <Plus size={15} />
                  {t("Create a product")}
                </Button>
              )
            }
          >
            {t("Create your first product, or try a different search.")}
          </EmptyState>
        ) : view === "grid" ? (
          <div className="product-grid">
            {items.map((p) => (
              <button
                className="product-card"
                key={p.id}
                onClick={() => setSelected(p)}
              >
                <div className="product-image">
                  <Picture src={p.imageUrl} alt={p.name} />
                  <Badge tone={p.status === "ACTIVE" ? "green" : "neutral"}>
                    {t(p.status.toLowerCase())}
                  </Badge>
                  <span className="product-open">
                    <ArrowUpRight size={18} />
                  </span>
                </div>
                <span className="eyebrow">{p.category}</span>
                <h3>{p.name}</h3>
                <div>
                  <span>{countWords(p.variants.length, "variant")}</span>
                  <strong>
                    <Money
                      value={p.variants[0]?.price ?? 0}
                      currency={session.tenant!.currency}
                      locale={`${locale}-MA`}
                    />
                  </strong>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Product")}</th>
                  <th>{t("Category")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Inventory")}</th>
                  <th>{t("Variants")}</th>
                  <th className="align-end">{t("Price")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const count = p.variants.reduce(
                    (s, v) =>
                      s +
                      v.inventory.reduce(
                        (n, i) => n + i.onHand - i.reserved,
                        0,
                      ),
                    0,
                  );
                  return (
                    <tr key={p.id}>
                      <td>
                        <button
                          className="product-cell"
                          onClick={() => setSelected(p)}
                        >
                          <Picture src={p.imageUrl} alt={p.name} />
                          <span>
                            <strong>{p.name}</strong>
                            <small>
                              {p.brand} · {p.collection}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>{p.category}</td>
                      <td>
                        <Badge
                          tone={p.status === "ACTIVE" ? "green" : "neutral"}
                        >
                          {t(p.status.toLowerCase())}
                        </Badge>
                      </td>
                      <td>
                        <span className={count < 10 ? "stock-low" : ""}>
                          {count} {t("in stock")}
                        </span>
                      </td>
                      <td>{countWords(p.variants.length, "variant")}</td>
                      <td className="align-end">
                        <Money
                          value={p.variants[0]?.price ?? 0}
                          currency={session.tenant!.currency}
                          locale={`${locale}-MA`}
                        />
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`${t("Open")} ${p.name}`}
                          onClick={() => setSelected(p)}
                        >
                          <ArrowUpRight size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </section>
      {creating && (
        <ProductForm
          onClose={() => {
            setCreating(false);
            params.delete("new");
            setParams(params);
          }}
        />
      )}
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)} wide>
          <div className="product-detail">
            <Picture src={selected.imageUrl} alt={selected.name} />
            <div>
              <span className="eyebrow">
                {selected.category} / {selected.brand}
              </span>
              <p>{selected.description}</p>
              <Badge tone={selected.status === "ACTIVE" ? "green" : "neutral"}>
                {t(selected.status)}
              </Badge>
              <div className="variant-table table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("SKU")}</th>
                      <th>{t("Variant")}</th>
                      <th>{t("Price")}</th>
                      <th>{t("Available")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.variants.map((v) => (
                      <tr key={v.id}>
                        <td>{v.sku}</td>
                        <td>
                          {v.color} / {v.size}
                        </td>
                        <td>
                          <Money
                            value={v.price}
                            currency={session.tenant!.currency}
                            locale={`${locale}-MA`}
                          />
                        </td>
                        <td>
                          {v.inventory.reduce(
                            (s, i) => s + i.onHand - i.reserved,
                            0,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canEdit && (
                <div className="action-row">
                  <Button
                    onClick={() => {
                      setEditing(selected);
                      setSelected(null);
                    }}
                  >
                    {t("Edit product")}
                  </Button>
                  <StatusButton
                    product={selected}
                    action={() => changeStatus(selected)}
                  />
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
      {editing && (
        <ProductEditor product={editing} onClose={() => setEditing(null)} />
      )}
      {importing && <CatalogImport onClose={() => setImporting(false)} />}
    </>
  );
}
function StatusButton({
  product,
  action,
}: {
  product: Product;
  action: () => Promise<void>;
}) {
  const t = useWords();
  const [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false);
  return (
    <>
      <Notice error={error} />
      <Button
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await action();
          } catch (e) {
            setError(e);
          } finally {
            setPending(false);
          }
        }}
      >
        {t(product.status === "ACTIVE" ? "Archive product" : "Publish product")}
      </Button>
      <p className="field-help">
        {t("Archived and draft products are hidden from the storefront.")}
      </p>
    </>
  );
}
export function ProductForm({ onClose }: { onClose: () => void }) {
  const t = useWords();
  const { stores, session } = useWorkspace(),
    client = useQueryClient();
  const [error, setError] = useState<unknown>();
  const form = useForm<ProductInput>({
    defaultValues: {
      name: "",
      description: "",
      category: "",
      brand: session.tenant!.name,
      collection: "",
      imageUrl: "",
      status: "ACTIVE",
      storeId: stores[0]?.id ?? "",
      variants: [
        {
          sku: "",
          size: "M",
          color: "Black",
          price: "0.00",
          cost: "0.00",
          quantity: 0,
          reorderPoint: 5,
        },
      ],
    },
  });
  const variants = useFieldArray({ control: form.control, name: "variants" });
  useEffect(() => {
    if (!form.getValues("storeId") && stores[0])
      form.setValue("storeId", stores[0].id);
  }, [stores, form]);
  async function submit(values: ProductInput) {
    setError(null);
    try {
      await mutate("/products", values);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["analytics"] }),
        client.invalidateQueries({ queryKey: ["categories"] }),
      ]);
      onClose();
    } catch (e) {
      setError(e);
    }
  }
  return (
    <Modal title={t("A new piece. A new possibility.")} onClose={onClose} wide>
      <form className="product-form" onSubmit={form.handleSubmit(submit)}>
        <div className="form-grid">
          <label className="span-2">
            {t("Product name")}
            <input required minLength={2} {...form.register("name")} />
          </label>
          <label>
            {t("Category")}
            <input
              required
              placeholder={t("e.g. Tailoring")}
              {...form.register("category")}
            />
          </label>
          <label>
            {t("Brand")}
            <input {...form.register("brand")} />
          </label>
          <label>
            {t("Collection")}
            <input {...form.register("collection")} />
          </label>
          <label>
            {t("Publish as")}
            <select {...form.register("status")}>
              <option value="ACTIVE">{t("Active")}</option>
              <option value="DRAFT">{t("Draft")}</option>
            </select>
          </label>
          <label className="span-2">
            {t("Image URL")}
            <input
              placeholder="https://…"
              {...form.register("imageUrl")}
              dir="ltr"
            />
            <small>
              {t("Use photography you own or have permission to use.")}
            </small>
          </label>
          <label className="span-2">
            {t("Description")}
            <textarea rows={3} {...form.register("description")} />
          </label>
          <label className="span-2">
            {t("Initial stock location")}
            <select required {...form.register("storeId")}>
              {stores.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-section-title">
          <div>
            <h3>{t("Variants & inventory")}</h3>
            <p>{t("Each variant has its own SKU and stock quantity.")}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              variants.append({
                sku: "",
                size: "",
                color: "",
                price: "0.00",
                cost: "0.00",
                quantity: 0,
                reorderPoint: 5,
              })
            }
          >
            <Plus size={15} />
            {t("Add variant")}
          </Button>
        </div>
        {variants.fields.map((v, i) => (
          <div className="variant-form" key={v.id}>
            <label>
              {t("SKU")}
              <input
                required
                {...form.register(`variants.${i}.sku`)}
                dir="ltr"
              />
            </label>
            <label>
              {t("Size")}
              <input required {...form.register(`variants.${i}.size`)} />
            </label>
            <label>
              {t("Color")}
              <input required {...form.register(`variants.${i}.color`)} />
            </label>
            <label>
              {t("Price")} ({session.tenant!.currency})
              <input
                required
                inputMode="decimal"
                {...form.register(`variants.${i}.price`)}
              />
            </label>
            <label>
              {t("Cost")}
              <input
                required
                inputMode="decimal"
                {...form.register(`variants.${i}.cost`)}
              />
            </label>
            <label>
              {t("Stock")}
              <input
                type="number"
                min="0"
                required
                {...form.register(`variants.${i}.quantity`, {
                  valueAsNumber: true,
                })}
              />
            </label>
            <button
              className="icon-button"
              type="button"
              aria-label={t("Remove variant")}
              disabled={variants.fields.length === 1}
              onClick={() => variants.remove(i)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <Notice error={error} />
        <div className="form-footer">
          <p>{t("Saved securely to your boutique workspace.")}</p>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button disabled={form.formState.isSubmitting} type="submit">
            {t(form.formState.isSubmitting ? "Saving…" : "Create product")}
            <Plus size={15} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
