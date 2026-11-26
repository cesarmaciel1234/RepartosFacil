"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { DriverOrder, DriverWallet } from "./tipos";
import {
  loadLocalOrders,
  saveLocalOrders,
  loadDriverProfile,
} from "./driverService";
import { loadDriverWallet } from "./walletService";
import {
  loadPendingDriverActions,
  queueDriverAction,
  syncPendingDriverActions,
  type PendingDriverAction,
} from "./driverPendingActions";
import { useToast } from "@/hooks/use-toast";
import { authHeaders } from "@/lib/clientAuth";

export function useDriverOrders(currentDriverId?: string | null) {
  const { toast } = useToast();

  const [localOrders, setLocalOrders] = useState<DriverOrder[]>([]);
  const [pendingAcceptOrder, setPendingAcceptOrder] = useState<DriverOrder | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [wallet, setWallet] = useState<DriverWallet>(loadDriverWallet());
  const [pendingActions, setPendingActions] = useState<PendingDriverAction[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncing = useRef(false);

  // Cargar órdenes y wallet locales iniciales y sincronizar con base de datos PostgreSQL
  useEffect(() => {
    // 1. Cargar local primero
    const initial = loadLocalOrders();
    setLocalOrders(initial);
    setWallet(loadDriverWallet());

    // 2. Traer órdenes reales desde PostgreSQL crm-libro-local
    const fetchCloudOrders = async () => {
      try {
        const headers = authHeaders("Driver");
        if (!headers.Authorization) return;
        const res = await fetch("/api/orders", { cache: "no-store", headers });
        if (res.ok) {
          const cloudOrders: DriverOrder[] = await res.json();
          if (Array.isArray(cloudOrders)) {
            saveLocalOrders(cloudOrders);
            setLocalOrders(cloudOrders);
          }
        }
      } catch (err) {
        // Usar datos locales si no hay conexión
      }
    };

    fetchCloudOrders();
    const pollInterval = setInterval(fetchCloudOrders, 6000);

    const handleOrdersUpdated = () => {
      setLocalOrders(loadLocalOrders());
    };
    const handleWalletUpdated = (e: any) => {
      if (e.detail) setWallet(e.detail);
      else setWallet(loadDriverWallet());
    };
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "rf_orders_history" || !e.key) {
        setLocalOrders(loadLocalOrders());
        fetchCloudOrders();
      }
      if (e.key === "rf_driver_wallet" || !e.key) {
        setWallet(loadDriverWallet());
      }
    };

    window.addEventListener("rf-orders-updated", handleOrdersUpdated);
    window.addEventListener("rf-wallet-updated", handleWalletUpdated);
    window.addEventListener("storage", handleStorageEvent);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("rf-orders-updated", handleOrdersUpdated);
      window.removeEventListener("rf-wallet-updated", handleWalletUpdated);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, []);

  // Pedidos Disponibles en el radar del repartidor:
  // Solo pedidos confirmados, listos o embalados por el comercio aparecen en Disponibles.
  // Los pedidos 'pending_store' (esperando al comercio) o 'rejected'/'cancelled' NO salen al chofer.
  const availableOrders = useMemo(() => {
    return localOrders.filter(
      (o) =>
        Boolean(currentDriverId) &&
        ["confirmed", "ready", "accepted", "embalado"].includes(
          String(o.status).trim().toLowerCase()
        ) &&
        !o.driverId
    );
  }, [localOrders, currentDriverId]);

  // Mis pedidos activos en ruta: SOLO aquellos asignados EXCLUSIVAMENTE a este repartidor
  // IMPORTANTE: Pedidos 'Delivered' (entregados) o 'Cancelled' se archivan de la ruta y del chat del repartidor.
  const myActiveOrders = useMemo(() => {
    return localOrders.filter(
      (o) =>
        ["assigned", "picked up", "in transit", "ready", "embalado"].includes(
          String(o.status).trim().toLowerCase()
        ) &&
        o.driverId &&
        o.driverId === currentDriverId
    );
  }, [localOrders, currentDriverId]);

  const syncPending = useCallback(async () => {
    if (!currentDriverId || syncing.current) return;
    syncing.current = true;
    try {
      const pending = loadPendingDriverActions(currentDriverId);
      setPendingActions(pending);
      if (pending.length === 0) {
        setSyncError(null);
        return;
      }
      if (!navigator.onLine) return;
      const results = await syncPendingDriverActions(currentDriverId);
      if (loadDriverProfile()?.id !== currentDriverId) return;
      setPendingActions(loadPendingDriverActions(currentDriverId));
      setSyncError(null);
      setLocalOrders(loadLocalOrders());
      setWallet(loadDriverWallet());
      for (const result of results) {
        toast(result.status === "confirmed"
          ? {
              title:
                result.action.type === "assign"
                  ? "Pedido asignado"
                  : result.action.type === "pickup"
                  ? "Retiro confirmado"
                  : "Entrega confirmada",
              description: `El servidor confirmó el pedido #${result.action.order.id}.`,
            }
          : {
              variant: "destructive",
              title: `No se pudo confirmar #${result.action.order.id}`,
              description: result.message,
            });
      }
    } catch (error) {
      console.error("Error sincronizando acciones pendientes:", error);
      setSyncError(error instanceof Error ? error.message : "No se pudieron sincronizar las acciones pendientes.");
    } finally {
      syncing.current = false;
    }
  }, [currentDriverId, toast]);

  useEffect(() => {
    if (!currentDriverId) {
      setPendingActions([]);
      setSyncError(null);
      return;
    }
    void syncPending();
    const timer = window.setInterval(() => void syncPending(), 10000);
    const handleOnline = () => void syncPending();
    const handleStorage = () => {
      try {
        setPendingActions(loadPendingDriverActions(currentDriverId));
      } catch (error) {
        console.error("Error leyendo acciones pendientes:", error);
        setSyncError("No se pudieron leer las acciones pendientes.");
      }
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("storage", handleStorage);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("storage", handleStorage);
    };
  }, [currentDriverId, syncPending]);

  const queueAction = useCallback((type: "assign" | "pickup" | "deliver", order: DriverOrder, driverId: string) => {
    try {
      const profile = loadDriverProfile();
      if (!profile || profile.id !== driverId) {
        throw new Error("Volvé a iniciar sesión como repartidor antes de continuar.");
      }
      queueDriverAction(type, order, profile);
      setPendingActions(loadPendingDriverActions(driverId));
      toast({
        title: "Pendiente de confirmación",
        description:
          type === "assign"
            ? "El pedido no está asignado hasta que el servidor lo confirme."
            : type === "pickup"
            ? "El retiro del negocio se confirmará al sincronizar."
            : "La entrega y la ganancia se confirmarán al sincronizar.",
      });
      void syncPending();
    } catch (error) {
      console.error("Error guardando acción pendiente:", error);
      toast({
        variant: "destructive",
        title: "No se pudo guardar la acción",
        description: error instanceof Error ? error.message : "Intentá nuevamente.",
      });
    }
  }, [syncPending, toast]);

  const handleTakeOrder = useCallback((order: DriverOrder, driverId?: string | null) => {
    const activeDriverId = driverId || currentDriverId;
    if (!activeDriverId) {
      setPendingAcceptOrder(order);
      setShowLoginModal(true);
      return;
    }
    // Límite estricto de 1 pedido activo a la vez
    if (myActiveOrders.length > 0) {
      toast({
        variant: "destructive",
        title: "Límite de 1 pedido activo",
        description: "Completá tu entrega actual para tomar otro pedido.",
      });
      return;
    }
    queueAction("assign", order, activeDriverId);
  }, [currentDriverId, myActiveOrders, queueAction, toast]);

  const confirmOrderAfterLogin = useCallback((driverId: string) => {
    setShowLoginModal(false);
    if (pendingAcceptOrder) {
      queueAction("assign", pendingAcceptOrder, driverId);
      setPendingAcceptOrder(null);
    }
  }, [pendingAcceptOrder, queueAction]);

  const handlePickupOrder = useCallback((orderId: string) => {
    const order = myActiveOrders.find((item) => item.id === orderId);
    if (!order || !currentDriverId) {
      toast({ variant: "destructive", title: "Pedido no disponible", description: "Revisá tu ruta antes de confirmar el retiro." });
      return;
    }
    queueAction("pickup", order, currentDriverId);
  }, [currentDriverId, myActiveOrders, queueAction, toast]);

  const handleCompleteDelivery = useCallback((orderId: string) => {
    const order = myActiveOrders.find((item) => item.id === orderId);
    if (!order || !currentDriverId) {
      toast({ variant: "destructive", title: "Pedido no disponible", description: "Revisá tu ruta antes de confirmar la entrega." });
      return;
    }
    queueAction("deliver", order, currentDriverId);
  }, [currentDriverId, myActiveOrders, queueAction, toast]);

  return {
    availableOrders,
    myActiveOrders,
    handleTakeOrder,
    handlePickupOrder,
    handleCompleteDelivery,
    pendingAcceptOrder,
    showLoginModal,
    setShowLoginModal,
    confirmOrderAfterLogin,
    wallet,
    pendingActions,
    syncError,
    syncPending,
  };
}
