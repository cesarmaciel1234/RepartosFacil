"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  Headphones,
  Tag,
  Wallet,
  Settings,
  MessageSquare,
  ShieldCheck,
  QrCode,
  Gift,
  Truck,
  Store,
  LogOut,
  ChevronRight,
  User,
  ExternalLink,
  RefreshCw,
  Navigation,
  Compass,
  Bike,
  History,
} from "lucide-react";
import { DriverProfile } from "@/modulos/repartidor/motor/tipos";
import {
  loadClientProfile,
  ClientProfile,
  loadDriverProfile,
  clearDriverProfile,
  clearClientProfile,
} from "@/modulos/repartidor/motor/driverService";
import { ModalClientAuth } from "@/modulos/tienda/ui/ModalClientAuth";
import { AppVersion } from "@/components/AppVersion";
import { useState, useEffect } from "react";
import { authHeaders } from "@/lib/clientAuth";

interface SidebarGeneralProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentMode: "store" | "driver";
  onSwitchMode: (mode: "store" | "driver") => void;
  driverProfile?: DriverProfile | null;
  walletBalance?: number;
  onOpenWallet?: () => void;
  onOpenOrders?: () => void;
  onOpenMarkets?: () => void;
  onLogout?: () => void;
}

export function SidebarGeneral({
  isOpen,
  onOpenChange,
  currentMode,
  onSwitchMode,
  driverProfile,
  walletBalance = 0,
  onOpenWallet,
  onOpenOrders,
  onOpenMarkets,
  onLogout,
}: SidebarGeneralProps) {
  const formatMoney = (val: number) => "$" + val.toLocaleString("es-AR");
  const isDriverMode = currentMode === "driver";

  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [driverProfileLocal, setDriverProfileLocal] = useState<DriverProfile | null>(driverProfile || null);
  const [isClientAuthOpen, setIsClientAuthOpen] = useState(false);
  const activeDriverProfile = driverProfile || driverProfileLocal;

  useEffect(() => {
    setClientProfile(loadClientProfile());
    setDriverProfileLocal(loadDriverProfile());

    const sync = () => {
      setClientProfile(loadClientProfile());
      setDriverProfileLocal(loadDriverProfile());
    };

    window.addEventListener("repartofacil-auth", sync);
    window.addEventListener("repartofacil-client-auth", sync);
    window.addEventListener("repartofacil-driver-auth", sync);
    return () => {
      window.removeEventListener("repartofacil-auth", sync);
      window.removeEventListener("repartofacil-client-auth", sync);
      window.removeEventListener("repartofacil-driver-auth", sync);
    };
  }, []);

  const userName =
    isDriverMode && activeDriverProfile
      ? activeDriverProfile.firstName
      : clientProfile
      ? clientProfile.displayName
      : "Cliente Reparto Fácil";

  const userInitial = userName.charAt(0).toUpperCase();
  const driverStatusLabel =
    activeDriverProfile?.availabilityStatus === "Available"
      ? "Disponible"
      : activeDriverProfile?.availabilityStatus === "Busy"
      ? "En reparto"
      : activeDriverProfile?.availabilityStatus === "Offline"
      ? "Desconectado"
      : "Estado sin configurar";
  const driverVehicleLabel =
    activeDriverProfile?.vehicleType === "Motorcycle"
      ? "Motocicleta"
      : activeDriverProfile?.vehicleType === "Bicycle"
      ? "Bicicleta"
      : activeDriverProfile?.vehicleType === "Car"
      ? "Auto"
      : "Sin configurar";
  const driverIdLabel = activeDriverProfile?.id
    ? `#${activeDriverProfile.id.slice(-8).toUpperCase()}`
    : "Sin asignar";

  const handleCloseSession = () => {
    onOpenChange(false);
    if (currentMode === "driver") {
      // Notificar la desconexión sin liberar inmediatamente los pedidos activos.
      if (driverProfileLocal?.id) {
        fetch("/api/orders/custodio", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders("Driver") },
          body: JSON.stringify({
            action: "driver_disconnected",
            driverId: driverProfileLocal.id,
            driverName: driverProfileLocal.firstName || "Repartidor",
          }),
        }).then((response) => {
          if (!response.ok) console.warn("No se pudo registrar la desconexión del repartidor:", response.status);
        }).catch((error) => console.warn("No se pudo notificar la desconexión:", error));
      }
      clearDriverProfile();
      setDriverProfileLocal(null);
      if (onLogout) onLogout();
      onSwitchMode("store");
    } else {
      clearClientProfile();
      setClientProfile(null);
      if (onLogout) onLogout();
    }
  };

  const handleSwitchModeAndClose = () => {
    onOpenChange(false);
    onSwitchMode(currentMode === "store" ? "driver" : "store");
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          className={`w-[85vw] max-w-xs border-r p-0 flex flex-col justify-between ${
            isDriverMode
              ? "bg-white border-slate-200 text-slate-900"
              : "bg-slate-950 border-slate-800 text-slate-100"
          }`}
        >
          <div
            style={{
              paddingTop: "max(1.25rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))",
              paddingBottom: "max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))",
            }}
            className="overflow-y-auto p-5 space-y-6"
          >
            {/* 1. Header Perfil (Estilo DiDi / PedidosYa - Captura 1) */}
            <div
              className={`flex items-center gap-3 ${
                isDriverMode
                  ? "rounded-3xl border border-yellow-200 bg-gradient-to-br from-yellow-50 via-white to-white p-4 shadow-sm"
                  : "pb-4 border-b border-slate-800/80"
              }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm shrink-0 ${
                  isDriverMode
                    ? "bg-[#FFE600] border border-yellow-500 text-[#2D3277]"
                    : "rounded-full bg-slate-800 border-2 border-emerald-500/40 text-white shadow-lg"
                }`}
              >
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`font-black text-base truncate block ${
                      isDriverMode ? "text-slate-900" : "text-white"
                    }`}
                  >
                    {userName}
                  </span>
                </div>
                <span
                  className={`text-xs block truncate ${
                    isDriverMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {currentMode === "driver"
                    ? "Perfil de repartidor"
                    : clientProfile
                    ? `Comprador · ${clientProfile.displayName || "Cliente Registrado"}`
                    : "Comprador · Ecosistema Reparto Fácil"}
                </span>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <Badge
                    className={
                      currentMode === "driver"
                        ? "bg-yellow-100 text-[#2D3277] border border-yellow-300 text-[9px] font-bold py-0"
                        : "bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold py-0"
                    }
                  >
                    {currentMode === "driver"
                      ? driverStatusLabel
                      : clientProfile
                      ? "Cliente Registrado"
                      : "Modo Tienda"}
                  </Badge>

                  {/* Botón Iniciar Sesión Cliente si está en modo tienda y no está logueado */}
                  {currentMode === "store" && !clientProfile && (
                    <button
                      type="button"
                      onClick={() => setIsClientAuthOpen(true)}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 underline underline-offset-2"
                    >
                      Iniciar Sesión
                    </button>
                  )}
                </div>
              </div>
            </div>

          {/* 2. Menú Condicional: Exclusivo Repartidor vs Exclusivo Cliente */}
          {currentMode === "driver" ? (
            /* ─── VISTA EXCLUSIVA REPARTIDOR (Solo herramientas de trabajo) ─── */
            <div className="space-y-4">
              {onOpenWallet && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenWallet();
                  }}
                  className="w-full rounded-3xl border border-yellow-300 bg-[#FFE600] p-4 text-left shadow-sm transition hover:bg-yellow-300 active:scale-[0.99]"
                >
                  <span className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-[#2D3277]">
                    Ganancias disponibles
                    <ChevronRight className="h-4 w-4" />
                  </span>
                  <span className="mt-1 block text-2xl font-black tracking-tight text-[#2D3277]">
                    {formatMoney(walletBalance)}
                  </span>
                  <span className="mt-1 block text-[11px] font-semibold text-slate-700">
                    Ver movimientos y efectivo rendido
                  </span>
                </button>
              )}

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-yellow-800 uppercase tracking-wider block">
                  Herramientas de Repartidor
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {/* Mi Ruta */}
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      if (onOpenOrders) onOpenOrders();
                    }}
                    className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white border border-slate-200 hover:border-yellow-400 hover:bg-yellow-50 transition-all text-center group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-yellow-100 text-[#2D3277] flex items-center justify-center mb-1">
                      <Truck className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800">Mi Ruta</span>
                  </button>

                  {/* Mi Billetera */}
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      if (onOpenWallet) onOpenWallet();
                    }}
                    className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white border border-slate-200 hover:border-yellow-400 hover:bg-yellow-50 transition-all text-center group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-yellow-100 text-[#2D3277] flex items-center justify-center mb-1">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800">Billetera</span>
                  </button>

                  {/* Historial de Entregas */}
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      if (onOpenWallet) onOpenWallet();
                    }}
                    className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white border border-slate-200 hover:border-yellow-400 hover:bg-yellow-50 transition-all text-center group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-yellow-50 text-slate-500 group-hover:text-[#2D3277] flex items-center justify-center mb-1">
                      <History className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800">Historial</span>
                  </button>

                  {/* Mapa GPS */}
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white border border-slate-200 hover:border-yellow-400 hover:bg-yellow-50 transition-all text-center group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-yellow-50 text-slate-500 group-hover:text-[#2D3277] flex items-center justify-center mb-1">
                      <Navigation className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800">Mapa GPS</span>
                  </button>

                  {/* Soporte Chofer */}
                  <a
                    href="https://wa.me/5493415551234?text=Hola,%20solicito%20soporte%20operativo%20de%20reparto"
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white border border-slate-200 hover:border-yellow-400 hover:bg-yellow-50 transition-all text-center group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-yellow-50 text-slate-500 group-hover:text-[#2D3277] flex items-center justify-center mb-1">
                      <Headphones className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800">Soporte</span>
                  </a>

                  {/* Cobro Fácil QR / TPV */}
                  <a
                    href="https://cobrofacil.onrender.com"
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white border border-slate-200 hover:border-yellow-400 hover:bg-yellow-50 transition-all text-center group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-yellow-50 text-slate-500 group-hover:text-[#2D3277] flex items-center justify-center mb-1">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800">CobroFácil</span>
                  </a>
                </div>
              </div>

              {/* Ficha Operativa del Repartidor */}
              <div className="space-y-2 pt-3 border-t border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Información del repartidor
                </span>

                <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <Bike className="w-3.5 h-3.5 text-yellow-700" />
                      Vehículo:
                    </span>
                    <span className="text-slate-900 font-bold">{driverVehicleLabel}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
                    <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-yellow-700" />
                      Estado:
                    </span>
                    <span className="text-slate-900 font-bold">{driverStatusLabel}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
                    <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <User className="w-3.5 h-3.5 text-yellow-700" />
                      ID de repartidor:
                    </span>
                    <span className="text-slate-900 font-bold">{driverIdLabel}</span>
                  </div>
                </div>

                {/* Enlace Directo a Cobro Fácil Cloud */}
                <a
                  href="https://cobrofacil.onrender.com"
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between text-left hover:border-yellow-400 hover:bg-yellow-50 transition-all block"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-yellow-100 text-[#2D3277] flex items-center justify-center">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Cobro Fácil Cloud</div>
                      <div className="text-[10px] text-slate-500">Base de datos PostgreSQL central</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </a>
              </div>
            </div>
          ) : (
            /* ─── VISTA EXCLUSIVA COMPRADOR / TIENDA ─── */
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Accesos Principales
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {/* Mis Pedidos */}
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      if (onOpenOrders) onOpenOrders();
                    }}
                    className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-850 transition-all text-center group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 group-hover:text-emerald-400 flex items-center justify-center mb-1">
                      <Package className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-200">Pedidos</span>
                  </button>

                  {/* Mi Billetera */}
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      if (onOpenWallet) onOpenWallet();
                    }}
                    className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-850 transition-all text-center group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-200">Billetera</span>
                  </button>

                  {/* Mercados */}
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      if (onOpenMarkets) onOpenMarkets();
                    }}
                    className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-850 transition-all text-center group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 group-hover:text-amber-400 flex items-center justify-center mb-1">
                      <Store className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-200">Mercados</span>
                  </button>

                  {/* Ofertas */}
                  <button
                    type="button"
                    className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-850 transition-all text-center group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 group-hover:text-purple-400 flex items-center justify-center mb-1">
                      <Tag className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-200">Ofertas</span>
                  </button>

                  {/* Ayuda */}
                  <a
                    href="https://wa.me/5491100000000"
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-850 transition-all text-center group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 group-hover:text-green-400 flex items-center justify-center mb-1">
                      <Headphones className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-200">Ayuda</span>
                  </a>

                  {/* CobroFácil */}
                  <button
                    type="button"
                    className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-850 transition-all text-center group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 group-hover:text-blue-400 flex items-center justify-center mb-1">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-200">CobroFácil</span>
                  </button>
                </div>
              </div>

              {/* Otras Funciones de Comprador */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Otras Funciones
                </span>

                {/* Alternar a Repartidor */}
                <button
                  type="button"
                  onClick={handleSwitchModeAndClose}
                  className="w-full p-3 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/30 flex items-center justify-between text-left hover:border-emerald-500/60 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">
                        Conectarse como Repartidor
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Ver radar de pedidos y ganar dinero
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-400" />
                </button>

                {/* Compartí y Gana */}
                <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-left">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                      <Gift className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Compartí y ganá</div>
                      <div className="text-[10px] text-slate-400">Descuentos en carnicería</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>

                {/* Cobro Fácil Cloud */}
                <a
                  href="https://cobrofacil.onrender.com"
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-left hover:border-blue-500/40 transition-all block"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Cobro Fácil Cloud</div>
                      <div className="text-[10px] text-slate-400">Base de datos central</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </a>
              </div>
            </div>
          )}
        </div>

          {/* 4. Footer con Cerrar Sesión y Actualizar Caché PWA */}
          <div
            className={`p-4 border-t space-y-2 ${
              isDriverMode
                ? "border-slate-200 bg-slate-50"
                : "border-slate-800 bg-slate-900/60"
            }`}
          >
            <AppVersion dark={!isDriverMode} />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                if (typeof window !== "undefined") {
                  if ("caches" in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map((k) => caches.delete(k)));
                  }
                  if ("serviceWorker" in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map((r) => r.unregister()));
                  }
                  const url = new URL(window.location.href);
                  url.searchParams.set("mode", currentMode);
                  url.searchParams.set("v", String(Date.now()));
                  window.location.href = url.toString();
                }
              }}
              className={`w-full h-10 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${
                isDriverMode
                  ? "bg-yellow-100 hover:bg-yellow-200 text-[#2D3277] border-yellow-300"
                  : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 border-emerald-500/30"
              }`}
              title="Borrar caché guardada offline y recargar la aplicación"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isDriverMode ? "text-yellow-800" : "text-emerald-400"
                }`}
              />
              <span>Buscar actualización (Limpiar Caché)</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={handleCloseSession}
              className={`w-full h-11 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                isDriverMode
                  ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                  : "bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 border-red-500/30"
              }`}
            >
              <LogOut
                className={`w-4 h-4 ${
                  isDriverMode ? "text-red-600" : "text-red-400"
                }`}
              />
              <span>
                {currentMode === "driver"
                  ? "Cerrar Sesión Repartidor"
                  : clientProfile
                  ? "Cerrar Sesión Cliente"
                  : "Limpiar Sesión"}
              </span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal de Autenticación para Cliente */}
      <ModalClientAuth
        isOpen={isClientAuthOpen}
        onOpenChange={setIsClientAuthOpen}
      />
    </>
  );
}
