import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Package,
  Layers3,
  ShoppingBag,
  Users,
  Monitor,
  Globe2,
  Settings2,
  ArrowUpRight,
  ChevronDown,
  Search,
  Bell,
  HelpCircle,
  Menu,
  X,
  Moon,
  Sun,
  LogOut,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { motion } from "motion/react";
import { request, mutate, setCsrfToken } from "@innovia/api-client";
import { Button, Badge, AccountRecovery } from "@innovia/ui";
import type { Session, Store } from "@innovia/types";
import { useLabels, usePreferences } from "./state";
import { useWords } from "./words";
import { Loading, Modal, Notice } from "./components";
import { InviteAccept } from "./pages/InviteAccept";
const Overview = lazy(() =>
  import("./pages/Overview").then((m) => ({ default: m.Overview })),
);
const Reports = lazy(() =>
  import("./pages/Reports").then((m) => ({ default: m.Reports })),
);
const PlatformControl = lazy(() =>
  import("./pages/PlatformControl").then((m) => ({
    default: m.PlatformControl,
  })),
);
const Catalog = lazy(() =>
  import("./pages/Catalog").then((m) => ({ default: m.Catalog })),
);
const Inventory = lazy(() =>
  import("./pages/Inventory").then((m) => ({ default: m.Inventory })),
);
const Operations = lazy(() =>
  import("./pages/Operations").then((m) => ({ default: m.Operations })),
);
const Orders = lazy(() =>
  import("./pages/Commerce").then((m) => ({ default: m.Orders })),
);
const Customers = lazy(() =>
  import("./pages/Commerce").then((m) => ({ default: m.Customers })),
);
const POS = lazy(() => import("./pages/POS").then((m) => ({ default: m.POS })));
const StorefrontStudio = lazy(() =>
  import("./pages/StorefrontStudio").then((m) => ({
    default: m.StorefrontStudio,
  })),
);
const DeliverySettings = lazy(() =>
  import("./pages/DeliverySettings").then((m) => ({
    default: m.DeliverySettings,
  })),
);
const Loyalty = lazy(() =>
  import("./pages/Loyalty").then((m) => ({ default: m.Loyalty })),
);
const MediaLibrary = lazy(() =>
  import("./pages/MediaLibrary").then((m) => ({ default: m.MediaLibrary })),
);
const Staff = lazy(() =>
  import("./pages/Staff").then((m) => ({ default: m.Staff })),
);
const VirtualFitting = lazy(() =>
  import("./pages/VirtualFitting").then((m) => ({ default: m.VirtualFitting })),
);
const CashRegisters = lazy(() =>
  import("./pages/CashRegisters").then((m) => ({ default: m.CashRegisters })),
);
const Promotions = lazy(() =>
  import("./pages/Promotions").then((m) => ({ default: m.Promotions })),
);
const Campaigns = lazy(() =>
  import("./pages/Campaigns").then((m) => ({ default: m.Campaigns })),
);
const Billing = lazy(() =>
  import("./pages/Billing").then((m) => ({ default: m.Billing })),
);
const Support = lazy(() =>
  import("./pages/Support").then((m) => ({ default: m.Support })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings })),
);
const Platform = lazy(() =>
  import("./pages/Platform").then((m) => ({ default: m.Platform })),
);
export interface Workspace {
  session: Session;
  stores: Store[];
}
export function useWorkspace() {
  return useOutletContext<Workspace>();
}
export function App() {
  const query = useQuery({
    queryKey: ["session"],
    queryFn: () => request<Session>("/auth/me"),
    retry: false,
  });
  const { locale, theme } = usePreferences();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.theme = theme;
  }, [locale, theme]);
  useEffect(() => {
    if (query.data) setCsrfToken(query.data.csrfToken);
  }, [query.data]);
  if (query.isPending) return <Loading />;
  const invite = new URLSearchParams(window.location.search).get("invite");
  if (invite) return <InviteAccept token={invite} />;
  if (!query.data) return <Auth />;
  return <Shell session={query.data} />;
}
function Auth() {
  const t = useWords();
  const locale = usePreferences((s) => s.locale);
  const [register, setRegister] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>();
  const client = useQueryClient();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const session = await mutate<Session>(
        `/auth/${register ? "register" : "login"}`,
        Object.fromEntries(form),
      );
      setCsrfToken(session.csrfToken);
      client.setQueryData(["session"], session);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <div className="wordmark">
          INNOVIA<span>FASHION OS</span>
        </div>
        <div>
          <span className="eyebrow">{t("CONSIDERED COMMERCE.")}</span>
          <h1>
            {t("For the brands")}
            <br />
            {t("shaping")} <em>{t("what’s next.")}</em>
          </h1>
          <p>
            {t("Your collections, your customers, your world.")}
            <br />
            {t("Beautifully connected.")}
          </p>
        </div>
        <span className="auth-foot">
          {t("BUILT FOR FASHION. DESIGNED FOR YOU.")}
        </span>
      </div>
      <main className="auth-main">
        <div className="auth-forms">
          <form onSubmit={submit}>
            <label className="auth-language">
              {t("Language")}
              <select
                value={locale}
                onChange={(event) =>
                  usePreferences
                    .getState()
                    .setLocale(event.target.value as "en" | "fr" | "ar")
                }
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
              </select>
            </label>
            <span className="eyebrow">{t("YOUR NEXT CHAPTER")}</span>
            <h2>{register ? t("Make it yours.") : t("Welcome back.")}</h2>
            <p>
              {register
                ? t("Create your boutique workspace.")
                : t("Sign in to your INNOVIA workspace.")}
            </p>
            {register && (
              <>
                <label>
                  {t("Your name")}
                  <input
                    name="name"
                    required
                    minLength={2}
                    autoComplete="name"
                  />
                </label>
                <label>
                  {t("Business name")}
                  <input name="businessName" required minLength={2} />
                </label>
              </>
            )}
            <label>
              {t("Email address")}
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@yourbrand.com"
              />
            </label>
            <label>
              {t("Password")}
              <input
                name="password"
                type="password"
                required
                minLength={register ? 12 : 1}
                autoComplete={register ? "new-password" : "current-password"}
              />
            </label>
            <Notice error={error} />
            <Button disabled={pending} type="submit">
              {pending
                ? t("Please wait…")
                : register
                  ? t("Create workspace")
                  : t("Enter your workspace")}
              <ArrowRight size={17} />
            </Button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setRegister(!register);
                setError(null);
              }}
            >
              {register
                ? t("Already have a workspace? Sign in")
                : t("New to INNOVIA? Create a workspace")}
            </button>
            {import.meta.env.DEV && (
              <div className="auth-demo">
                <Badge tone="gold">LOCAL DEMO</Badge>
                <p>
                  Demo merchant: atelier-noir@demo.innovia.local
                  <br />
                  Use DEMO_PASSWORD from your local .env file.
                </p>
              </div>
            )}
          </form>
          <AccountRecovery endpoint="/api/v1/auth/recovery" locale={locale} />
        </div>
      </main>
    </div>
  );
}
function Shell({ session }: { session: Session }) {
  const t = useWords();
  const labels = useLabels(),
    prefs = usePreferences(),
    client = useQueryClient(),
    navigate = useNavigate(),
    location = useLocation();
  const [menu, setMenu] = useState(false),
    [dialog, setDialog] = useState<"activity" | "help" | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const stores = useQuery({
    queryKey: ["stores"],
    queryFn: () => request<Store[]>("/stores"),
    enabled: !!session.tenant,
  });
  const logs = useQuery({
    queryKey: ["audit"],
    queryFn: () =>
      request<{ id: string; action: string; createdAt: string }[]>("/audit"),
    enabled: dialog === "activity" && !!session.tenant,
  });
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        search.current?.focus();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);
  async function logout() {
    await mutate("/auth/logout", {});
    setCsrfToken("");
    client.setQueryData(["session"], null);
    client.removeQueries({
      predicate: (query) => query.queryKey[0] !== "session",
    });
    navigate("/");
  }
  const nav = [
    { to: "/", icon: LayoutDashboard, label: labels.overview },
    ...(session.user.role !== "CASHIER"
      ? [
          {
            to: "/reports",
            icon: LayoutDashboard,
            label: t("Business reports"),
          },
        ]
      : []),
    { to: "/catalog", icon: Package, label: labels.catalog },
    { to: "/inventory", icon: Layers3, label: labels.inventory },
    { to: "/operations", icon: ArrowRight, label: t("Retail operations") },
    { to: "/media", icon: Package, label: t("Media library") },
    { to: "/virtual-fitting", icon: ShieldCheck, label: t("Virtual fitting") },
    { to: "/orders", icon: ShoppingBag, label: labels.orders },
    { to: "/customers", icon: Users, label: labels.customers },
    { to: "/loyalty", icon: ShieldCheck, label: t("Members club") },
    { to: "/registers", icon: Monitor, label: t("Cash registers") },
    ...(session.user.role !== "CASHIER"
      ? [
          { to: "/promotions", icon: ShoppingBag, label: t("Promotions") },
          { to: "/campaigns", icon: Bell, label: t("Customer campaigns") },
        ]
      : []),
    { to: "/commerce-settings", icon: Globe2, label: t("Delivery & commerce") },
    ...(session.user.role !== "CASHIER"
      ? [{ to: "/staff", icon: Users, label: t("Staff & access") }]
      : []),
    { to: "/support", icon: HelpCircle, label: t("Support") },
  ];
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label={t("Close navigation")}
          onClick={() => setMenu(false)}
        />
      )}
      <aside id="workspace-sidebar" className={`sidebar ${menu ? "open" : ""}`}>
        <NavLink to="/" className="wordmark">
          INNOVIA<span>FASHION OS</span>
        </NavLink>
        <button
          className="mobile-close icon-button"
          aria-label={t("Close navigation")}
          onClick={() => setMenu(false)}
        >
          <X size={20} />
        </button>
        <div className="brand-selector">
          <span className="brand-monogram">
            {session.tenant
              ? session.tenant.name
                  .split(" ")
                  .map((x) => x[0])
                  .join("")
                  .slice(0, 2)
              : "IO"}
          </span>
          <div>
            <strong>{session.tenant?.name ?? "Platform operator"}</strong>
            <span>{session.tenant?.plan.name ?? "Super Admin"} workspace</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav aria-label={t("Workspace navigation")}>
          <span className="nav-label">{labels.workspace}</span>
          {session.tenant ? (
            nav.map((x) => (
              <NavLink
                key={x.to}
                to={x.to}
                end={x.to === "/"}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                <x.icon size={18} strokeWidth={1.6} />
                {x.label}
                {x.to === "/orders" && <span className="nav-dot" />}
              </NavLink>
            ))
          ) : (
            <NavLink className="nav-item active" to="/platform">
              <ShieldCheck size={18} />
              {t("Platform overview")}
            </NavLink>
          )}
          {session.tenant && (
            <>
              <span className="nav-label channels-label">
                {labels.channels}
              </span>
              <NavLink to="/pos" className="nav-item">
                <Monitor size={18} strokeWidth={1.6} />
                {labels.pos}
                <span className="live-dot" />
              </NavLink>
              <NavLink to="/storefront" className="nav-item">
                <Globe2 size={18} strokeWidth={1.6} />
                {labels.storefront}
                <ArrowUpRight size={14} className="nav-arrow" />
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          {session.tenant && (
            <div className="plan-card">
              <span className="plan-icon">✧</span>
              <strong>A little more possibility.</strong>
              <p>
                {session.tenant.plan.name} ·{" "}
                {session.tenant.plan.productLimit.toLocaleString()}
                {t("products")}
              </p>
              <NavLink to="/settings">
                {t("Your workspace settings")}
                <ArrowRight size={14} />
              </NavLink>
            </div>
          )}
          {session.tenant && (
            <NavLink to="/settings" className="nav-item">
              <Settings2 size={18} />
              {labels.settings}
            </NavLink>
          )}
          <button
            className="profile"
            onClick={logout}
            title={labels.logout}
            aria-label={labels.logout}
          >
            <span className="avatar">
              {session.user.name.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong>{session.user.name}</strong>
              <small>
                {session.user.role.replaceAll("_", " ").toLowerCase()}
              </small>
            </span>
            <LogOut size={16} />
          </button>
          <div className="sidebar-copyright">© 2026 INNOVIA</div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label={t("Open navigation")}
            aria-expanded={menu}
            aria-controls="workspace-sidebar"
            onClick={() => setMenu(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            {t("Workspace")}
            <span>/</span>
            <strong>
              {session.tenant
                ? (nav.find((x) => x.to === location.pathname)?.label ??
                  (location.pathname === "/pos"
                    ? labels.pos
                    : location.pathname === "/settings"
                      ? labels.settings
                      : labels.storefront))
                : t("Platform")}
            </strong>
          </div>
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(
                `/catalog?q=${encodeURIComponent(search.current?.value ?? "")}`,
              );
            }}
          >
            <Search size={16} />
            <input
              ref={search}
              aria-label={t("Search products")}
              placeholder={labels.search}
            />
            <kbd>⌘ K</kbd>
          </form>
          <div className="topbar-actions">
            <select
              aria-label={t("Language")}
              value={prefs.locale}
              onChange={(e) =>
                prefs.setLocale(e.target.value as "en" | "fr" | "ar")
              }
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
              <option value="ar">AR</option>
            </select>
            <button
              className="icon-button"
              aria-label={t("Toggle theme")}
              onClick={prefs.toggleTheme}
            >
              {prefs.theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button
              className="icon-button"
              aria-label={t("Help")}
              onClick={() => setDialog("help")}
            >
              <HelpCircle size={18} />
            </button>
            {session.tenant && (
              <button
                className="icon-button notification-button"
                aria-label={labels.activity}
                onClick={() => setDialog("activity")}
              >
                <Bell size={18} />
              </button>
            )}
            <span className="avatar small">
              {session.user.name.slice(0, 1)}
            </span>
          </div>
        </header>
        {session.tenant?.demo && (
          <div className="demo-strip">
            <span>
              <span className="live-dot" />
              {labels.demo}
            </span>
            <span>{labels.demoText}</span>
            <a
              target="_blank"
              rel="noreferrer"
              href={`${session.storefrontOrigin}/${encodeURIComponent(session.tenant.slug)}`}
            >
              {labels.viewStore}
              <ArrowUpRight size={13} />
            </a>
          </div>
        )}
        <motion.main
          id="main"
          className="main-content"
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route
                element={
                  <WorkspaceOutlet
                    value={{ session, stores: stores.data ?? [] }}
                  />
                }
              >
                {session.tenant ? (
                  <>
                    <Route path="/" element={<Overview />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/catalog" element={<Catalog />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/operations" element={<Operations />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/loyalty" element={<Loyalty />} />
                    <Route path="/registers" element={<CashRegisters />} />
                    <Route path="/promotions" element={<Promotions />} />
                    <Route path="/campaigns" element={<Campaigns />} />
                    <Route path="/media" element={<MediaLibrary />} />
                    <Route
                      path="/virtual-fitting"
                      element={<VirtualFitting />}
                    />
                    <Route path="/staff" element={<Staff />} />
                    <Route path="/support" element={<Support />} />
                    <Route
                      path="/commerce-settings"
                      element={<DeliverySettings />}
                    />
                    <Route path="/pos" element={<POS />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/storefront" element={<StorefrontStudio />} />
                  </>
                ) : (
                  <>
                    <Route path="/platform" element={<Platform />} />
                    <Route
                      path="/platform/control"
                      element={<PlatformControl />}
                    />
                    <Route
                      path="/platform/billing"
                      element={<Billing operator />}
                    />
                    <Route
                      path="/platform/support"
                      element={<Support operator />}
                    />
                  </>
                )}
                <Route
                  path="*"
                  element={
                    <Navigate to={session.tenant ? "/" : "/platform"} replace />
                  }
                />
              </Route>
            </Routes>
          </Suspense>
        </motion.main>
        <footer className="app-footer">
          <span>
            INNOVIA FASHION OS <span className="footer-divider">/</span> A
            considered way to grow.
          </span>
          <span>
            <span className="live-dot" />
            {t("Connected to your workspace")}
          </span>
        </footer>
      </div>
      {dialog && (
        <Modal
          title={dialog === "help" ? t("A little guidance.") : labels.activity}
          onClose={() => setDialog(null)}
        >
          {dialog === "help" ? (
            <div className="modal-body">
              <p>
                Create products and variants in Products, receive or adjust
                units in Inventory, and sell with Point of sale. All changes are
                saved in MySQL.
              </p>
              <p>
                Online orders reserve stock until you complete or cancel them. A
                returns and exchanges restore the selected units. Customer
                accounts, membership rewards, delivery and the native customer
                app use the same retail data. Virtual fitting requires a
                configured provider and an eligible plan.
              </p>
              <a
                className="button button-secondary"
                href="/api/v1/openapi.json"
                target="_blank"
                rel="noreferrer"
              >
                View API contract
                <ArrowUpRight size={16} />
              </a>
            </div>
          ) : (
            <div className="activity-list">
              {logs.isPending ? (
                <Loading />
              ) : (
                logs.data?.map((x) => (
                  <div key={x.id}>
                    <span className="activity-mark" />
                    <div>
                      <strong>
                        {x.action.toLowerCase().replaceAll("_", " ")}
                      </strong>
                      <small>{new Date(x.createdAt).toLocaleString()}</small>
                    </div>
                  </div>
                ))
              )}
              <Notice error={logs.error} />
              {logs.data?.length === 0 && <p>No activity yet.</p>}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
import { Outlet } from "react-router-dom";
function WorkspaceOutlet({ value }: { value: Workspace }) {
  return <Outlet context={value} />;
}
