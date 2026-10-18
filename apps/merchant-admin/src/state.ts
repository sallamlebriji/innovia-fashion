import { create } from "zustand";
import type { Locale } from "@innovia/types";
const dictionary = {
  en: {
    overview: "Overview",
    catalog: "Products",
    inventory: "Inventory",
    orders: "Orders",
    customers: "Customers",
    pos: "Point of sale",
    storefront: "Online store",
    settings: "Settings",
    workspace: "WORKSPACE",
    channels: "SALES CHANNELS",
    search: "Search products, SKUs…",
    welcome: "A little perspective. A lot of possibility.",
    greeting: "Good to see you",
    newProduct: "Add product",
    revenue: "Total revenue",
    sales: "Orders",
    average: "Average order value",
    stock: "Available inventory",
    days: "Last 30 days",
    export: "Export report",
    salesOverview: "Sales overview",
    recentOrders: "Recent orders",
    bestsellers: "The best-selling edit",
    allStores: "All locations",
    activity: "Activity",
    demo: "DEMO WORKSPACE",
    demoText: "Fictional boutique · Real connected workflows",
    viewStore: "View storefront",
    logout: "Sign out",
  },
  fr: {
    overview: "Vue d’ensemble",
    catalog: "Produits",
    inventory: "Stock",
    orders: "Commandes",
    customers: "Clients",
    pos: "Point de vente",
    storefront: "Boutique en ligne",
    settings: "Paramètres",
    workspace: "ESPACE DE TRAVAIL",
    channels: "CANAUX DE VENTE",
    search: "Rechercher un produit, un SKU…",
    welcome: "Un peu de recul. Beaucoup de possibilités.",
    greeting: "Heureux de vous revoir",
    newProduct: "Ajouter un produit",
    revenue: "Chiffre d’affaires",
    sales: "Commandes",
    average: "Panier moyen",
    stock: "Stock disponible",
    days: "30 derniers jours",
    export: "Exporter",
    salesOverview: "Vue des ventes",
    recentOrders: "Commandes récentes",
    bestsellers: "Les meilleures ventes",
    allStores: "Tous les magasins",
    activity: "Activité",
    demo: "ESPACE DÉMO",
    demoText: "Boutique fictive · Fonctions connectées",
    viewStore: "Voir la boutique",
    logout: "Déconnexion",
  },
  ar: {
    overview: "نظرة عامة",
    catalog: "المنتجات",
    inventory: "المخزون",
    orders: "الطلبات",
    customers: "العملاء",
    pos: "نقطة البيع",
    storefront: "المتجر الإلكتروني",
    settings: "الإعدادات",
    workspace: "مساحة العمل",
    channels: "قنوات البيع",
    search: "ابحث عن منتج…",
    welcome: "رؤية جديدة. إمكانيات لا حدود لها.",
    greeting: "مرحباً بعودتك",
    newProduct: "إضافة منتج",
    revenue: "إجمالي الإيرادات",
    sales: "الطلبات",
    average: "متوسط قيمة الطلب",
    stock: "المخزون المتاح",
    days: "آخر 30 يوماً",
    export: "تصدير التقرير",
    salesOverview: "نظرة على المبيعات",
    recentOrders: "أحدث الطلبات",
    bestsellers: "الأكثر مبيعاً",
    allStores: "كل الفروع",
    activity: "النشاط",
    demo: "مساحة تجريبية",
    demoText: "متجر خيالي · عمليات متصلة",
    viewStore: "عرض المتجر",
    logout: "تسجيل الخروج",
  },
};
export const usePreferences = create<{
  locale: Locale;
  theme: "light" | "dark";
  setLocale: (locale: Locale) => void;
  toggleTheme: () => void;
}>((set) => ({
  locale: ["en", "fr", "ar"].includes(
    localStorage.getItem("innovia.locale") ?? "",
  )
    ? (localStorage.getItem("innovia.locale") as Locale)
    : "en",
  theme: localStorage.getItem("innovia.theme") === "dark" ? "dark" : "light",
  setLocale: (locale) => {
    localStorage.setItem("innovia.locale", locale);
    set({ locale });
  },
  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === "light" ? "dark" : "light";
      localStorage.setItem("innovia.theme", theme);
      return { theme };
    }),
}));
export function useLabels() {
  const locale = usePreferences((s) => s.locale);
  return dictionary[locale] ?? dictionary.en;
}
