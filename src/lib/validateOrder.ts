import { calcularTarifaEnvio } from "@/modulos/tienda/motor/tarifaUberService";

type CatalogProduct = {
  id: string;
  name: string;
  unit: string;
  companyId: string;
  price?: number;
  stockKg?: number;
};

type CatalogCompany = {
  id: string;
  empresa_id: number;
  slug: string;
  name: string;
  deliveryFee: number;
  freeDeliveryThreshold?: number;
};

type SubmittedItem = { id?: unknown; quantity?: unknown; price?: unknown };
type SubmittedOrder = {
  companyId?: unknown;
  items?: unknown;
  deliveryType?: unknown;
  deliveryAddress?: unknown;
  subtotal?: unknown;
  deliveryFee?: unknown;
  total?: unknown;
};

export function validateOrder(
  order: SubmittedOrder,
  products: CatalogProduct[],
  companies: CatalogCompany[]
) {
  const company = companies.find((entry) => entry.id === order.companyId);
  if (!company || !Number.isInteger(Number(company.empresa_id)) || Number(company.empresa_id) <= 0) {
    throw new Error("El comercio ya no está disponible. Actualizá el catálogo.");
  }
  if (!Array.isArray(order.items) || order.items.length === 0 || order.items.length > 100) {
    throw new Error("El carrito no es válido.");
  }
  if ((order.deliveryType !== "delivery" && order.deliveryType !== "pickup") ||
      typeof order.deliveryAddress !== "string" || !order.deliveryAddress.trim()) {
    throw new Error("La dirección o modalidad de entrega no es válida.");
  }

  const seen = new Set<string>();
  const items = (order.items as SubmittedItem[]).map((submitted) => {
    if (!submitted || typeof submitted.id !== "string" || seen.has(submitted.id) ||
        typeof submitted.quantity !== "number" || !Number.isFinite(submitted.quantity) || submitted.quantity <= 0) {
      throw new Error("Los productos o cantidades del carrito no son válidos.");
    }
    seen.add(submitted.id);
    const product = products.find((entry) => entry.id === submitted.id && entry.companyId === company.id);
    if (!product || typeof product.price !== "number" || !Number.isFinite(product.price) || product.price <= 0 ||
        typeof product.stockKg !== "number" || !Number.isFinite(product.stockKg) ||
        product.stockKg < 1 || submitted.quantity > product.stockKg) {
      throw new Error("Un producto ya no tiene precio o stock disponible. Actualizá el carrito.");
    }
    if (submitted.price !== product.price) {
      throw new Error("Cambió el precio de un producto. Actualizá el carrito antes de confirmar.");
    }
    return { id: product.id, name: product.name, unit: product.unit, price: product.price, quantity: submitted.quantity };
  });
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const threshold = company.freeDeliveryThreshold || 35000;
  if (!Number.isFinite(subtotal) || !Number.isFinite(threshold) || threshold <= 0 ||
      !Number.isFinite(company.deliveryFee) || company.deliveryFee < 0) {
    throw new Error("No se pudo validar el importe del pedido.");
  }
  const tarifa = calcularTarifaEnvio(order.deliveryAddress);
  const deliveryFee = order.deliveryType === "delivery" && subtotal < threshold ? company.deliveryFee : 0;
  const total = subtotal + deliveryFee;
  const matches = (value: unknown, expected: number) =>
    typeof value === "number" && Number.isFinite(value) && Math.abs(value - expected) < 0.001;
  if (!matches(order.subtotal, subtotal) || !matches(order.deliveryFee, deliveryFee) || !matches(order.total, total)) {
    throw new Error("El importe del pedido cambió. Actualizá el carrito antes de confirmar.");
  }
  return { company, items, subtotal, deliveryFee, total, tarifa };
}
