"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, MessageSquare, MapPin, ChevronDown, ArrowLeft } from "lucide-react";

interface HeaderTiendaProps {
  cartCount: number;
  cartTotal: number;
  deliveryType: "delivery" | "pickup";
  deliveryAddress: string;
  selectedCompanyName?: string | null;
  onBackToMarkets?: () => void;
  onChangeAddress?: () => void;
  onOpenCart: () => void;
  onSwitchToDriver: () => void;
  onOpenOrderChat?: () => void;
  unreadCount?: number;
  unreadError?: boolean;
}

export function HeaderTienda({
  cartCount,
  cartTotal,
  deliveryType,
  deliveryAddress,
  selectedCompanyName,
  onBackToMarkets,
  onChangeAddress,
  onOpenCart,
  onSwitchToDriver,
  onOpenOrderChat,
  unreadCount = 0,
  unreadError = false,
}: HeaderTiendaProps) {
  const formatMoney = (val: number) => "$" + val.toLocaleString("es-AR");

  return (
    <header
      style={{
        paddingTop: "max(0.625rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))",
      }}
      className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-4 pt-safe-header pb-2.5 shadow-sm"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
        {/* Lado Izquierdo: Botón Sidebar / Perfil + Dirección */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Botón Volver si está dentro de una empresa */}
          {selectedCompanyName && onBackToMarkets ? (
            <button
              type="button"
              onClick={onBackToMarkets}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-blue-50 border border-slate-200 flex items-center justify-center text-slate-700 hover:text-blue-600 shrink-0 active:scale-95 transition-all shadow-xs"
              title="Volver a Empresas y Mercados"
            >
              <ArrowLeft className="w-4 h-4 text-blue-600" />
            </button>
          ) : null}

          {/* Selector de Dirección (Home) o Nombre del Comercio (Dentro de la tienda) */}
          <div className="min-w-0">
            {selectedCompanyName ? (
              <span className="block max-w-[170px] truncate text-sm font-black text-slate-900 sm:max-w-[280px]">
                {selectedCompanyName}
              </span>
            ) : (
              /* En la Home: muestra la dirección de entrega limpia en fondo blanco */
              <div>
                <span className="text-[10px] text-slate-500 font-bold block leading-none">
                  Entregar en
                </span>
                <button
                  type="button"
                  onClick={onChangeAddress}
                  className="flex items-center gap-1 text-left group mt-0.5 cursor-pointer"
                  title="Cambiar dirección de entrega"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="font-black text-sm text-slate-900 truncate group-hover:text-blue-600 transition-colors max-w-[160px] sm:max-w-[260px]">
                    {deliveryAddress || "Elegí tu dirección"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mensajes y carrito */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={onOpenOrderChat || onSwitchToDriver}
            size="sm"
            variant="outline"
            className="border-slate-200 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-full text-xs font-bold px-3 h-9 flex items-center gap-1.5 shadow-xs relative active:scale-95 transition-all"
            title={unreadError ? "No se pudieron actualizar los mensajes nuevos" : "Mensajes"}
            aria-label={unreadError ? "Mensajes, no se pudo actualizar el contador" : `Mensajes${unreadCount ? `, ${unreadCount} nuevos` : ""}`}
          >
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Mensajes</span>
            {unreadCount > 0 && (
              <span className="min-w-4 rounded-full bg-blue-600 px-1.5 text-center text-[10px] font-black text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
            {unreadError && <span aria-hidden="true" className="font-black text-amber-700">!</span>}
          </Button>

          {/* Botón El Carrito */}
          <Button
            onClick={onOpenCart}
            size="sm"
            className="relative bg-blue-600 hover:bg-blue-700 text-white font-black rounded-full text-xs px-3.5 h-9 flex items-center gap-1.5 shadow-sm shadow-blue-600/20 active:scale-95 transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden xs:inline">Carrito</span>
            {cartCount > 0 && (
              <span className="bg-white text-blue-700 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                {cartCount}
              </span>
            )}
            {cartTotal > 0 && (
              <span className="hidden md:inline text-xs font-semibold text-blue-50 border-l border-blue-400/50 pl-1.5">
                {formatMoney(cartTotal)}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
