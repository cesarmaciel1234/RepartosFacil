"use client";

import React, { useEffect, useRef, useState } from "react";
import { MessageSquare, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { authHeaders } from "@/lib/clientAuth";
import type { CachedClientOrder } from "../pedidos/cachePedidosCliente";
import { filterClientOrders } from "../pedidos/cachePedidosCliente";
import { getOrCreateActiveClientIdentity } from "../../repartidor/motor/driverService";
import { OrderChatSheet } from "../../repartidor/ui/OrderChatSheet";

interface MensajesClienteSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  unread: Record<string, number>;
  unreadError: boolean;
}

const PAGE_SIZE = 50;

export function MensajesClienteSheet({ isOpen, onOpenChange, unread, unreadError }: MensajesClienteSheetProps) {
  const [orders, setOrders] = useState<CachedClientOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<CachedClientOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) setSelectedOrder(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnAuthChange = () => onOpenChange(false);
    const closeOnStorage = (event: StorageEvent) => {
      if (event.key === "repartofacil_client_token" || event.key === "repartofacil_client_user") {
        closeOnAuthChange();
      }
    };
    window.addEventListener("repartofacil-client-auth", closeOnAuthChange);
    window.addEventListener("storage", closeOnStorage);
    return () => {
      window.removeEventListener("repartofacil-client-auth", closeOnAuthChange);
      window.removeEventListener("storage", closeOnStorage);
    };
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const clientId = getOrCreateActiveClientIdentity().clientId;
    const headers = authHeaders("Client");
    setOrders([]);
    setHasMore(false);
    setError(null);
    if (!headers.Authorization) {
      setLoading(false);
      setError("Iniciá sesión como comprador para consultar tus conversaciones.");
      return () => controller.abort();
    }

    setLoading(true);
    fetch("/api/orders?view=client_conversations", { headers, cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar las conversaciones. Revisá tu sesión o conexión.");
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("La lista de conversaciones no es válida.");
        const filtered = filterClientOrders(data, clientId);
        if (filtered.length !== data.length) throw new Error("La lista de conversaciones no corresponde a tu cuenta.");
        if (getOrCreateActiveClientIdentity().clientId !== clientId) return;
        setOrders(filtered);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          console.warn("No se pudieron cargar las conversaciones:", cause);
          setError(cause instanceof Error ? cause.message : "No se pudieron cargar las conversaciones.");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [isOpen]);

  const loadMore = async () => {
    const last = orders[orders.length - 1];
    if (!last || loading) return;
    const clientId = getOrCreateActiveClientIdentity().clientId;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders?view=client_conversations&before=${encodeURIComponent(last.id)}`, {
        headers: authHeaders("Client"),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("No se pudieron cargar conversaciones anteriores.");
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error("La lista de conversaciones no es válida.");
      const filtered = filterClientOrders(data, clientId);
      if (filtered.length !== data.length) throw new Error("La lista de conversaciones no corresponde a tu cuenta.");
      if (getOrCreateActiveClientIdentity().clientId !== clientId) return;
      setOrders((current) => [...current, ...filtered.filter((order) => !current.some((item) => item.id === order.id))]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (cause) {
      console.warn("No se pudieron cargar conversaciones anteriores:", cause);
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar conversaciones anteriores.");
    } finally {
      setLoading(false);
    }
  };

  const returnToConversations = () => {
    setSelectedOrder(null);
    requestAnimationFrame(() => {
      if (selectedButton.current?.isConnected) selectedButton.current.focus();
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="fixed bottom-0 left-0 top-auto flex h-[min(72dvh,640px)] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-3xl rounded-b-none bg-white p-0 sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <DialogHeader className={selectedOrder ? "sr-only" : "border-b border-slate-100 px-5 py-4 pr-12 text-left"}>
          <DialogTitle className="text-sm font-black text-slate-900">Mensajes</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Una conversación por pedido, compartida con la empresa y el repartidor.
          </DialogDescription>
        </DialogHeader>
        <div hidden={!!selectedOrder} className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
          {error && <p role="alert" className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-950">{error}</p>}
          {unreadError && <p role="status" className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-950">No se pudo actualizar el contador de mensajes nuevos.</p>}
          {!loading && !error && orders.length === 0 && (
            <div className="py-12 text-center">
              <MessageSquare className="mx-auto mb-3 h-8 w-8 text-slate-400" />
              <p className="text-sm font-bold text-slate-800">Todavía no tenés conversaciones</p>
              <p className="mt-1 text-xs text-slate-500">Aparecerán cuando realices un pedido.</p>
            </div>
          )}
          {orders.length > 0 && (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {orders.map((order) => (
                <button key={order.id} type="button" onClick={(event) => {
                  selectedButton.current = event.currentTarget;
                  setSelectedOrder(order);
                }}
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-blue-50">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <MessageSquare className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">
                      {String(order.branch || order.sucursal_origen || order.companyName || "Comercio")}
                    </span>
                    <span className="block text-xs text-slate-500">
                      Pedido #{order.id} · {["delivered", "cancelled", "cancelled_by_client", "cancelled_timeout", "rejected"].includes(order.status.toLowerCase())
                        ? "Comprador y empresa"
                        : "Comprador, empresa y repartidor"}
                    </span>
                  </span>
                  {(unread[order.id] || 0) > 0 && (
                    <span aria-label={`${unread[order.id]} mensajes nuevos`} className="rounded-full bg-blue-600 px-2 py-1 text-xs font-bold text-white">
                      {unread[order.id] > 99 ? "99+" : unread[order.id]}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          )}
          {loading && <p role="status" className="py-4 text-center text-xs text-slate-500">Cargando conversaciones...</p>}
          {hasMore && !loading && (
            <Button type="button" variant="outline" onClick={loadMore} className="mt-3 w-full rounded-xl">
              Ver conversaciones anteriores
            </Button>
          )}
        </div>
        {isOpen && selectedOrder && (
          <OrderChatSheet
            isOpen
            embedded
            onOpenChange={onOpenChange}
            activeOrder={{ id: selectedOrder.id, status: selectedOrder.status }}
            viewerRole="client"
            conversationTitle={String(selectedOrder.branch || selectedOrder.sucursal_origen || selectedOrder.companyName || "Comercio")}
            onBackToOrdersHub={returnToConversations}
            backButtonLabel="Volver a mensajes"
            reserveCloseButton
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
