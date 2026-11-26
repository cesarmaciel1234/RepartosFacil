import type { Product } from "@/data/mockProducts";

export interface DeliveryCoordinates {
  address: string;
  lat: number;
  lng: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CheckoutFormData {
  customerName: string;
  customerPhone: string;
  deliveryType: "delivery" | "pickup";
  deliveryAddress: string;
  deliveryStreet?: string;
  deliveryNumber?: string;
  deliveryFloor?: string;
  deliveryCoordinates?: { lat: number; lng: number } | null;
  selectedBranch: string;
  paymentMethod: "efectivo" | "transferencia" | "tarjeta";
  orderNotes: string;
  deliveryFeeOverride?: number;
  freeDeliveryThreshold?: number;
  companyId?: string;
  companySlug?: string;
  empresaId?: number;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  unit: string;
  quantity: number;
}

export type OrderPaymentMethod = "cash" | "transfer" | "card" | "web";

export interface OrderData {
  id: string;
  customerName: string;
  customerPhone: string;
  deliveryType: "delivery" | "pickup";
  deliveryAddress: string;
  deliveryCoordinates?: { lat: number; lng: number } | null;
  destinationCoords?: { lat: number; lng: number } | null;
  paymentMethod: OrderPaymentMethod;
  notes?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: "Pending" | "Assigned" | "Picked Up" | "In Transit" | "Delivered" | "Cancelled";
  createdAt: string;
  updatedAt: string;
  source: string;
  driverId?: string;
  driverUserId?: string;
  clientId?: string;
  clientUserId?: string;
  empresaId?: number;
  empresaSlug?: string;
}
