import type { Product } from "@/data/mockProducts";

export type PurchasableProduct = Product & {
  price: number;
  stockKg: number;
  priceSource: "tpv";
};

export function hasValidPrice(
  product: Product
): product is Product & { price: number } {
  return (
    typeof product.price === "number" &&
    Number.isFinite(product.price) &&
    product.price > 0
  );
}

export function hasValidStock(
  product: Product
): product is Product & { stockKg: number } {
  return (
    typeof product.stockKg === "number" &&
    Number.isFinite(product.stockKg)
  );
}

export function isProductPurchasable(
  product: Product
): product is PurchasableProduct {
  return (
    product.priceSource === "tpv" &&
    hasValidPrice(product) &&
    hasValidStock(product) &&
    product.stockKg >= 1
  );
}

export function productAvailabilityMessage(product: Product) {
  if (product.priceSource !== "tpv" || !hasValidPrice(product)) {
    return "Precio pendiente";
  }
  if (!hasValidStock(product)) return "Stock pendiente";
  if (product.stockKg < 0) return "Stock a revisar";
  if (product.stockKg === 0) return "Agotado";
  if (product.stockKg < 1) return "Stock insuficiente";
  return "";
}
