"use client";

import React from "react";
import { DriverOrder, formatShortOrderCode } from "../motor/tipos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Clock,
  Navigation,
  Store,
  DollarSign,
  Zap,
  Banknote,
  Check,
  Package,
  ArrowRight,
} from "lucide-react";

interface TabPedidosDisponiblesProps {
  orders: DriverOrder[];
  onAcceptOrder: (order: DriverOrder) => void;
  pendingOrderIds: string[];
  hasActiveOrder?: boolean;
  previewOrderId?: string | null;
  onPreviewOrder?: (order: DriverOrder) => void;
}

export function TabPedidosDisponibles({
  orders,
  onAcceptOrder,
  pendingOrderIds,
  hasActiveOrder = false,
  previewOrderId = null,
  onPreviewOrder,
}: TabPedidosDisponiblesProps) {
  const formatMoney = (val: number) => "$" + (val || 0).toLocaleString("es-AR");

  if (orders.length === 0) {
    return (
      <div className="py-12 text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-yellow-100 text-yellow-700 mx-auto flex items-center justify-center">
          <Package className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-900">No hay pedidos pendientes</h4>
        <p className="text-xs text-slate-500">
          En cuanto un cliente confirme una orden desde la tienda, aparecerá aquí al instante.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-8">
      {hasActiveOrder && (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl p-3.5 text-xs flex items-center gap-2.5 font-bold shadow-xs">
          <span className="text-base">⚠️</span>
          <div>
            <p className="font-black text-amber-950">Viaje en curso activo</p>
            <p className="text-[11px] text-amber-800 font-medium">
              Completá tu entrega actual para tomar otro pedido.
            </p>
          </div>
        </div>
      )}

      {orders.map((order) => {
        const client = order.clientName || order.customerName || "Cliente";
        const earnings = order.driverEarnings;
        const distStore = order.distanceToStoreKm || 0.8;
        const distDelivery = order.distanceToDeliveryKm || order.distanceKm || 1.4;
        const totalDist = Math.round((distStore + distDelivery) * 10) / 10;
        const isCash =
          order.paymentMethod === "cash" ||
          order.paymentMethod === ("efectivo" as any) ||
          !order.paymentMethod;
        const isPacked = ["ready", "embalado"].includes(
          String(order.status).trim().toLowerCase()
        );
        const isSelected = previewOrderId === order.id;

        return (
          <div
            key={order.id}
            onClick={() => onPreviewOrder?.(order)}
            className={cn(
              "bg-white border rounded-2xl p-4 space-y-3 transition-all duration-200 shadow-sm cursor-pointer",
              isSelected
                ? "border-sky-500 ring-2 ring-sky-300 bg-sky-50/20 shadow-md"
                : "border-slate-200 hover:border-yellow-400 hover:shadow-md"
            )}
          >
            {/* Header: Ganancia del Repartidor (Estilo Uber) + ID */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Tu Ganancia Estimada
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black text-[#2D3277] tracking-tight">
                    {earnings == null ? "Sin dato" : `+${formatMoney(earnings)}`}
                  </span>
                  {order.isPeakHour && (
                    <Badge className="bg-yellow-100 text-yellow-900 border border-yellow-300 text-[9px] font-black px-1.5 py-0.5 flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5 fill-current" />
                      TARIFA PICO 1.35x
                    </Badge>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="font-mono text-xs font-black text-slate-800 block">
                  {formatShortOrderCode(order.id)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {order.estimatedMinutes || 20} min est.
                </span>
                {isPacked && (
                  <Badge className="mt-1 bg-yellow-100 text-yellow-900 border border-yellow-300 text-[9px] font-black px-1.5 py-0.5">
                    EMBALADO / LISTO
                  </Badge>
                )}
              </div>
            </div>

            {/* Trayecto dual: Al Market -> Al Cliente */}
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="space-y-0.5">
                <span className="text-slate-500 text-[10px] font-semibold flex items-center gap-1">
                  <Store className="w-3 h-3 text-yellow-700" />
                  1. Retiro en Market
                </span>
                <div className="font-bold text-slate-900 truncate">
                  {order.branch || "Tucumán 2130"}
                </div>
                <div className="text-slate-500 text-[10px]">{distStore} km a retirar</div>
              </div>

              <div className="space-y-0.5 border-l border-slate-200 pl-2">
                <span className="text-slate-500 text-[10px] font-semibold flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-red-400" />
                  2. Entrega a Domicilio
                </span>
                <div className="font-bold text-slate-900 truncate">{order.deliveryAddress}</div>
                <div className="text-slate-500 text-[10px]">{distDelivery} km de viaje</div>
              </div>
            </div>

            {/* Alerta de Cobro en Efectivo si aplica */}
            {isCash ? (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <Banknote className="w-4 h-4 shrink-0" />
                  <span>Cobrar en Efectivo al Cliente:</span>
                </div>
                <span className="text-sm font-black text-amber-400">
                  {formatMoney(order.total)}
                </span>
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                <span className="text-emerald-800 font-semibold text-[11px]">
                  💳 Pagado Online (No cobrar en puerta)
                </span>
                <span className="text-xs font-black text-slate-900">{formatMoney(order.total)}</span>
              </div>
            )}

            {/* Cortes resumidos */}
            {Array.isArray(order.items) && order.items.length > 0 && (
              <div className="text-[11px] text-slate-700 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Cortes a transportar:
                </span>
                {order.items.slice(0, 2).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[210px] text-slate-700">
                      • {item.quantity} {item.unit || "un"} {item.name}
                    </span>
                    {item.price != null && !isNaN(item.price) && (
                      <span className="text-slate-600 font-medium">
                        {formatMoney(item.price * item.quantity)}
                      </span>
                    )}
                  </div>
                ))}
                {order.items.length > 2 && (
                  <span className="text-[10px] text-yellow-800 font-semibold block italic">
                    + {order.items.length - 2} cortes más...
                  </span>
                )}
              </div>
            )}

            {/* Botón Aceptar Pedido */}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                if (!hasActiveOrder) onAcceptOrder(order);
              }}
              disabled={hasActiveOrder || pendingOrderIds.includes(order.id)}
              className={cn(
                "w-full h-11 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all",
                hasActiveOrder
                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-80"
                  : "bg-[#FFE600] hover:bg-yellow-300 text-[#2D3277] shadow-md shadow-yellow-500/20 active:scale-98"
              )}
            >
              <span>
                {hasActiveOrder
                  ? "Completá tu entrega actual para tomar otro pedido"
                  : pendingOrderIds.includes(order.id)
                  ? "PENDIENTE DE CONFIRMACIÓN"
                  : `ACEPTAR PEDIDO (${totalDist} km total)`}
              </span>
              {!hasActiveOrder && <ArrowRight className="w-4 h-4" />}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
