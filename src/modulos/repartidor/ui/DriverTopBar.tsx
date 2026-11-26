"use client";

import React from "react";
import { Sparkles, User, Truck, MessageCircle } from "lucide-react";
import { DriverProfile, DriverOrder, formatShortOrderCode } from "../motor/tipos";

interface DriverTopBarProps {
  driverProfile: DriverProfile | null;
  walletBalance?: number;
  activeOrder?: DriverOrder | null;
  chatUnreadCount?: number;
  copilotUnreadCount?: number;
  onOpenSidebar: () => void;
  onOpenCopilot: () => void;
  onOpenOrderChat: () => void;
  onFocusActiveRoute?: () => void;
  onOpenWallet?: () => void;
  onLogout: () => void;
  onOpenLoginModal: () => void;
  hasGps: boolean;
}

function formatOrderId(rawId: string): string {
  if (!rawId) return "";
  const clean = rawId.replace(/^#?RF-?/i, "");
  if (clean.length > 5) {
    return `RF-${clean.slice(0, 4)}…`;
  }
  return rawId.startsWith("RF-") ? rawId : `RF-${clean}`;
}

export function DriverTopBar({
  driverProfile,
  walletBalance = 0,
  activeOrder,
  chatUnreadCount = 0,
  copilotUnreadCount = 0,
  onOpenSidebar,
  onOpenCopilot,
  onOpenOrderChat,
  onFocusActiveRoute,
  onOpenWallet,
  onLogout,
  onOpenLoginModal,
}: DriverTopBarProps) {
  const driverInitial = driverProfile?.firstName
    ? driverProfile.firstName.charAt(0).toUpperCase()
    : "R";

  return (
    <header
      style={{
        paddingTop: "max(1.75rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))",
      }}
      className="absolute top-0 left-0 right-0 z-40 px-2 sm:px-4 py-1.5 pointer-events-none flex items-center justify-between gap-1 sm:gap-2 max-w-full"
    >
      {/* Botón Avatar / Menú Lateral Flotante */}
      <button
        type="button"
        onClick={onOpenSidebar}
        className="pointer-events-auto h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-full bg-[#FFE600] hover:bg-yellow-300 border-2 border-yellow-500 shadow-md shadow-yellow-500/20 flex items-center justify-center font-black text-xs sm:text-sm text-[#2D3277] active:scale-95 transition-all relative group"
        title="Abrir Menú y Mi Perfil"
      >
        <span className="group-hover:scale-110 transition-transform">{driverInitial}</span>
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
      </button>

      {/* Acciones rápidas: Copo IA, mensajes y estado del pedido/perfil */}
      <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0 max-w-[calc(100%-44px)] justify-end">
        {/* Copiloto IA con indicador de novedad */}
        <button
          type="button"
          onClick={onOpenCopilot}
          className="relative h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-full bg-white hover:bg-yellow-50 border border-yellow-300 text-[#2D3277] shadow-sm flex items-center justify-center active:scale-95 transition-all"
          title="Copiloto IA de Reparto"
        >
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          {copilotUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-yellow-400 text-[#2D3277] border border-yellow-500 rounded-full text-[9px] font-black flex items-center justify-center shadow">
              {copilotUnreadCount > 9 ? "9+" : copilotUnreadCount}
            </span>
          )}
        </button>

        {/* Acceso directo a la bandeja de mensajes con contador de no leídos */}
        <button
          type="button"
          onClick={onOpenOrderChat}
          className="relative h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-full bg-white hover:bg-yellow-50 border border-yellow-300 text-[#2D3277] shadow-sm flex items-center justify-center active:scale-95 transition-all"
          title="Mensajes de pedidos y Copo IA"
          aria-label="Abrir mensajes"
        >
          <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          {chatUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white rounded-full text-[9px] font-black flex items-center justify-center shadow animate-pulse">
              {chatUnreadCount > 9 ? "9+" : chatUnreadCount}
            </span>
          )}
        </button>

        {/* Píldora de Pedido en Curso o Perfil del Repartidor (Protegida contra desborde en móvil chico) */}
        {activeOrder ? (
          <button
            type="button"
            onClick={onFocusActiveRoute}
            className="h-9 sm:h-10 px-2 sm:px-2.5 rounded-full bg-white hover:bg-yellow-50 border border-yellow-400 shadow-sm flex items-center gap-1.5 active:scale-95 transition-all text-left shrink min-w-0 max-w-[125px] sm:max-w-[170px]"
            title={`Pedido activo ${activeOrder.id} · Toca para centrar la ruta en vivo`}
          >
            <div className="relative flex items-center justify-center shrink-0">
              <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75" />
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#FFE600] text-[#2D3277] flex items-center justify-center text-[10px] font-black">
                <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
            </div>
            <div className="flex flex-col min-w-0 pr-0.5 overflow-hidden">
              <span className="text-[10px] sm:text-[11px] font-black text-[#2D3277] leading-tight truncate">
                {formatShortOrderCode(activeOrder.id)}
              </span>
              <span className="text-[8px] sm:text-[9px] font-bold text-emerald-600 leading-tight uppercase tracking-tight truncate">
                En curso
              </span>
            </div>
          </button>
        ) : driverProfile ? (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="h-9 sm:h-10 px-2 sm:px-2.5 rounded-full bg-white hover:bg-yellow-50 border border-yellow-400 shadow-md flex items-center gap-1.5 active:scale-95 transition-all shrink min-w-0 max-w-[100px] sm:max-w-[140px]"
            title="Ver Opciones de Cuenta"
          >
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-yellow-100 text-[#2D3277] flex items-center justify-center text-[10px] font-black shrink-0">
              <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-slate-900 truncate">
              {driverProfile.firstName}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenLoginModal}
            className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-full bg-[#FFE600] hover:bg-yellow-300 text-[#2D3277] text-[11px] sm:text-xs font-black flex items-center gap-1 border border-yellow-500 shadow-md active:scale-95 transition-all shrink-0"
          >
            <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#2D3277]" />
            <span>Ingresar</span>
          </button>
        )}
      </div>
    </header>
  );
}
