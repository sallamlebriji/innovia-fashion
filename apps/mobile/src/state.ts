import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocale } from "./locale";
export type Variant = {
  id: string;
  size: string;
  color: string;
  price: string;
  availability: { storeId: string; available: number }[];
};
export type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  brand: string;
  imageUrl: string;
  material: string;
  fit: string;
  care: string;
  tryOnEnabled?: boolean;
  sizeChart:
    | {
        size: string;
        chest?: number;
        waist?: number;
        length?: number;
        footLength?: number;
        equivalentSizes?: string;
      }[]
    | null;
  media: { url: string; kind: string; alt: string }[];
  variants: Variant[];
};
export type Boutique = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    currency: string;
    heroImage: string;
    heroSubtitle: string;
    demo: boolean;
  };
  stores: { id: string; name: string; city: string }[];
  zones: { id: string; name: string; cities: string[]; fee: string }[];
  settings: {
    returnPolicy: string;
    deliveryPolicy: string;
    reservationMinutes: number;
  };
};
export type Line = { product: Product; variant: Variant; quantity: number };
type BagState = {
  bags: Record<string, Line[]>;
  add: (slug: string, product: Product, variant: Variant) => void;
  change: (slug: string, id: string, delta: number) => void;
  clear: (slug: string) => void;
};
export const useBag = create<BagState>()(
  persist(
    (set) => ({
      bags: {},
      add: (slug, product, variant) =>
        set((state) => {
          const lines = state.bags[slug] ?? [],
            old = lines.find((line) => line.variant.id === variant.id);
          return {
            bags: {
              ...state.bags,
              [slug]: old
                ? lines.map((line) =>
                    line === old
                      ? { ...line, quantity: Math.min(100, line.quantity + 1) }
                      : line,
                  )
                : [...lines, { product, variant, quantity: 1 }],
            },
          };
        }),
      change: (slug, id, delta) =>
        set((state) => ({
          bags: {
            ...state.bags,
            [slug]: (state.bags[slug] ?? [])
              .map((line) =>
                line.variant.id === id
                  ? { ...line, quantity: Math.min(100, line.quantity + delta) }
                  : line,
              )
              .filter((line) => line.quantity > 0),
          },
        })),
      clear: (slug) =>
        set((state) => ({ bags: { ...state.bags, [slug]: [] } })),
    }),
    {
      name: "innovia.native.bags",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ bags: state.bags }),
    },
  ),
);
export const money = (value: string | number, currency = "MAD") =>
  new Intl.NumberFormat(`${useLocale.getState().locale}-MA`, {
    style: "currency",
    currency,
  }).format(Number(value));
