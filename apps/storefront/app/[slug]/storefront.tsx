"use client";
import { useEffect, useRef, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  ShoppingBag,
  Search,
  X,
  Plus,
  Minus,
  Check,
  MapPin,
  SlidersHorizontal,
} from "lucide-react";
import { request, mutate } from "@innovia/api-client";
import type { Store, Tenant } from "@innovia/types";
import type { z } from "zod";
import type { cmsPageSchema } from "@innovia/validation";
import { CMSSections } from "./cms-sections";
export interface PublicProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  collection: string;
  imageUrl: string;
  material?: string;
  fit?: string;
  care?: string;
  tryOnEnabled?: boolean;
  sizeChart?: {
    size: string;
    chest?: number;
    waist?: number;
    length?: number;
    footLength?: number;
    equivalentSizes?: string;
  }[];
  media?: {
    url: string;
    alt: string;
    kind: "IMAGE" | "VIDEO";
    position: number;
  }[];
  variants: {
    id: string;
    size: string;
    color: string;
    price: string;
    availability: { storeId: string; available: number }[];
  }[];
}
export interface Boutique {
  tenant: Tenant;
  stores: Store[];
  categories: string[];
  content?: z.infer<typeof cmsPageSchema> | null;
  preview?: boolean;
  settings?: {
    taxRate: string;
    returnPolicy: string;
    deliveryPolicy: string;
    contactEmail: string;
    contactPhone: string;
    reservationMinutes: number;
  };
  zones?: { id: string; name: string; cities: string[]; fee: string }[];
}
type CartLine = {
  product: PublicProduct;
  variant: PublicProduct["variants"][number];
  quantity: number;
};
const words = {
  en: {
    new: "New collection",
    shop: "The collection",
    about: "Our world",
    bag: "Your bag",
    hero: "Discover the edit",
    collection: "A considered collection.",
    intro: "Thoughtful pieces. Beautiful possibilities.",
    all: "All pieces",
    add: "Add to bag",
    size: "Select a size",
    checkout: "Reserve for pickup",
    empty: "A little space for something beautiful.",
    close: "Continue exploring",
    name: "Your name",
    email: "Email address",
    phone: "Moroccan phone number",
    pickup: "Pickup location",
    demo: "FICTIONAL DEMO BOUTIQUE · ILLUSTRATIVE PHOTOGRAPHY",
  },
  fr: {
    new: "Nouvelle collection",
    shop: "La collection",
    about: "Notre univers",
    bag: "Votre panier",
    hero: "Découvrir la collection",
    collection: "Une collection réfléchie.",
    intro: "Des pièces choisies. De belles possibilités.",
    all: "Toutes les pièces",
    add: "Ajouter au panier",
    size: "Choisir une taille",
    checkout: "Réserver en boutique",
    empty: "Une place pour quelque chose de beau.",
    close: "Continuer à découvrir",
    name: "Votre nom",
    email: "Adresse e-mail",
    phone: "Téléphone marocain",
    pickup: "Point de retrait",
    demo: "BOUTIQUE DÉMO FICTIVE · PHOTOGRAPHIES ILLUSTRATIVES",
  },
  ar: {
    new: "المجموعة الجديدة",
    shop: "المجموعة",
    about: "عالمنا",
    bag: "حقيبتك",
    hero: "اكتشف المجموعة",
    collection: "مجموعة مختارة بعناية.",
    intro: "قطع مدروسة. إمكانيات جميلة.",
    all: "كل القطع",
    add: "أضف إلى الحقيبة",
    size: "اختر المقاس",
    checkout: "احجز للاستلام",
    empty: "مساحة لشيء جميل.",
    close: "واصل الاستكشاف",
    name: "اسمك",
    email: "البريد الإلكتروني",
    phone: "رقم هاتف مغربي",
    pickup: "مكان الاستلام",
    demo: "متجر تجريبي خيالي · صور توضيحية",
  },
};
export function Storefront({
  boutique,
  initial,
}: {
  boutique: Boutique;
  initial: { items: PublicProduct[]; total: number };
}) {
  const { tenant } = boutique;
  const locale = tenant.locale as keyof typeof words;
  const t = words[locale] ?? words.en;
  const money = (value: string | number) =>
    new Intl.NumberFormat(
      locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-MA" : "en-MA",
      { style: "currency", currency: tenant.currency },
    ).format(Number(value));
  const [catalog, setCatalog] = useState(initial),
    [category, setCategory] = useState(""),
    [q, setQ] = useState(""),
    [sort, setSort] = useState("newest"),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<PublicProduct | null>(null),
    [variantId, setVariantId] = useState(""),
    [cart, setCart] = useState<CartLine[]>([]),
    [bag, setBag] = useState(false),
    [search, setSearch] = useState(false),
    [checkout, setCheckout] = useState(false),
    [pending, setPending] = useState(false),
    [confirmation, setConfirmation] = useState<{
      number: string;
      total: string;
      shippingTotal: string;
      taxTotal: string;
      trackingToken: string;
    } | null>(null),
    [key, setKey] = useState(crypto.randomUUID());
  const [filters, setFilters] = useState({
      brand: "",
      collection: "",
      size: "",
      color: "",
      minPrice: "",
      maxPrice: "",
    }),
    [filtersShown, setFiltersShown] = useState(false);
  const [facets, setFacets] = useState<Record<string, string[]>>({});
  useEffect(() => {
    request<Record<string, string[]>>(`/storefront/${tenant.slug}/facets`)
      .then(setFacets)
      .catch(() => {});
  }, [tenant.slug]);
  const [method, setMethod] = useState<"PICKUP" | "CASH_ON_DELIVERY">("PICKUP"),
    [zoneId, setZoneId] = useState(boutique.zones?.[0]?.id ?? "");
  const [savedAddresses, setSavedAddresses] = useState<
      {
        id: string;
        recipient: string;
        street: string;
        city: string;
        postalCode: string;
        phone: string;
      }[]
    >([]),
    [savedId, setSavedId] = useState("");
  const hydrated = useRef(false);
  useEffect(() => {
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    try {
      const saved = JSON.parse(
        localStorage.getItem(`innovia.bag.${tenant.id}`) ?? "[]",
      );
      if (Array.isArray(saved)) setCart(saved);
    } catch {
      /* Recover an invalid local cart. */
    }
    hydrated.current = true;
    if (new URLSearchParams(window.location.search).get("bag") === "1")
      setBag(true);
    request<typeof savedAddresses>(
      `/storefront/${tenant.slug}/customer/addresses`,
    )
      .then(setSavedAddresses)
      .catch(() => {});
  }, [tenant.id, locale]);
  useEffect(() => {
    if (hydrated.current)
      localStorage.setItem(`innovia.bag.${tenant.id}`, JSON.stringify(cart));
  }, [cart, tenant.id]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data = await request<{ items: PublicProduct[]; total: number }>(
          `/storefront/${tenant.slug}/products?${new URLSearchParams({ q, page: String(page), sort, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)), ...(category ? { category } : {}) })}`,
          { signal: controller.signal },
        );
        setCatalog(data);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Please try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [category, q, sort, page, tenant.slug, filters]);
  useEffect(() => {
    if (bag || selected) {
      const old = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = old;
      };
    }
  }, [bag, selected]);
  function add() {
    if (!selected) return;
    const variant = selected.variants.find((v) => v.id === variantId);
    if (!variant) return;
    setCart((current) => {
      const old = current.find((x) => x.variant.id === variant.id);
      return old
        ? current.map((x) =>
            x === old ? { ...x, quantity: x.quantity + 1 } : x,
          )
        : [...current, { product: selected, variant, quantity: 1 }];
    });
    setSelected(null);
    setBag(true);
    setKey(crypto.randomUUID());
    setError("");
  }
  const subtotal = cart.reduce(
    (sum, line) =>
      sum + Math.round(Number(line.variant.price) * 100) * line.quantity,
    0,
  );
  async function placeOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await mutate<{
        number: string;
        total: string;
        shippingTotal: string;
        taxTotal: string;
        trackingToken: string;
      }>(
        `/storefront/${tenant.slug}/checkout`,
        {
          storeId: data.storeId,
          email: data.email,
          phone: data.phone,
          customerName: data.customerName,
          channel: "ONLINE",
          paymentMethod: method,
          ...(data.rewardCode ? { rewardCode: data.rewardCode } : {}),
          ...(data.couponCode ? { couponCode: data.couponCode } : {}),
          ...(method === "CASH_ON_DELIVERY"
            ? {
                deliveryZoneId: zoneId,
                shippingAddress: {
                  recipient: data.customerName,
                  street: data.street,
                  city: data.city,
                  postalCode: data.postalCode,
                  phone: data.phone,
                  country: "MA",
                },
              }
            : {}),
          items: cart.map((l) => ({
            variantId: l.variant.id,
            quantity: l.quantity,
          })),
        },
        "POST",
        key,
      );
      setConfirmation(result);
      setCart([]);
      setCheckout(false);
      setKey(crypto.randomUUID());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`store store-spacing-${boutique.content?.design.spacing?.toLowerCase() ?? "airy"} store-heading-${boutique.content?.design.headingFont?.toLowerCase() ?? "serif"}`}
        style={{ "--store-accent": tenant.accent } as React.CSSProperties}
      >
        {tenant.demo && <div className="store-announcement">{t.demo}</div>}
        {boutique.preview && (
          <div className="store-announcement">
            PRIVATE DRAFT PREVIEW · NOT PUBLISHED
          </div>
        )}
        <header className="store-header">
          <a href={`/${tenant.slug}`} className="store-wordmark">
            {boutique.content?.design.logoUrl ? (
              <img
                className="store-logo"
                src={boutique.content.design.logoUrl}
                alt={tenant.name}
              />
            ) : (
              tenant.name
            )}
          </a>
          <nav>
            {boutique.content?.design.navigation.length ? (
              boutique.content.design.navigation.map((link, index) => (
                <a href={link.href} key={index}>
                  {link.label}
                </a>
              ))
            ) : (
              <>
                <a href="#collection">{t.new}</a>
                <a href="#collection">{t.shop}</a>
                <a href="#our-world">{t.about}</a>
              </>
            )}
          </nav>
          <div>
            <span className="store-locale">
              {locale?.toUpperCase()} / {tenant.currency}
            </span>
            <a href={`/${tenant.slug}/account`} className="store-account-link">
              Account
            </a>
            <button
              aria-label="Search collection"
              onClick={() => setSearch(!search)}
            >
              <Search size={19} strokeWidth={1.3} />
            </button>
            <button
              className="bag-button"
              aria-label={t.bag}
              onClick={() => {
                setBag(true);
                setError("");
                setConfirmation(null);
              }}
            >
              <ShoppingBag size={20} strokeWidth={1.3} />
              <span>{cart.reduce((s, l) => s + l.quantity, 0)}</span>
            </button>
          </div>
        </header>
        {search && (
          <div className="store-search">
            <Search size={18} />
            <input
              autoFocus
              aria-label="Find a piece"
              placeholder="Find a piece…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
                document
                  .getElementById("collection")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            />
            <button aria-label="Close search" onClick={() => setSearch(false)}>
              <X size={18} />
            </button>
          </div>
        )}
        {!boutique.content && (
          <section className="store-hero">
            {tenant.heroImage && (
              <img
                src={tenant.heroImage}
                alt={`${tenant.name} illustrative campaign`}
                fetchPriority="high"
              />
            )}
            <div className="hero-tint" />
            <motion.div
              className="hero-copy"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="store-eyebrow">THE NEW COLLECTION</span>
              <h1>{tenant.heroTitle}</h1>
              <p>{tenant.heroSubtitle}</p>
              <a href="#collection" className="store-cta">
                {t.hero}
                <ArrowUpRight size={19} />
              </a>
            </motion.div>
            <span className="hero-caption">
              A NEW SEASON. A FRESH PERSPECTIVE.
            </span>
            <span className="hero-number">01 — 26</span>
          </section>
        )}
        {boutique.content && (
          <CMSSections
            boutique={boutique}
            content={boutique.content}
            onProduct={(product) => {
              setSelected(product);
              setVariantId("");
            }}
          />
        )}
        <div className="store-philosophy">
          <span>INDEPENDENT SPIRIT.</span>
          <span>CONSIDERED DESIGN.</span>
          <span>EVERYDAY POSSIBILITY.</span>
        </div>
        <main id="collection" className="store-collection">
          <div className="collection-heading">
            <div>
              <span className="store-eyebrow">CURATED FOR YOU</span>
              <h2>{t.collection}</h2>
              <p>{t.intro}</p>
            </div>
            <span>{catalog.total} pieces to discover</span>
          </div>
          <div className="store-filters">
            <div>
              <button
                className={category === "" ? "active" : ""}
                onClick={() => {
                  setCategory("");
                  setPage(1);
                }}
              >
                {t.all}
              </button>
              {boutique.categories.map((c) => (
                <button
                  key={c}
                  className={category === c ? "active" : ""}
                  onClick={() => {
                    setCategory(c);
                    setPage(1);
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <label>
              <SlidersHorizontal size={15} />
              <select
                aria-label="Sort collection"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
              >
                <option value="newest">Newest first</option>
                <option value="name">Name A–Z</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </label>
          </div>
          <button
            className="account-text-button"
            aria-expanded={filtersShown}
            onClick={() => setFiltersShown(!filtersShown)}
          >
            Refine the edit
          </button>
          {filtersShown && (
            <div className="catalog-refinements">
              {(
                [
                  ["brand", "brands"],
                  ["collection", "collections"],
                  ["size", "sizes"],
                  ["color", "colors"],
                ] as const
              ).map(([field, facet]) => (
                <label key={field}>
                  {field[0]!.toUpperCase() + field.slice(1)}
                  <select
                    aria-label={`Filter ${field}`}
                    value={filters[field]}
                    onChange={(event) => {
                      setFilters({ ...filters, [field]: event.target.value });
                      setPage(1);
                    }}
                  >
                    <option value="">All</option>
                    {facets[facet]?.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              ))}
              {(["minPrice", "maxPrice"] as const).map((field) => (
                <label key={field}>
                  {field === "minPrice" ? "Minimum price" : "Maximum price"}
                  <input
                    type="number"
                    min="0"
                    max="99999999"
                    value={filters[field]}
                    onChange={(event) => {
                      setFilters({ ...filters, [field]: event.target.value });
                      setPage(1);
                    }}
                  />
                </label>
              ))}
              <button
                className="account-text-button"
                onClick={() => {
                  setFilters({
                    brand: "",
                    collection: "",
                    size: "",
                    color: "",
                    minPrice: "",
                    maxPrice: "",
                  });
                  setCategory("");
                  setQ("");
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            </div>
          )}
          {error && !bag && (
            <div className="store-error" role="alert">
              {error}
            </div>
          )}
          <div className={`store-products ${loading ? "loading" : ""}`}>
            {catalog.items.map((p) => (
              <button
                className="store-product"
                key={p.id}
                onClick={() => {
                  setSelected(p);
                  setVariantId("");
                }}
              >
                <div className="store-product-image">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} loading="lazy" />
                  ) : (
                    <span>{p.name}</span>
                  )}
                  <span className="quick-view">
                    Discover the piece
                    <Plus size={16} />
                  </span>
                </div>
                <div className="store-product-meta">
                  <div>
                    <span>{p.category}</span>
                    <h3>{p.name}</h3>
                  </div>
                  <strong>{money(p.variants[0]?.price ?? 0)}</strong>
                </div>
                <small>
                  {new Set(p.variants.map((v) => v.color)).size} color ·{" "}
                  {p.variants.length} sizes
                </small>
              </button>
            ))}
          </div>
          {catalog.total === 0 && (
            <div className="store-empty">
              <h2>No pieces found.</h2>
              <p>Try a different category or search.</p>
            </div>
          )}
          {catalog.total > 24 && (
            <div className="store-pagination">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span>
                {page} / {Math.ceil(catalog.total / 24)}
              </span>
              <button
                disabled={page * 24 >= catalog.total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </main>
        {!boutique.content && (
          <section id="our-world" className="store-story">
            <div>
              <span className="store-eyebrow">THE WORLD OF {tenant.name}</span>
              <h2>
                Fewer things.
                <br />
                <em>More meaning.</em>
              </h2>
            </div>
            <div>
              <p>
                A wardrobe is personal. It tells a story of where you’ve been
                and who you’re becoming. We believe in pieces that become part
                of that story.
              </p>
              <p>
                Explore our collection, then visit us in person. A thoughtful
                experience, from first discovery to your next everyday
                favourite.
              </p>
              <a href="#collection">
                Find your next piece
                <ArrowRight size={18} />
              </a>
            </div>
          </section>
        )}
        <footer className="store-footer">
          <div>
            <span className="store-wordmark">{tenant.name}</span>
            <p>
              {boutique.content?.design.footerText ??
                "Independent fashion. Beautifully connected."}
            </p>
            {boutique.content?.design.socialLinks.map((link, index) => (
              <a
                key={index}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label} ↗
              </a>
            ))}
          </div>
          <div>
            <span className="store-eyebrow">FIND US</span>
            {boutique.stores.map((s) => (
              <p key={s.id}>
                <MapPin size={13} />
                {s.name}, {s.city}
              </p>
            ))}
          </div>
          <div>
            <span className="store-eyebrow">THE DETAILS</span>
            <p>
              Store pickup{boutique.zones?.length ? " · Cash on delivery" : ""}
            </p>
            <p>
              {boutique.settings?.returnPolicy ||
                "Returns: please contact your boutique."}
            </p>
            {boutique.settings?.contactEmail && (
              <a href={`mailto:${boutique.settings.contactEmail}`}>
                {boutique.settings.contactEmail}
              </a>
            )}
          </div>
          <div className="store-footer-bottom">
            <span>© 2026 {tenant.name}</span>
            <span>POWERED BY INNOVIA FASHION OS</span>
            <span>
              {tenant.currency} / {locale?.toUpperCase()}
            </span>
          </div>
        </footer>
        {selected && (
          <StoreDialog title={selected.name} onClose={() => setSelected(null)}>
            <div className="store-detail">
              <div className="detail-image">
                {selected.imageUrl && (
                  <img src={selected.imageUrl} alt={selected.name} />
                )}
              </div>
              <div className="detail-copy">
                <span className="store-eyebrow">
                  {selected.brand} / {selected.category}
                </span>
                <h2>{selected.name}</h2>
                <span className="detail-price">
                  {money(
                    selected.variants.find((v) => v.id === variantId)?.price ??
                      selected.variants[0]?.price ??
                      0,
                  )}
                </span>
                <p>{selected.description}</p>
                <a
                  href={`/${tenant.slug}/products/${selected.id}`}
                  className="account-text-button"
                >
                  Gallery, size guide & wishlist →
                </a>
                <label className="store-eyebrow">{t.size}</label>
                <div className="store-sizes">
                  {selected.variants.map((v) => (
                    <button
                      key={v.id}
                      disabled={!v.availability.some((i) => i.available > 0)}
                      className={v.id === variantId ? "active" : ""}
                      onClick={() => setVariantId(v.id)}
                    >
                      {v.size}
                      <small>{v.color}</small>
                    </button>
                  ))}
                </div>
                <button
                  className="store-cta dark"
                  disabled={!variantId}
                  onClick={add}
                >
                  {t.add}
                  <Plus size={16} />
                </button>
                <p className="detail-note">
                  Reserve online. Collect at your boutique.
                  <br />
                  Your order reserves stock; payment is due at pickup.
                </p>
              </div>
            </div>
          </StoreDialog>
        )}
        {bag && (
          <StoreDialog
            title={t.bag}
            onClose={() => {
              setBag(false);
              setCheckout(false);
              setError("");
            }}
            drawer
          >
            <div className="store-bag">
              {confirmation ? (
                <div className="order-confirmation">
                  <span>
                    <Check size={26} />
                  </span>
                  <h2>Your next favourite awaits.</h2>
                  <p>
                    Reservation {confirmation.number}
                    <br />
                    Total due{" "}
                    {method === "PICKUP" ? "at pickup" : "on delivery"}:{" "}
                    {money(confirmation.total)}
                  </p>
                  <p>
                    Your boutique has received your order. Keep the private
                    tracking link below and contact the boutique to arrange
                    fulfilment.
                  </p>
                  <a
                    className="store-cta dark"
                    href={`/${tenant.slug}/tracking?${new URLSearchParams({ number: confirmation.number, token: confirmation.trackingToken })}`}
                  >
                    Track your order →
                  </a>
                  <button
                    className="store-cta dark"
                    onClick={() => {
                      setBag(false);
                      setConfirmation(null);
                    }}
                  >
                    {t.close}
                    <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <>
                  {cart.length === 0 ? (
                    <div className="store-empty">
                      <ShoppingBag size={30} strokeWidth={1} />
                      <h2>{t.empty}</h2>
                      <button
                        className="store-cta dark"
                        onClick={() => setBag(false)}
                      >
                        {t.close}
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="store-bag-lines">
                        {cart.map((l) => (
                          <div key={l.variant.id}>
                            <img
                              src={l.product.imageUrl}
                              alt={l.product.name}
                            />
                            <div>
                              <strong>{l.product.name}</strong>
                              <small>
                                {l.variant.color} / {l.variant.size}
                              </small>
                              <span>{money(l.variant.price)}</span>
                              <div className="bag-quantity">
                                <button
                                  aria-label="Decrease quantity"
                                  disabled={pending}
                                  onClick={() => {
                                    setCart(
                                      cart
                                        .map((x) =>
                                          x === l
                                            ? { ...x, quantity: x.quantity - 1 }
                                            : x,
                                        )
                                        .filter((x) => x.quantity > 0),
                                    );
                                    setKey(crypto.randomUUID());
                                  }}
                                >
                                  <Minus size={13} />
                                </button>
                                <span>{l.quantity}</span>
                                <button
                                  aria-label="Increase quantity"
                                  disabled={pending}
                                  onClick={() => {
                                    setCart(
                                      cart.map((x) =>
                                        x === l
                                          ? { ...x, quantity: x.quantity + 1 }
                                          : x,
                                      ),
                                    );
                                    setKey(crypto.randomUUID());
                                  }}
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            </div>
                            <strong>
                              {money(
                                (Math.round(Number(l.variant.price) * 100) *
                                  l.quantity) /
                                  100,
                              )}
                            </strong>
                          </div>
                        ))}
                      </div>
                      <div className="bag-total">
                        <span>Subtotal</span>
                        <strong>{money(subtotal / 100)}</strong>
                      </div>
                      <p className="detail-note">
                        Pay at collection or, where available, on delivery.
                        Prices include configured tax. The boutique confirms the
                        final total when reserving your order.
                      </p>
                      {checkout ? (
                        <form
                          className="store-checkout"
                          onSubmit={placeOrder}
                          onChange={() => setKey(crypto.randomUUID())}
                        >
                          <label>
                            Receive your pieces
                            <select
                              value={method}
                              onChange={(e) =>
                                setMethod(e.target.value as typeof method)
                              }
                            >
                              <option value="PICKUP">
                                Collect at the boutique
                              </option>
                              {!!boutique.zones?.length && (
                                <option value="CASH_ON_DELIVERY">
                                  Delivery · pay on arrival
                                </option>
                              )}
                            </select>
                          </label>
                          {method === "CASH_ON_DELIVERY" && (
                            <>
                              <label>
                                Delivery area
                                <select
                                  value={zoneId}
                                  required
                                  onChange={(e) => setZoneId(e.target.value)}
                                >
                                  {boutique.zones?.map((zone) => (
                                    <option value={zone.id} key={zone.id}>
                                      {zone.name} · {money(zone.fee)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <p>{boutique.settings?.deliveryPolicy}</p>
                              {savedAddresses.length > 0 && (
                                <label>
                                  Saved address
                                  <select
                                    value={savedId}
                                    onChange={(e) => setSavedId(e.target.value)}
                                  >
                                    <option value="">
                                      Enter a new address
                                    </option>
                                    {savedAddresses.map((address) => (
                                      <option
                                        key={address.id}
                                        value={address.id}
                                      >
                                        {address.street}, {address.city}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}
                            </>
                          )}
                          <label>
                            {t.name}
                            <input
                              name="customerName"
                              required
                              minLength={2}
                              autoComplete="name"
                              key={`name-${savedId}`}
                              defaultValue={
                                savedAddresses.find((a) => a.id === savedId)
                                  ?.recipient
                              }
                            />
                          </label>
                          <label>
                            {t.email}
                            <input
                              name="email"
                              type="email"
                              required
                              autoComplete="email"
                            />
                          </label>
                          <label>
                            {t.phone}
                            <input
                              name="phone"
                              type="tel"
                              required
                              placeholder="+212612345678"
                              pattern="(\+212|0)[5-7][0-9]{8}"
                              autoComplete="tel"
                              key={`phone-${savedId}`}
                              defaultValue={
                                savedAddresses.find((a) => a.id === savedId)
                                  ?.phone
                              }
                            />
                          </label>
                          <label>
                            {method === "PICKUP"
                              ? t.pickup
                              : "Dispatch boutique"}
                            <select name="storeId" required>
                              {boutique.stores.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          {method === "CASH_ON_DELIVERY" && (
                            <>
                              <label>
                                Street and apartment
                                <input
                                  name="street"
                                  required
                                  minLength={5}
                                  maxLength={500}
                                  key={`street-${savedId}`}
                                  defaultValue={
                                    savedAddresses.find((a) => a.id === savedId)
                                      ?.street
                                  }
                                  autoComplete="street-address"
                                />
                              </label>
                              <label>
                                City
                                <select
                                  name="city"
                                  required
                                  key={`city-${zoneId}-${savedId}`}
                                  defaultValue={
                                    savedAddresses.find((a) => a.id === savedId)
                                      ?.city
                                  }
                                >
                                  {boutique.zones
                                    ?.find((zone) => zone.id === zoneId)
                                    ?.cities.map((city) => (
                                      <option key={city}>{city}</option>
                                    ))}
                                </select>
                              </label>
                              <label>
                                Postal code
                                <input
                                  name="postalCode"
                                  required
                                  pattern="[0-9]{5}"
                                  key={`postal-${savedId}`}
                                  defaultValue={
                                    savedAddresses.find((a) => a.id === savedId)
                                      ?.postalCode
                                  }
                                  autoComplete="postal-code"
                                />
                              </label>
                              <p>
                                Delivery:{" "}
                                {money(
                                  boutique.zones?.find(
                                    (zone) => zone.id === zoneId,
                                  )?.fee ?? 0,
                                )}
                              </p>
                            </>
                          )}
                          <label>
                            Membership voucher (optional)
                            <input
                              name="rewardCode"
                              minLength={8}
                              maxLength={100}
                              placeholder="RW-…"
                            />
                            <small>
                              Use your membership email. The basket must cover
                              the voucher’s full value. Use one voucher or
                              promotion per order.
                            </small>
                          </label>
                          <label>
                            Promotion code (optional)
                            <input
                              name="couponCode"
                              minLength={3}
                              maxLength={50}
                              placeholder="Your promotion code"
                            />
                          </label>
                          <p>
                            We use these contact details to fulfil this
                            reservation. Marketing consent is not requested or
                            inferred.
                          </p>
                          <button
                            className="store-cta dark"
                            disabled={pending}
                            type="submit"
                          >
                            {pending
                              ? "Reserving your pieces…"
                              : method === "PICKUP"
                                ? "Confirm pickup reservation"
                                : "Confirm delivery order"}
                            <ArrowRight size={16} />
                          </button>
                        </form>
                      ) : (
                        <button
                          className="store-cta dark"
                          onClick={() => setCheckout(true)}
                        >
                          {t.checkout}
                          <ArrowRight size={17} />
                        </button>
                      )}
                    </>
                  )}
                  {error && (
                    <div className="store-error" role="alert">
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>
          </StoreDialog>
        )}
      </div>
    </MotionConfig>
  );
}
function StoreDialog({
  title,
  children,
  onClose,
  drawer = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`store-dialog ${drawer ? "drawer" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="store-dialog-heading">
        <span>{title}</span>
        <button aria-label="Close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
