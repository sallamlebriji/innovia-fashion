export type Locale = "en" | "fr" | "ar";
export type Role = "OWNER" | "MANAGER" | "CASHIER" | "PLATFORM_ADMIN";
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  currency: string;
  locale: string;
  demo: boolean;
  accent: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  plan: { name: string; productLimit: number; storeLimit: number };
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string | null;
}
export interface Store {
  id: string;
  name: string;
  city: string;
  kind?: "STORE" | "WAREHOUSE";
}
export interface Variant {
  id: string;
  sku: string;
  size: string;
  color: string;
  price: string;
  cost: string;
  barcode?: string;
  inventory: {
    id: string;
    storeId: string;
    onHand: number;
    reserved: number;
    reorderPoint: number;
    store: Store;
  }[];
}
export interface Product {
  arLensId?: string;
  arGroupId?: string;
  id: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  collection: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  imageUrl: string;
  createdAt: string;
  variants: Variant[];
  season?: string;
  audience?: string;
  material?: string;
  fit?: string;
  care?: string;
  tryOnEnabled?: boolean;
  tryOnImageUrl?: string;
  sizeChart?: {
    size: string;
    chest?: number;
    waist?: number;
    length?: number;
    footLength?: number;
    equivalentSizes?: string;
  }[];
  media?: {
    id: string;
    url: string;
    alt: string;
    kind: "IMAGE" | "VIDEO";
    position: number;
  }[];
}
export interface Order {
  id: string;
  number: string;
  customerName: string;
  channel: string;
  status: string;
  paymentMethod: string;
  total: string;
  currency: string;
  refundedTotal?: string;
  discountTotal?: string;
  shippingTotal?: string;
  taxTotal?: string;
  taxRate?: string;
  refundShipping?: boolean;
  deliveryStatus?: string;
  carrier?: string;
  trackingNumber?: string;
  reservationExpiresAt?: string | null;
  shippingAddress?: {
    recipient: string;
    street: string;
    city: string;
    postalCode: string;
    phone: string;
    country: string;
  };
  returns?: {
    id: string;
    total: string;
    cashDifference: string;
    reason: string;
    createdAt: string;
  }[];
  createdAt: string;
  items: {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: string;
    returnedQuantity?: number;
    returnedAmount?: string;
    discountTotal?: string;
  }[];
  store: Store;
}
export interface Movement {
  id: string;
  type: string;
  quantity: number;
  reason: string;
  createdAt: string;
  variant: { sku: string; product: { name: string } };
  store: Store;
}
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  _count: { orders: number };
}
export interface Analytics {
  revenue: string;
  orders: number;
  averageOrder: string;
  productCount: number;
  stockUnits: number;
  lowStock: number;
  customerCount: number;
  daily: { date: string; revenue: number; orders: number }[];
  channels: { channel: string; revenue: number; orders: number }[];
  bestSellers: {
    name: string;
    imageUrl: string;
    quantity: number;
    revenue: number;
  }[];
  recentOrders: Order[];
}
export interface Session {
  user: User;
  tenant: Tenant | null;
  csrfToken: string;
  storefrontOrigin?: string;
}
