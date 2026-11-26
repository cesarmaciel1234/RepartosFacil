export type CachedClientOrder = {
  id: string;
  clientId: string;
  status: string;
  [key: string]: unknown;
};

const PREFIX = "rf_client_orders_v1:";

function isClientOrder(value: unknown, clientId: string): value is CachedClientOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as Record<string, unknown>;
  return typeof order.id === "string" && order.clientId === clientId &&
    typeof order.status === "string";
}

export function readClientOrdersCache(clientId: string) {
  try {
    const raw = localStorage.getItem(PREFIX + encodeURIComponent(clientId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") throw new Error("Historial inválido.");
    const cache = value as Record<string, unknown>;
    if (typeof cache.savedAt !== "string" || !Number.isFinite(Date.parse(cache.savedAt)) ||
      !Array.isArray(cache.orders) || !cache.orders.every((order): order is CachedClientOrder => isClientOrder(order, clientId))) {
      throw new Error("No se pudo validar el historial guardado.");
    }
    return { savedAt: cache.savedAt, orders: cache.orders };
  } catch (error) {
    console.warn("No se pudo leer el historial guardado del comprador:", error);
    return null;
  }
}

export function saveClientOrdersCache(clientId: string, orders: unknown[]): string {
  if (!orders.every((order) => isClientOrder(order, clientId))) {
    throw new Error("El servidor devolvió pedidos que no corresponden al comprador.");
  }
  const savedAt = new Date().toISOString();
  localStorage.setItem(PREFIX + encodeURIComponent(clientId), JSON.stringify({ savedAt, orders }));
  return savedAt;
}

export function filterClientOrders(orders: unknown[], clientId: string): CachedClientOrder[] {
  return orders.filter((order): order is CachedClientOrder => isClientOrder(order, clientId));
}
