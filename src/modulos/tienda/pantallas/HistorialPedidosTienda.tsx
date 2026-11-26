"use client";

import React, { useCallback, useMemo, useState } from "react";
import { CheckCircle2, Clock3, MessageSquare, Package, ReceiptText, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalTicketDigital } from "@/components/ModalTicketDigital";
import { ResenaPedidoDialog } from "../ui/ResenaPedidoDialog";

type FiltroHistorial = "all" | "delivered" | "cancelled";

interface HistorialPedidosTiendaProps {
  orders: any[];
  onGoToHome: () => void;
  onSelectOrderChat: (order: any) => void;
  onSelectActiveOrder: (order: any) => void;
}

const deliveredStatuses = new Set(["delivered"]);
const cancelledStatuses = new Set([
  "cancelled",
  "cancelled_by_client",
  "cancelled_timeout",
  "rejected",
]);
export function HistorialPedidosTienda({
  orders,
  onGoToHome,
  onSelectOrderChat,
  onSelectActiveOrder,
}: HistorialPedidosTiendaProps) {
  const [filter, setFilter] = useState<FiltroHistorial>("all");
  const [ticketOrder, setTicketOrder] = useState<any | null>(null);
  const [reviewOrder, setReviewOrder] = useState<{ id: string } | null>(null);
  const closeReview = useCallback(() => setReviewOrder(null), []);

  const historyOrders = useMemo(
    () =>
      orders.filter((order) => {
        const status = String(order.status || "").toLowerCase();
        return deliveredStatuses.has(status) || cancelledStatuses.has(status);
      }),
    [orders]
  );
  const activeOrders = orders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    return !deliveredStatuses.has(status) && !cancelledStatuses.has(status);
  });
  const deliveredCount = historyOrders.filter((order) =>
    deliveredStatuses.has(String(order.status || "").toLowerCase())
  ).length;
  const cancelledCount = historyOrders.length - deliveredCount;
  const visibleOrders = historyOrders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    if (filter === "delivered") return deliveredStatuses.has(status);
    if (filter === "cancelled") return cancelledStatuses.has(status);
    return true;
  });

  const formatMoney = (value: number) => "$" + (value || 0).toLocaleString("es-AR");
  const formatDate = (value?: string) => {
    if (!value) return "Fecha no disponible";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Fecha no disponible"
      : date.toLocaleDateString("es-AR", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-5">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Tu actividad</p>
        <h1 className="text-2xl font-black text-slate-900">Mis pedidos</h1>
        <p className="text-sm text-slate-500">Seguí tus pedidos y consultá tus compras anteriores.</p>
      </header>

      <section className="space-y-3" aria-label="Pedidos en curso">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-black text-slate-900">Pedidos en curso ({activeOrders.length})</h2>
        </div>
        {activeOrders.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No tenés pedidos en curso. Cuando hagas un pedido, vas a poder seguirlo acá.
          </p>
        ) : (
          activeOrders.map((order) => {
            const status = String(order.status || "").trim().toLowerCase();
            const isPickup = String(order.deliveryType || order.tipo_entrega || "").toLowerCase() === "pickup";
            const label = isPickup
              ? ["ready", "embalado"].includes(status)
                ? "Listo para retirar"
                : ["confirmed", "accepted"].includes(status)
                  ? "Preparando en mostrador"
                  : "Esperando al comercio"
              : ["assigned", "picked up", "in transit"].includes(status)
                ? "En camino"
                : ["ready", "embalado"].includes(status)
                  ? "Listo para retirar"
                  : ["confirmed", "accepted"].includes(status)
                    ? "Aceptado por el comercio"
                    : "Esperando al comercio";
            return (
              <button key={order.id} type="button" onClick={() => onSelectActiveOrder(order)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-left hover:bg-blue-100">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-900">
                    {order.branch || order.sucursal_origen || order.companyName || "Comercio"}
                  </span>
                  <span className="block text-xs text-slate-600">Pedido #{order.id} · {label}</span>
                </span>
                <span className="shrink-0 text-xs font-bold text-blue-700">Ver detalle ›</span>
              </button>
            );
          })
        )}
      </section>

      <h2 className="text-base font-black text-slate-900">Historial</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <CheckCircle2 className="mb-2 h-5 w-5 text-blue-600" />
          <p className="text-2xl font-black text-slate-900">{deliveredCount}</p>
          <p className="text-xs font-semibold text-slate-600">Entregados</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <Clock3 className="mb-2 h-5 w-5 text-slate-500" />
          <p className="text-2xl font-black text-slate-900">{cancelledCount}</p>
          <p className="text-xs font-semibold text-slate-600">Cancelados o rechazados</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {([
          ["all", "Todos"],
          ["delivered", "Entregados"],
          ["cancelled", "Cancelados"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              filter === id
                ? "bg-blue-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {visibleOrders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <h2 className="font-bold text-slate-800">
            {historyOrders.length === 0
              ? "Todavía no tenés pedidos en el historial"
              : "No hay pedidos en esta categoría"}
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Cuando completes una compra, vas a poder consultar acá su estado y comprobante.
          </p>
          <Button
            type="button"
            onClick={onGoToHome}
            className="mt-4 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
          >
            Explorar comercios
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleOrders.map((order) => {
            const status = String(order.status || "").toLowerCase();
            const isDelivered = deliveredStatuses.has(status);
            const storeName =
              order.branch || order.sucursal_origen || order.companyName || "Comercio";
            const ticketId = order.ticketId || order.ticket_id;

            return (
              <article
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      isDelivered ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isDelivered ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <ReceiptText className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="truncate font-bold text-slate-900">{storeName}</h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          isDelivered
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isDelivered ? "Entregado" : "Cancelado"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Pedido #{order.id} · {formatDate(order.createdAt || order.created_at)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                      {String(order.deliveryType || order.tipo_entrega || "").toLowerCase() === "pickup" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                          🏪 Retiro en Tienda
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                          🛵 Con Delivery
                        </span>
                      )}
                      {String(order.deliveryType || order.tipo_entrega || "").toLowerCase() === "pickup" ? (
                        <span className="truncate text-slate-500 text-xs">
                          {order.branch || order.sucursal_origen || "Retiro en mostrador"}
                        </span>
                      ) : order.deliveryAddress ? (
                        <span className="truncate text-slate-500 text-xs">
                          {order.deliveryAddress}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-extrabold text-slate-900">
                      {formatMoney(Number(order.total))}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onSelectOrderChat(order)}
                    className="h-9 rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-blue-50"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Ver conversación
                  </Button>
                  {ticketId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setTicketOrder(order)}
                      className="h-9 rounded-xl border-blue-200 text-xs font-bold text-blue-700 hover:bg-blue-50"
                    >
                      Ver comprobante
                    </Button>
                  )}
                  {isDelivered && (
                    <Button type="button" variant="outline" onClick={() => setReviewOrder({ id: String(order.id) })}
                      className="h-9 rounded-xl border-amber-200 text-xs font-bold text-amber-700 hover:bg-amber-50">
                      Calificar comercio
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ModalTicketDigital
        isOpen={!!ticketOrder}
        onOpenChange={(open) => {
          if (!open) setTicketOrder(null);
        }}
        order={ticketOrder}
      />
      <ResenaPedidoDialog order={reviewOrder} onClose={closeReview} />
    </section>
  );
}
