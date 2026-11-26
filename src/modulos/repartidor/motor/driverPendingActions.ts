import type { DriverOrder, DriverProfile } from "./tipos";
import { loadDriverProfile, ORDERS_STORAGE_KEY } from "./driverService";
import { creditDeliveryEarning } from "./walletService";
import { authHeaders } from "@/lib/clientAuth";

type PendingActionType = "assign" | "pickup" | "deliver";

export interface PendingDriverAction {
  type: PendingActionType;
  driverId: string;
  driverUserId: string;
  driverName: string;
  order: DriverOrder;
}

export interface DriverActionResult {
  action: PendingDriverAction;
  status: "confirmed" | "rejected";
  message?: string;
}

const PREFIX = "rf_driver_pending:";

function actionKey(driverId: string, orderId: string) {
  return `${PREFIX}${encodeURIComponent(driverId)}:${encodeURIComponent(orderId)}`;
}

export function loadPendingDriverActions(driverId: string): PendingDriverAction[] {
  const prefix = `${PREFIX}${encodeURIComponent(driverId)}:`;
  const actions: PendingDriverAction[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const action: PendingDriverAction = JSON.parse(raw);
      if (
        action.driverId !== driverId ||
        !action.order?.id ||
        (action.type !== "assign" && action.type !== "deliver" && action.type !== "pickup") ||
        key !== actionKey(driverId, action.order.id)
      ) {
        localStorage.removeItem(key);
        continue;
      }
      actions.push(action);
    } catch {
      localStorage.removeItem(key);
    }
  }
  return actions;
}

export function queueDriverAction(
  type: PendingActionType,
  order: DriverOrder,
  driver: DriverProfile
): void {
  const key = actionKey(driver.id, order.id);
  const action: PendingDriverAction = {
    type,
    driverId: driver.id,
    driverUserId: driver.userId || driver.uid,
    driverName: driver.firstName,
    order,
  };
  localStorage.setItem(key, JSON.stringify(action));
}

function storeServerOrder(order: DriverOrder) {
  const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
  const orders: DriverOrder[] = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(orders)) {
    throw new Error("No se pudo validar el historial local de pedidos.");
  }
  const index = orders.findIndex((item) => item.id === order.id);
  if (index >= 0) orders[index] = order;
  else orders.unshift(order);
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event("rf-orders-updated"));
}

function isOrder(value: unknown, orderId: string): value is DriverOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as Partial<DriverOrder>;
  return order.id === orderId && typeof order.status === "string" &&
    typeof order.clientName === "string" && typeof order.deliveryAddress === "string" &&
    Array.isArray(order.items) && typeof order.createdAt === "string" &&
    typeof order.total === "number" && Number.isFinite(order.total);
}

export async function syncPendingDriverActions(driverId: string): Promise<DriverActionResult[]> {
  if (!navigator.locks) {
    throw new Error("Este navegador no permite sincronizar acciones pendientes de forma segura.");
  }
  return navigator.locks.request(`rf-driver-sync:${driverId}`, { ifAvailable: true }, async (lock) => {
    if (!lock) return [];
    const results: DriverActionResult[] = [];
    for (const action of loadPendingDriverActions(driverId)) {
      if (loadDriverProfile()?.id !== driverId) break;
      let response: Response;
      try {
        response = await fetch("/api/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders("Driver") },
          body: JSON.stringify({
            id: action.order.id,
            status: action.type === "assign" ? "Assigned" : action.type === "pickup" ? "Picked Up" : "Delivered",
            driverProtocol: 2,
            driverId: action.driverId,
            driverUserId: action.driverUserId,
            driverName: action.driverName,
          }),
        });
      } catch {
        break;
      }

      if (loadDriverProfile()?.id !== driverId) break;
      if (response.status >= 500 || [408, 425, 429].includes(response.status)) break;
      if (response.status === 401 || response.status === 403) {
        throw new Error("La sesión no permite sincronizar. Volvé a iniciar sesión.");
      }
      const data: unknown = await response.json();
      if (!response.ok) {
        const error = data && typeof data === "object" ? data as { error?: unknown; order?: unknown } : {};
        if (isOrder(error.order, action.order.id)) storeServerOrder(error.order);
        localStorage.removeItem(actionKey(driverId, action.order.id));
        results.push({
          action,
          status: "rejected",
          message: typeof error.error === "string" ? error.error : `Error HTTP ${response.status}`,
        });
        continue;
      }

      if (!isOrder(data, action.order.id) || data.driverId !== driverId) {
        throw new Error("La respuesta del servidor no confirmó el pedido esperado.");
      }
      if (action.type === "deliver") {
        if (String(data.status).trim().toLowerCase() !== "delivered") {
          throw new Error("El servidor todavía no confirmó la entrega.");
        }
        const settlement = (data as DriverOrder & { driverSettlement?: { earning?: unknown; cashCollected?: unknown } }).driverSettlement;
        const earning = settlement?.earning;
        if (typeof earning !== "number" || !Number.isFinite(earning) || earning < 0) {
          throw new Error("La entrega no tiene una ganancia válida para acreditar.");
        }
        const cash = settlement?.cashCollected;
        if (typeof cash !== "number" || !Number.isFinite(cash) || cash < 0) {
          throw new Error("La entrega no tiene un importe de efectivo válido.");
        }
        creditDeliveryEarning(data.id, earning, cash);
      }
      storeServerOrder(data);
      localStorage.removeItem(actionKey(driverId, action.order.id));
      results.push({ action, status: "confirmed" });
    }
    return results;
  });
}
