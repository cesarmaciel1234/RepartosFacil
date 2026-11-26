"use client";

import { useEffect, useMemo, useState } from "react";
import { getOrCreateActiveClientIdentity } from "../../../repartidor/motor/driverService";
import type { OrderData } from "../../motor/tipos";
import { authHeaders } from "@/lib/clientAuth";
import {
  filterClientOrders,
  readClientOrdersCache,
  saveClientOrdersCache,
  type CachedClientOrder,
} from "../cachePedidosCliente";

interface UsePedidosClienteParams {
  selectedChatOrder: any;
  setSelectedChatOrder: (order: any) => void;
  orderConfirmed: OrderData | null;
}

export function usePedidosCliente({
  selectedChatOrder,
  setSelectedChatOrder,
  orderConfirmed,
}: UsePedidosClienteParams) {
  const [clientOrdersList, setClientOrdersList] = useState<any[]>([]);
  const [ordersCached, setOrdersCached] = useState(true);
  const [ordersSavedAt, setOrdersSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let activeClientId = "";
    let loading = false;
    let refreshQueued = false;
    const controller = new AbortController();

    const syncOrders = async () => {
      const { clientId } = getOrCreateActiveClientIdentity();
      let localOrders: CachedClientOrder[] = [];
      try {
        const raw = localStorage.getItem("rf_orders_history");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            localOrders = filterClientOrders(parsed, clientId);
          }
        }
      } catch (error) {
        console.warn("No se pudo leer el historial local de pedidos:", error);
      }

      const mergeOrders = (cloudOrders: CachedClientOrder[]) => {
        const orderMap = new Map(cloudOrders.map((order) => [order.id, order]));
        localOrders.forEach((order) => {
          if (!orderMap.has(order.id)) orderMap.set(order.id, order);
        });
        return Array.from(orderMap.values());
      };
      const publishOrders = (orders: CachedClientOrder[]) => {
        setClientOrdersList(orders);
        if (orders.length === 0) {
          setSelectedChatOrder(null);
        } else if (!selectedChatOrder || !orders.some((order) => order.id === selectedChatOrder.id)) {
          setSelectedChatOrder(orders[0]);
        }
      };

      if (clientId !== activeClientId) {
        activeClientId = clientId;
        const cache = readClientOrdersCache(clientId);
        publishOrders(mergeOrders(cache?.orders || []));
        setOrdersSavedAt(cache?.savedAt || null);
        setOrdersCached(true);
      }

      if (loading) {
        refreshQueued = true;
        return;
      }
      loading = true;
      try {
        const url = `/api/orders?cliente_id=${encodeURIComponent(clientId)}`;
        const headers = authHeaders("Client");
        if (!headers.Authorization) return;
        const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers });
        if (!response.ok) throw new Error(`El servidor respondió ${response.status}`);
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("El historial recibido no es válido.");
        const cloudOrders = filterClientOrders(data, clientId);
        if (cloudOrders.length !== data.length) {
          throw new Error("El historial recibido contiene pedidos de otro comprador o datos inválidos.");
        }
        if (cancelled || getOrCreateActiveClientIdentity().clientId !== clientId) return;
        if (!navigator.onLine) throw new Error("No hay conexión para actualizar los pedidos.");
        publishOrders(mergeOrders(cloudOrders));
        setOrdersCached(false);
        try {
          setOrdersSavedAt(saveClientOrdersCache(clientId, cloudOrders));
        } catch (error) {
          console.warn("No se pudo guardar el historial para uso sin conexión:", error);
          setOrdersSavedAt(null);
        }
      } catch (error) {
        if (!cancelled && getOrCreateActiveClientIdentity().clientId === clientId) {
          console.warn("No se pudo actualizar el historial de pedidos:", error);
          setClientOrdersList((current) => mergeOrders(filterClientOrders(current, clientId)));
          setOrdersCached(true);
        }
      } finally {
        loading = false;
        if (!cancelled && refreshQueued) {
          refreshQueued = false;
          void syncOrders();
        }
      }
    };

    void syncOrders();
    const interval = window.setInterval(() => {
      if (navigator.onLine) void syncOrders();
    }, 4000);
    const handleOnline = () => void syncOrders();
    const handleOffline = () => setOrdersCached(true);
    const handleVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        setOrdersCached(true);
        void syncOrders();
      }
    };
    window.addEventListener("rf-orders-updated", syncOrders);
    window.addEventListener("repartofacil-client-auth", syncOrders);
    window.addEventListener("repartofacil-auth", syncOrders);
    window.addEventListener("storage", syncOrders);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("rf-orders-updated", syncOrders);
      window.removeEventListener("repartofacil-client-auth", syncOrders);
      window.removeEventListener("repartofacil-auth", syncOrders);
      window.removeEventListener("storage", syncOrders);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [selectedChatOrder, orderConfirmed, setSelectedChatOrder]);

  const activeOrdersCount = useMemo(
    () =>
      clientOrdersList.filter(
        (order) =>
          ![
            "delivered",
            "cancelled",
            "cancelled_by_client",
            "cancelled_timeout",
            "rejected",
          ].includes(String(order.status).toLowerCase())
      ).length,
    [clientOrdersList]
  );

  return { clientOrdersList, activeOrdersCount, ordersCached, ordersSavedAt };
}
