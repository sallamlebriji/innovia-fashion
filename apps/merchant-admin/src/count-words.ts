import { usePreferences } from "./state";
import type { Locale } from "@innovia/types";

type Noun =
  "product" | "variant" | "row" | "piece" | "order" | "customer" | "sale";
const forms = {
  en: {
    product: ["product", "products"],
    variant: ["variant", "variants"],
    row: ["row", "rows"],
    piece: ["piece", "pieces"],
    order: ["order", "orders"],
    customer: ["customer", "customers"],
    sale: ["sale", "sales"],
  },
  fr: {
    product: ["produit", "produits"],
    variant: ["variante", "variantes"],
    row: ["ligne", "lignes"],
    piece: ["pièce", "pièces"],
    order: ["commande", "commandes"],
    customer: ["client", "clients"],
    sale: ["vente", "ventes"],
  },
  ar: {
    product: ["منتجات", "منتج واحد", "منتجان", "منتجات", "منتجاً", "منتج"],
    variant: ["خيارات", "خيار واحد", "خياران", "خيارات", "خياراً", "خيار"],
    row: ["صفوف", "صف واحد", "صفان", "صفوف", "صفاً", "صف"],
    piece: ["قطع", "قطعة واحدة", "قطعتان", "قطع", "قطعة", "قطعة"],
    order: ["طلبات", "طلب واحد", "طلبان", "طلبات", "طلباً", "طلب"],
    customer: ["عملاء", "عميل واحد", "عميلان", "عملاء", "عميلاً", "عميل"],
    sale: ["مبيعات", "بيعة واحدة", "بيعتان", "مبيعات", "بيعة", "بيعة"],
  },
} as const;

export function formatCount(locale: Locale, count: number, noun: Noun) {
  const category = new Intl.PluralRules(locale).select(count);
  const number = new Intl.NumberFormat(`${locale}-MA`).format(count);
  if (locale === "ar") {
    const index = (
      { zero: 0, one: 1, two: 2, few: 3, many: 4, other: 5 } as const
    )[category];
    const word = forms.ar[noun][index];
    return category === "one" || category === "two"
      ? word
      : `${number} ${word}`;
  }
  return `${number} ${forms[locale][noun][category === "one" ? 0 : 1]}`;
}

export function useCountWords() {
  const locale = usePreferences((state) => state.locale);
  return (count: number, noun: Noun) => formatCount(locale, count, noun);
}
