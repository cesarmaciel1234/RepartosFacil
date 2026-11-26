"use client";

import React, { useState } from "react";
import { DriverOrder, formatShortOrderCode, STORE_DEFAULT_DERQUI } from "../motor/tipos";
import { loadDriverProfile } from "../motor/driverService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Phone,
  Navigation,
  CheckCircle2,
  Banknote,
  ExternalLink,
  Store,
  PackageCheck,
  MessageSquare,
  Sparkles,
  Compass,
  Receipt,
  Lock,
  MapPin,
} from "lucide-react";

interface TabMiRutaProps {
  activeOrders: DriverOrder[];
  onPickupOrder: (orderId: string) => void;
  onCompleteDelivery: (orderId: string) => void;
  onOpenOrderChat?: (order: DriverOrder) => void;
  pendingOrderIds: string[];
}

export function TabMiRuta({
  activeOrders,
  onPickupOrder,
  onCompleteDelivery,
  onOpenOrderChat,
  pendingOrderIds,
}: TabMiRutaProps) {
  const formatMoney = (val: number) => "$" + (val || 0).toLocaleString("es-AR");

  // Estado reactivo del tipo de vehículo seleccionado para la navegación
  const [vehicleType, setVehicleType] = useState<"motorcycle" | "car" | "bicycle">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rf_driver_vehicle");
      if (saved === "car" || saved === "bicycle" || saved === "motorcycle") return saved;
    }
    const profile = loadDriverProfile();
    const v = (profile?.vehicleType || "").toLowerCase();
    if (v.includes("bici") || v.includes("bicycle")) return "bicycle";
    if (v.includes("auto") || v.includes("car")) return "car";
    return "motorcycle";
  });

  const handleVehicleChange = (v: "motorcycle" | "car" | "bicycle") => {
    setVehicleType(v);
    if (typeof window !== "undefined") {
      localStorage.setItem("rf_driver_vehicle", v);
      window.dispatchEvent(new CustomEvent("rf_driver_vehicle_changed", { detail: { vehicle: v } }));
    }
  };

  const travelmode = vehicleType === "bicycle" ? "bicycling" : "driving";

  if (activeOrders.length === 0) {
    return (
      <div className="py-12 text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-yellow-100 text-yellow-700 mx-auto flex items-center justify-center">
          <Navigation className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-900">No tenés pedidos en tu ruta activa</h4>
        <p className="text-xs text-slate-500 max-w-[240px] mx-auto">
          Pasá a la pestaña "Disponibles" para tomar un pedido real y comenzar el reparto.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Selector Rápido de Vehículo de Navegación (Moto, Auto, Bici) */}
      <div className="bg-white border border-yellow-300 rounded-2xl p-2.5 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-black text-[#2D3277] uppercase tracking-wide">
            Vehículo activo:
          </span>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => handleVehicleChange("motorcycle")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 active:scale-95",
              vehicleType === "motorcycle"
                ? "bg-[#FFE600] text-[#2D3277] shadow-xs border border-yellow-500 scale-102"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
            )}
            title="Navegar en Moto (Modo vehicular ágil)"
          >
            <span>🛵</span>
            <span className="hidden sm:inline">Moto</span>
          </button>
          <button
            type="button"
            onClick={() => handleVehicleChange("car")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 active:scale-95",
              vehicleType === "car"
                ? "bg-[#FFE600] text-[#2D3277] shadow-xs border border-yellow-500 scale-102"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
            )}
            title="Navegar en Auto / Utilitario"
          >
            <span>🚗</span>
            <span className="hidden sm:inline">Auto</span>
          </button>
          <button
            type="button"
            onClick={() => handleVehicleChange("bicycle")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 active:scale-95",
              vehicleType === "bicycle"
                ? "bg-[#FFE600] text-[#2D3277] shadow-xs border border-yellow-500 scale-102"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
            )}
            title="Navegar en Bicicleta (Ciclovías y senderos)"
          >
            <span>🚲</span>
            <span className="hidden sm:inline">Bici</span>
          </button>
        </div>
      </div>

      {activeOrders.map((order) => {
        const client = order.clientName || order.customerName || "Cliente";
        const phone = order.customerPhone || "+54 9 341 555-1234";
        const earnings = order.driverEarnings;
        const isCash =
          order.paymentMethod === "cash" ||
          order.paymentMethod === ("efectivo" as any) ||
          !order.paymentMethod;

        const distanceDisplay =
          order.distanceKm ||
          (order.distanceToDeliveryKm ? Number(order.distanceToDeliveryKm) : 1.7);
        const minutesDisplay = order.estimatedMinutes || 18;
        
        // Estado del pedido: ¿Ya fue retirado en la tienda?
        const isPacked = ["ready", "embalado"].includes(
          String(order.status).trim().toLowerCase()
        );
        const isPickedUp = ["picked up", "in transit", "en_camino"].includes(
          String(order.status).trim().toLowerCase()
        );

        // ─── 1. Destino Físico Exacto de la Tienda de Retiro (Parada 1) ───
        const rawBranch = order.branch || STORE_DEFAULT_DERQUI.name;
        const isAlfaroBranch =
          rawBranch.toLowerCase().includes("alfaro") ||
          rawBranch.toLowerCase().includes("maciel") ||
          rawBranch.toLowerCase().includes("derqui");
        
        // Dirección física real de la sucursal de Cobro Fácil en Presidente Derqui
        const storeAddressClean = isAlfaroBranch
          ? STORE_DEFAULT_DERQUI.address
          : rawBranch.length > 5
          ? rawBranch
          : STORE_DEFAULT_DERQUI.address;

        const storeTarget = order.storeCoords?.lat && order.storeCoords?.lng
          ? `${order.storeCoords.lat},${order.storeCoords.lng}`
          : `${STORE_DEFAULT_DERQUI.coords.lat},${STORE_DEFAULT_DERQUI.coords.lng}`;

        const branchDisplay = isAlfaroBranch
          ? STORE_DEFAULT_DERQUI.name + " · Pte. Derqui"
          : rawBranch;

        // ─── 2. Destino del Domicilio del Comprador (Parada 2) ───
        const hasExactCoords = Boolean(order.destinationCoords?.lat && order.destinationCoords?.lng);
        const customerTarget = hasExactCoords
          ? `${order.destinationCoords!.lat},${order.destinationCoords!.lng}`
          : encodeURIComponent(order.deliveryAddress);

        // ─── Enlaces GPS Específicos por Etapa ───
        // Parada 1: SIEMPRE a la Tienda de Retiro
        const mapsStoreUrl = `https://www.google.com/maps/dir/?api=1&destination=${storeTarget}&travelmode=${travelmode}&dir_action=navigate`;
        
        // Parada 2: SIEMPRE al Domicilio del Cliente
        const mapsCustomerUrl = `https://www.google.com/maps/dir/?api=1&destination=${customerTarget}&travelmode=${travelmode}&dir_action=navigate`;

        // URL Activa según la etapa obligatoria:
        // Si NO retiró -> OBLIGATORIO ir a la Tienda (Parada 1)
        // Si ya retiró -> Ir al Comprador (Parada 2)
        const mapsActiveUrl = isPickedUp ? mapsCustomerUrl : mapsStoreUrl;

        const ticketDisplay = formatShortOrderCode(order.id);

        return (
          <div
            key={order.id}
            className="bg-white border-2 border-yellow-400 rounded-3xl p-4 space-y-3.5 shadow-sm"
          >
            {/* Header del Pedido Activo: Nombre de Cliente destacado + Ticket + Estado en Vivo */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Punto verde pulsante de conexión activa */}
                  <span className="relative flex h-2.5 w-2.5" title="Transmisión activa en vivo">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>

                  {/* Nombre del Cliente destacado */}
                  <h3 className="text-base font-black text-slate-900 truncate">
                    {client}
                  </h3>

                  {/* Badge de Ticket Digital */}
                  <button
                    type="button"
                    onClick={() => onOpenOrderChat?.(order)}
                    className="inline-flex items-center gap-1 font-black text-[11px] bg-yellow-100 hover:bg-[#FFE600] text-[#2D3277] px-2 py-0.5 rounded-lg border border-yellow-400 active:scale-95 transition-all"
                    title={`Ver chat y ticket ${ticketDisplay}`}
                  >
                    <Receipt className="w-3 h-3 text-[#2D3277]" />
                    <span>{ticketDisplay}</span>
                  </button>
                </div>

                {/* Subtítulo de Estado de la Misión */}
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  {isPickedUp ? (
                    <Badge className="bg-blue-600 text-white font-black text-[10px] px-2 py-0.5 shadow-xs">
                      🛵 EN CAMINO AL DOMICILIO (PARADA 2)
                    </Badge>
                  ) : isPacked ? (
                    <Badge className="bg-[#FFE600] text-[#2D3277] font-black text-[10px] px-2 py-0.5 animate-pulse shadow-xs shadow-yellow-500/30">
                      📦 LISTO: IR A RETIRAR A LA TIENDA (PARADA 1)
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5">
                      🏪 PREPARANDO: IR A LA TIENDA (PARADA 1)
                    </Badge>
                  )}
                </div>
              </div>

              {/* Ganancia neta */}
              <div className="text-right shrink-0">
                <span className="text-[9.5px] text-slate-400 uppercase font-black block">
                  Tu Ganancia
                </span>
                <span className="text-base font-black text-emerald-700">
                  {earnings == null ? "Sin dato" : `+${formatMoney(earnings)}`}
                </span>
              </div>
            </div>

            {/* ─── Puntos de Ruta Reales (Secuencia Estricta y Obligatoria) ─── */}
            <div className="space-y-2.5">
              
              {/* PARADA 1: Retiro en Sucursal / Negocio (OBLIGATORIA PRIMERO) */}
              <div
                className={cn(
                  "p-3 rounded-2xl border text-xs transition-all",
                  !isPickedUp
                    ? "bg-amber-50/95 border-amber-400 shadow-xs ring-2 ring-amber-400/50"
                    : "bg-slate-50 border-slate-200 opacity-75"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs font-black",
                        !isPickedUp
                          ? "bg-amber-400 text-amber-950 ring-2 ring-amber-300"
                          : "bg-emerald-100 text-emerald-800"
                      )}
                    >
                      {isPickedUp ? "✓" : "1"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700">
                          {isPickedUp ? "✓ Parada 1: Retirado de Tienda" : "📍 Parada 1: Retiro en Tienda (Obligatoria)"}
                        </span>
                        {!isPickedUp && (
                          <span className="text-[9px] font-black bg-amber-300 text-amber-950 px-2 py-0.5 rounded-full uppercase animate-pulse">
                            Parada actual
                          </span>
                        )}
                      </div>
                      <span className="font-extrabold text-slate-900 text-xs block truncate mt-0.5">
                        {branchDisplay}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        📍 Dirección: {storeAddressClean}
                      </span>
                    </div>
                  </div>

                  {/* Botón GPS Parada 1: Navegar a la Tienda */}
                  <a
                    href={mapsStoreUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "px-3 py-2 rounded-xl text-[10.5px] font-black flex items-center gap-1.5 shrink-0 transition-all border shadow-xs active:scale-95",
                      !isPickedUp
                        ? "bg-[#FFE600] hover:bg-yellow-300 text-[#2D3277] border-yellow-500 font-black shadow-md shadow-yellow-500/20"
                        : "bg-white hover:bg-slate-100 text-slate-600 border-slate-200"
                    )}
                    title="Navegar en Google Maps hasta la tienda física para retirar"
                  >
                    <Compass className="w-3.5 h-3.5 text-yellow-900" />
                    <span>GPS Tienda</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                </div>
              </div>

              {/* PARADA 2: Entrega en Domicilio del Comprador (Bloqueada hasta retirar en Parada 1) */}
              <div
                className={cn(
                  "p-3 rounded-2xl border text-xs transition-all",
                  isPickedUp
                    ? "bg-blue-50/95 border-blue-400 shadow-xs ring-2 ring-blue-400/50"
                    : "bg-slate-50/60 border-slate-200/80 opacity-70"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs font-black",
                        isPickedUp
                          ? "bg-blue-600 text-white ring-2 ring-blue-300/60"
                          : "bg-slate-200 text-slate-500"
                      )}
                    >
                      {isPickedUp ? "2" : <Lock className="w-3 h-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          {isPickedUp ? "🛵 Parada 2: Entregar al Comprador" : "⏳ Parada 2: Domicilio del Comprador"}
                        </span>
                        {!isPickedUp ? (
                          <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            Bloqueada hasta retirar
                          </span>
                        ) : (
                          <span className="text-[9px] font-black bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full uppercase animate-pulse">
                            Parada actual
                          </span>
                        )}
                      </div>
                      <span className="font-extrabold text-slate-900 text-xs block mt-0.5">
                        {order.deliveryAddress}
                      </span>
                      {hasExactCoords && (
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 mt-1">
                          🎯 Ubicación exacta con GPS fijada por comprador
                        </span>
                      )}
                      {order.notes && (
                        <span className="text-[10.5px] text-yellow-900 font-medium block mt-1 bg-yellow-50 px-2 py-0.5 rounded-lg border border-yellow-200">
                          Nota: "{order.notes}"
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botón GPS Parada 2: Activo SOLO si ya retiró en el local */}
                  {isPickedUp ? (
                    <a
                      href={mapsCustomerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-xl text-[10.5px] font-black flex items-center gap-1.5 shrink-0 transition-all border shadow-md shadow-blue-500/20 active:scale-95 bg-blue-600 hover:bg-blue-700 text-white border-blue-700"
                      title="Navegar por GPS hasta el domicilio del comprador"
                    >
                      <Compass className="w-3.5 h-3.5 text-white" />
                      <span>GPS Cliente</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  ) : (
                    <div
                      className="px-2.5 py-1.5 rounded-xl text-[9.5px] font-bold flex items-center gap-1 shrink-0 bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      title="Primero debés retirar el pedido en la tienda física (Parada 1)"
                    >
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>Paso 2</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ─── Botonera de Acción Directa: GPS Obligatorio por Etapa + Llamar + Chat ─── */}
            <div className="grid grid-cols-3 gap-1.5">
              {/* Botón GPS Principal: Apunta a la Tienda si no retiró, o al Cliente si ya retiró */}
              <a
                href={mapsActiveUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "h-11 rounded-xl font-black text-[11px] flex items-center justify-center gap-1 border transition-all shadow-xs group px-1 active:scale-95",
                  !isPickedUp
                    ? "bg-[#FFE600] hover:bg-yellow-300 text-[#2D3277] border-yellow-500 shadow-md shadow-yellow-500/20"
                    : "bg-blue-600 hover:bg-blue-700 text-white border-blue-700 shadow-md shadow-blue-500/20"
                )}
                title={!isPickedUp ? `Navegar a Parada 1: Tienda (${storeAddressClean})` : `Navegar a Parada 2: Cliente (${order.deliveryAddress})`}
              >
                <Compass className={cn("w-4 h-4 group-hover:rotate-45 transition-transform", !isPickedUp ? "text-[#2D3277]" : "text-white")} />
                <span className="truncate">
                  {!isPickedUp ? "GPS 1: Tienda" : "GPS 2: Cliente"}
                </span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </a>

              <a
                href={`tel:${phone}`}
                className="h-11 rounded-xl bg-white hover:bg-yellow-50 text-slate-800 font-bold text-[11px] flex items-center justify-center gap-1 border border-slate-200 transition-all shadow-xs px-1 active:scale-95"
                title="Llamar al cliente"
              >
                <Phone className="w-3.5 h-3.5 text-yellow-700" />
                <span>Llamar</span>
              </a>

              <button
                type="button"
                onClick={() => onOpenOrderChat?.(order)}
                className="h-11 rounded-xl bg-white hover:bg-yellow-50 text-[#2D3277] font-bold text-[11px] flex items-center justify-center gap-1 border border-yellow-300 transition-all shadow-xs active:scale-95 px-1"
                title="Abrir chat privado de esta entrega"
              >
                <MessageSquare className="w-3.5 h-3.5 text-yellow-700" />
                <span>Chat</span>
              </button>
            </div>

            {/* Aviso Destacado de Cobro en Efectivo */}
            {isCash && (
              <div className="p-3 rounded-2xl bg-yellow-50 border-2 border-yellow-300 flex items-center justify-between text-xs shadow-xs">
                <div className="flex items-center gap-2 text-yellow-900 font-bold">
                  <Banknote className="w-5 h-5 shrink-0 text-yellow-700" />
                  <div>
                    <span className="block text-yellow-900 font-black">Cobrar en Efectivo:</span>
                    <span className="text-[10px] text-yellow-800 font-normal">
                      Verificar importe antes de entregar
                    </span>
                  </div>
                </div>
                <span className="text-base font-black text-yellow-900 font-mono">
                  {formatMoney(order.total)}
                </span>
              </div>
            )}

            {/* ─── Botón Principal de Transición de Etapa (Primero Retirar, luego Entregar) ─── */}
            <div className="pt-1">
              {!isPickedUp ? (
                <>
                  <Button
                    onClick={() => onPickupOrder(order.id)}
                    disabled={pendingOrderIds.includes(order.id)}
                    className="w-full h-13 rounded-2xl bg-[#FFE600] hover:bg-yellow-300 text-[#2D3277] font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-yellow-500/20 active:scale-98 transition-all border-2 border-yellow-500"
                  >
                    <PackageCheck className="w-5 h-5 text-[#2D3277]" />
                    <span>
                      {pendingOrderIds.includes(order.id)
                        ? "CONFIRMANDO RETIRO EN TIENDA..."
                        : "YA RETIRÉ EL PEDIDO EN LA TIENDA"}
                    </span>
                  </Button>
                  <p className="text-[10.5px] text-center text-slate-600 font-bold mt-1.5 flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-700" />
                    Paso obligatorio 1: Al confirmar que retiraste, se desbloquea el GPS al domicilio del cliente.
                  </p>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => onCompleteDelivery(order.id)}
                    disabled={pendingOrderIds.includes(order.id)}
                    className="w-full h-13 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 active:scale-98 transition-all"
                  >
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    <span>
                      {pendingOrderIds.includes(order.id)
                        ? "CONFIRMANDO ENTREGA EN DESTINO..."
                        : earnings == null
                        ? "CONFIRMAR ENTREGA AL CLIENTE"
                        : `CONFIRMAR ENTREGA AL CLIENTE (+${formatMoney(earnings)})`}
                    </span>
                  </Button>
                  <p className="text-[10.5px] text-center text-slate-600 font-bold mt-1.5 flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Paso 2: Entregar en mano y cobrar si corresponde. Ganancia acreditada al confirmar.
                  </p>
                </>
              )}
            </div>

          </div>
        );
      })}
    </div>
  );
}
