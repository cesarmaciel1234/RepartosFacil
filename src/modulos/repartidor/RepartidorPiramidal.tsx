"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

const InteractiveMap = dynamic(() => import("@/components/InteractiveMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-slate-50 flex items-center justify-center text-slate-600 font-mono text-xs">
      Cargando mapa GPS...
    </div>
  ),
});
import { useDriverOrders } from "./motor/useDriverOrders";
import { useDriverGps } from "./motor/useDriverGps";
import { loadDriverProfile, clearDriverProfile } from "./motor/driverService";
import type { DriverOrder, DriverProfile } from "./motor/tipos";
import { STORE_DEFAULT_DERQUI } from "./motor/tipos";
import { DriverTopBar } from "./ui/DriverTopBar";
import { TabPedidosDisponibles } from "./ui/TabPedidosDisponibles";
import { TabMiRuta } from "./ui/TabMiRuta";
import { ModalDriverAuth } from "./ui/ModalDriverAuth";
import { ModalCarteraRepartidor } from "./ui/ModalCarteraRepartidor";
import { DriverCopilotSheet } from "./ui/DriverCopilotSheet";
import { OrderChatSheet } from "./ui/OrderChatSheet";
import { CentroMensajeriaDriverSheet } from "./ui/CentroMensajeriaDriverSheet";
import { SidebarGeneral } from "@/components/SidebarGeneral";
import { ModalMercados } from "@/components/ModalMercados";
import { Layers, Truck, ShieldAlert, Navigation, Target, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authHeaders } from "@/lib/clientAuth";
import { useMensajesNoLeidos } from "@/modulos/tienda/pedidos/hooks/useMensajesNoLeidos";
import { useScreenWakeLock, requestNotificationPermission } from "@/lib/browserIntegration";

interface RepartidorPiramidalProps {
  onSwitchToStore: () => void;
}

export function RepartidorPiramidal({ onSwitchToStore }: RepartidorPiramidalProps) {
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [activeTab, setActiveTab] = useState<"pedidos" | "ruta" | "alerta" | "mensajes">("pedidos");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMarketsOpen, setIsMarketsOpen] = useState(false);
  const [selectedDriverChatOrder, setSelectedDriverChatOrder] = useState<DriverOrder | null>(null);
  const [chatOriginTab, setChatOriginTab] = useState<"pedidos" | "ruta" | "mensajes">("ruta");
  const [isCopilotConversationOpen, setIsCopilotConversationOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [mapCenterTrigger, setMapCenterTrigger] = useState(0);
  const [previewOrder, setPreviewOrder] = useState<DriverOrder | null>(null);

  // Bottom Sheet drag state
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const didDrag = useRef(false);

  // Cargar perfil del conductor (para entrar como repartidor se requiere estar logueado)
  useEffect(() => {
    const p = loadDriverProfile();
    setDriverProfile(p);
    if (!p) {
      setShowLoginModal(true);
    }

    const handleAuthChange = () => {
      setDriverProfile(loadDriverProfile());
    };
    window.addEventListener("repartofacil-auth", handleAuthChange);
    return () => window.removeEventListener("repartofacil-auth", handleAuthChange);
  }, []);

  // Motores de la pirámide
  const { coords, heading } = useDriverGps(driverProfile?.id);
  const {
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
  } = useDriverOrders(driverProfile?.id);

  const { unreadTotal: chatUnreadCount } = useMensajesNoLeidos("Driver");
  const [copilotUnreadCount, setCopilotUnreadCount] = useState(0);
  const prevAvailableCountRef = useRef(0);

  // Mantener la pantalla encendida durante navegación activa o entregas en curso (PWA WakeLock)
  useScreenWakeLock(myActiveOrders.length > 0 || isNavigating);

  // Prueba de Vida del Repartidor: envía lat/lng y renueva driver_last_ping periódicamente
  useEffect(() => {
    if (!driverProfile?.id) return;
    let active = true;

    const emitirPruebaDeVida = async () => {
      if (!active) return;
      try {
        const coords = typeof navigator !== "undefined" && navigator.geolocation
          ? await new Promise<{ lat?: number; lng?: number }>((resolve) => {
              navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => resolve({}),
                { timeout: 4000, maximumAge: 30000 }
              );
            })
          : {};

        await fetch("/api/orders/custodio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders("Driver"),
          },
          body: JSON.stringify({
            action: "ping",
            driverId: driverProfile.id,
            lat: coords.lat,
            lng: coords.lng,
          }),
        });
      } catch (err) {
        // Silencioso ante pérdidas temporales de señal
      }
    };

    void emitirPruebaDeVida();
    const interval = setInterval(emitirPruebaDeVida, 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [driverProfile?.id]);

  // Solicitar permiso de notificaciones nativas del navegador al iniciar actividad como repartidor
  useEffect(() => {
    if (driverProfile?.id) {
      void requestNotificationPermission();
    }
  }, [driverProfile?.id]);

  // Si ingresan nuevas oportunidades en Disponibles, Copo IA genera sugerencia/badge
  useEffect(() => {
    if (availableOrders.length > prevAvailableCountRef.current && prevAvailableCountRef.current > 0) {
      setCopilotUnreadCount((prev) => prev + (availableOrders.length - prevAvailableCountRef.current));
    }
    prevAvailableCountRef.current = availableOrders.length;
  }, [availableOrders.length]);

  useEffect(() => {
    if (selectedDriverChatOrder && !myActiveOrders.some((order) => order.id === selectedDriverChatOrder.id)) {
      setSelectedDriverChatOrder(null);
    }
  }, [selectedDriverChatOrder, myActiveOrders]);

  // Heartbeat de telemetría y presencia para el Custodio del Sistema
  useEffect(() => {
    if (!driverProfile?.id || myActiveOrders.length === 0) return;
    const sendPing = async () => {
      try {
        await fetch("/api/orders/custodio", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders("Driver") },
          body: JSON.stringify({
            action: "ping",
            driverId: driverProfile.id,
            lat: coords?.lat || null,
            lng: coords?.lng || null,
          }),
        });
      } catch {
        // Red offline transitoria
      }
    };
    sendPing();
    const timer = setInterval(sendPing, 15000);
    return () => clearInterval(timer);
  }, [driverProfile?.id, coords?.lat, coords?.lng, myActiveOrders.length]);

  // Manejo de drag en móvil
  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    startY.current = clientY;
    didDrag.current = false;
  };

  useEffect(() => {
    const handleMove = (clientY: number) => {
      if (!isDragging) return;
      const delta = clientY - startY.current;
      if (Math.abs(delta) > 10) didDrag.current = true;
      setDragY(delta);
    };

    const handleEnd = () => {
      if (!isDragging) return;
      setIsDragging(false);
      if (dragY < -60) setIsExpanded(true);
      else if (dragY > 60) setIsExpanded(false);
      setDragY(0);
    };

    const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientY);
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientY);

    if (isDragging) {
      window.addEventListener("touchmove", onTouchMove);
      window.addEventListener("touchend", handleEnd);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", handleEnd);
    }
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", handleEnd);
    };
  }, [isDragging, dragY]);

  const sheetY = isExpanded ? Math.max(0, dragY) : `calc(100% - 150px + ${Math.min(0, dragY)}px)`;

  const handleFocusActiveRoute = () => {
    setActiveTab("ruta");
    setIsExpanded(true);
    setIsNavigating(true);
    setMapCenterTrigger((prev) => prev + 1);
  };

  const showMessageInbox = () => {
    setSelectedDriverChatOrder(null);
    setIsCopilotConversationOpen(false);
    setActiveTab("mensajes");
    setIsExpanded(true);
  };

  const openCopilotConversation = () => {
    setSelectedDriverChatOrder(null);
    setIsCopilotConversationOpen(true);
    setCopilotUnreadCount(0);
    setActiveTab("mensajes");
    setIsExpanded(true);
  };

  const openOrderConversation = (order: DriverOrder) => {
    setChatOriginTab(activeTab === "mensajes" ? "mensajes" : "ruta");
    setSelectedDriverChatOrder(order);
    setIsCopilotConversationOpen(false);
    setActiveTab("mensajes");
    setIsExpanded(true);
  };

  const handleBackFromOrderChat = () => {
    setSelectedDriverChatOrder(null);
    setIsCopilotConversationOpen(false);
    setActiveTab(chatOriginTab);
    setIsExpanded(true);
  };

  const activeOrder = myActiveOrders[0] || null;
  const isOrderPickedUp = Boolean(
    activeOrder &&
      ["picked up", "in transit"].includes(String(activeOrder.status).trim().toLowerCase())
  );

  // Navegación en dos paradas:
  // 1. Si no retiró el pedido -> Navegar al Local / Sucursal donde retira
  // 2. Si ya lo retiró -> Navegar al Domicilio del Comprador
  const activeNavDestination: [number, number] | null = activeOrder
    ? isOrderPickedUp
      ? activeOrder.destinationCoords?.lat && activeOrder.destinationCoords?.lng
        ? [activeOrder.destinationCoords.lat, activeOrder.destinationCoords.lng]
        : null
      : activeOrder.storeCoords?.lat && activeOrder.storeCoords?.lng
      ? [activeOrder.storeCoords.lat, activeOrder.storeCoords.lng]
      : [STORE_DEFAULT_DERQUI.coords.lat, STORE_DEFAULT_DERQUI.coords.lng]
    : null;

  return (
    <div className="relative h-screen h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-900 flex flex-col font-sans select-none">
      {/* ─── 1. Mapa Interactivo de Fondo (Full Screen) ─── */}
      <div className="absolute inset-0 z-0">
        <InteractiveMap
          center={coords ? [coords.lat, coords.lng] : [STORE_DEFAULT_DERQUI.coords.lat, STORE_DEFAULT_DERQUI.coords.lng]}
          destination={activeNavDestination}
          heading={heading}
          alerts={null}
          activeOrders={myActiveOrders}
          availableOrders={availableOrders}
          previewOrder={myActiveOrders.length === 0 ? previewOrder : null}
          onSelectPreviewOrder={(order) => setPreviewOrder(order)}
          hasActiveOrder={myActiveOrders.length > 0}
          isOrderPickedUp={isOrderPickedUp}
          driverVehicle={driverProfile?.vehicleType || "Motorcycle"}
          isNavigating={isNavigating}
          centerTrigger={mapCenterTrigger}
          currentUserId={driverProfile?.id}
          onSelectOrder={openOrderConversation}
          onTakeOrder={(orderId) => {
            const ord = availableOrders.find((o) => o.id === orderId);
            if (ord) handleTakeOrder(ord);
          }}
        />
      </div>

      {/* ─── 2. Botones Flotantes Superiores (Estándar Rappi / PedidosYa / DiDi) ─── */}
      <DriverTopBar
        driverProfile={driverProfile}
        walletBalance={wallet.balance}
        activeOrder={myActiveOrders[0] || null}
        chatUnreadCount={chatUnreadCount}
        copilotUnreadCount={copilotUnreadCount}
        onOpenSidebar={() => setIsSidebarOpen(true)}
        onOpenCopilot={openCopilotConversation}
        onOpenOrderChat={showMessageInbox}
        onFocusActiveRoute={handleFocusActiveRoute}
        onOpenWallet={() => setIsWalletModalOpen(true)}
        onLogout={() => {
          clearDriverProfile();
          setDriverProfile(null);
          onSwitchToStore();
        }}
        onOpenLoginModal={() => setShowLoginModal(true)}
        hasGps={!!coords}
      />

      {/* ─── 3. Controles Flotantes del Mapa ─── */}
      <div className="absolute top-20 right-3 z-20 flex flex-col gap-2">
        <Button
          size="icon"
          onClick={() => setIsNavigating(!isNavigating)}
          className={cn(
            "h-11 w-11 rounded-2xl shadow-lg transition-all border backdrop-blur-md",
            isNavigating
              ? "bg-[#FFE600] border-yellow-500 text-[#2D3277]"
              : "bg-white border-slate-200 text-[#2D3277]"
          )}
          title="Modo Navegación"
        >
          <Navigation className="w-5 h-5" />
        </Button>
        <Button
          size="icon"
          onClick={() => setMapCenterTrigger((p) => p + 1)}
          className="h-11 w-11 rounded-2xl shadow-lg bg-white border border-yellow-300 text-[#2D3277] active:scale-95 backdrop-blur-md"
          title="Centrar en mi ubicación"
        >
          <Target className="w-5 h-5" />
        </Button>
      </div>

      {/* ─── 4. Panel Deslizable Inferior (Sheet) ─── */}
      <div
        className={cn(
          "absolute left-0 right-0 bottom-0 z-30 transform will-change-transform",
          !isDragging && "transition-transform duration-300"
        )}
        style={{ transform: `translateY(${sheetY})` }}
      >
        <div className="w-full max-w-lg mx-auto h-[80dvh] bg-white rounded-t-[36px] shadow-[0_-16px_40px_rgba(15,23,42,0.2)] flex flex-col relative border-t-2 border-yellow-400">
          {/* Handle de arrastre y Pestañas */}
          <div className="w-full flex flex-col items-center pb-2 select-none">
            <button
              type="button"
              aria-label={isExpanded ? "Minimizar panel" : "Expandir panel"}
              className="w-full flex items-center justify-center pt-3 pb-3 cursor-grab active:cursor-grabbing touch-none"
              onMouseDown={(e) => handleDragStart(e.clientY)}
              onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
              onClick={(event) => {
                if (event.detail === 0 || !didDrag.current) setIsExpanded((expanded) => !expanded);
              }}
            >
              <span className="w-12 h-1.5 rounded-full bg-slate-300" />
            </button>
            <div className="w-full px-4">
              <div className="flex bg-slate-50 rounded-2xl p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab("pedidos");
                    setIsExpanded(true);
                  }}
                  className={cn(
                    "min-w-0 flex-1 h-12 sm:h-10 rounded-xl px-1 transition-all flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-1 text-[10px] sm:text-xs font-black relative",
                    activeTab === "pedidos"
                      ? "bg-[#FFE600] text-[#2D3277] shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Disponibles</span>
                  {availableOrders.length > 0 && (
                    <span className="absolute -top-1 -right-0.5 min-w-4 h-4 px-1 bg-white text-[#2D3277] border border-yellow-300 text-[9px] rounded-full font-bold">
                      {availableOrders.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab("ruta");
                    setIsExpanded(true);
                  }}
                  className={cn(
                    "min-w-0 flex-1 h-12 sm:h-10 rounded-xl px-1 transition-all flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-1 text-[10px] sm:text-xs font-black relative",
                    activeTab === "ruta"
                      ? "bg-[#FFE600] text-[#2D3277] shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <Truck className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Mi Ruta</span>
                  {myActiveOrders.length > 0 && (
                    <span className="absolute -top-1 -right-0.5 min-w-4 h-4 px-1 bg-yellow-100 text-yellow-900 border border-yellow-200 text-[9px] rounded-full font-bold">
                      {myActiveOrders.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab("alerta");
                    setIsExpanded(true);
                  }}
                  className={cn(
                    "min-w-0 flex-1 h-12 sm:h-10 rounded-xl px-1 transition-all flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-1 text-[10px] sm:text-xs font-black relative",
                    activeTab === "alerta"
                      ? "bg-[#FFE600] text-[#2D3277] shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Alertas</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    showMessageInbox();
                  }}
                  className={cn(
                    "min-w-0 flex-1 h-12 sm:h-10 rounded-xl px-1 transition-all flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-1 text-[10px] sm:text-xs font-black relative",
                    activeTab === "mensajes"
                      ? "bg-[#FFE600] text-[#2D3277] shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                  title="Mensajes de pedidos y Copo IA"
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Mensajes</span>
                  {chatUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[9px] rounded-full font-bold flex items-center justify-center shadow animate-pulse">
                      {chatUnreadCount > 9 ? "9+" : chatUnreadCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Contenido scrolleable de la pestaña */}
          <div
            className={cn(
              "flex-1 min-h-0 pt-2 scrollbar-none text-left",
              activeTab === "mensajes"
                ? "flex flex-col overflow-hidden px-0 pb-0"
                : "overflow-y-auto px-4 pb-[max(4rem,calc(env(safe-area-inset-bottom)+2rem))]"
            )}
          >
            {(pendingActions.length > 0 || syncError) && (
              <div role="status" className="mx-4 mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                <p className="font-bold">
                  {pendingActions.length} acción{pendingActions.length === 1 ? "" : "es"} pendiente{pendingActions.length === 1 ? "" : "s"} de confirmación
                </p>
                <p className="mt-1">
                  {syncError || "No se confirma la asignación ni la ganancia hasta que responda el servidor."}
                </p>
                <button type="button" onClick={() => void syncPending()} className="mt-2 font-bold underline">
                  Reintentar sincronización
                </button>
              </div>
            )}
            {activeTab === "pedidos" && (
              <TabPedidosDisponibles
                orders={availableOrders}
                onAcceptOrder={handleTakeOrder}
                pendingOrderIds={pendingActions.map((action) => action.order.id)}
                hasActiveOrder={myActiveOrders.length > 0}
                previewOrderId={previewOrder?.id}
                onPreviewOrder={(order) => setPreviewOrder(order)}
              />
            )}

            {activeTab === "ruta" && (
              <TabMiRuta
                activeOrders={myActiveOrders}
                onPickupOrder={handlePickupOrder}
                onCompleteDelivery={handleCompleteDelivery}
                onOpenOrderChat={openOrderConversation}
                pendingOrderIds={pendingActions.map((action) => action.order.id)}
              />
            )}

            {activeTab === "alerta" && (
              <div className="py-12 text-center space-y-2">
                <ShieldAlert className="w-10 h-10 text-yellow-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-900">Sin incidencias en la zona</h4>
                <p className="text-xs text-slate-500 max-w-[240px] mx-auto">
                  Tránsito fluido en el corredor central de Rosario (Tucumán y San Lorenzo).
                </p>
              </div>
            )}

            {activeTab === "mensajes" && selectedDriverChatOrder && (
                <OrderChatSheet
                  key={selectedDriverChatOrder.id}
                  embedded
                  isOpen
                  onOpenChange={(open) => {
                    if (!open) handleBackFromOrderChat();
                  }}
                  activeOrder={selectedDriverChatOrder}
                  viewerRole="driver"
                  driverName={driverProfile?.firstName || "Repartidor"}
                  clientName={
                    selectedDriverChatOrder.clientName ||
                    selectedDriverChatOrder.customerName
                  }
                  deliveryAddress={selectedDriverChatOrder.deliveryAddress}
                  onBackToOrdersHub={handleBackFromOrderChat}
                  backButtonLabel={chatOriginTab === "ruta" ? "Volver a Mi Ruta" : "Volver a mensajes"}
                />
            )}
            <div className={cn(
              "min-h-0 flex-1 flex-col",
              activeTab === "mensajes" && isCopilotConversationOpen ? "flex" : "hidden"
            )}>
              <DriverCopilotSheet
                onBack={showMessageInbox}
                activeOrdersCount={myActiveOrders.length}
              />
            </div>
            {activeTab === "mensajes" && !selectedDriverChatOrder && !isCopilotConversationOpen && (
                <CentroMensajeriaDriverSheet
                  isOpen
                  orders={myActiveOrders}
                  onSelectOrderChat={openOrderConversation}
                  onSelectCopilot={openCopilotConversation}
                />
            )}
          </div>
        </div>
      </div>

      {/* ─── 5. Modal de Identificación del Repartidor (Requerido para operar como repartidor) ─── */}
      <ModalDriverAuth
        isOpen={showLoginModal}
        onOpenChange={(open) => {
          setShowLoginModal(open);
          if (!open && !loadDriverProfile()) {
            onSwitchToStore();
          }
        }}
        pendingOrder={pendingAcceptOrder}
        onSuccess={(id) => {
          const prof = loadDriverProfile();
          setDriverProfile(prof);
          if (pendingAcceptOrder) {
            confirmOrderAfterLogin(id);
            setActiveTab("ruta");
            setIsExpanded(true);
          }
        }}
      />

      {/* ─── 7. Modal Cartera / Billetera Repartidor ─── */}
      <ModalCarteraRepartidor
        isOpen={isWalletModalOpen}
        onOpenChange={setIsWalletModalOpen}
        wallet={wallet}
      />

      {/* ─── 8. Sidebar Unificado DiDi / PedidosYa (Captura 1) ─── */}
      <SidebarGeneral
        isOpen={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        currentMode="driver"
        onSwitchMode={(mode) => {
          if (mode === "store") onSwitchToStore();
        }}
        driverProfile={driverProfile}
        walletBalance={wallet.balance}
        onOpenOrders={() => {
          setActiveTab("ruta");
          setIsExpanded(true);
        }}
        onOpenWallet={() => setIsWalletModalOpen(true)}
        onOpenMarkets={() => setIsMarketsOpen(true)}
        onLogout={() => {
          clearDriverProfile();
          setDriverProfile(null);
          onSwitchToStore();
        }}
      />

      {/* ─── 9. Modal Mercados / Ecosistema Multitienda Cobro Fácil (Captura 4) ─── */}
      <ModalMercados
        isOpen={isMarketsOpen}
        onOpenChange={setIsMarketsOpen}
        selectedCompanyId="frigorifico-maciel"
        onSelectCompany={(company) => {
          setIsMarketsOpen(false);
          const url = new URL(window.location.href);
          url.searchParams.set("tienda", company.slug || company.id);
          window.history.replaceState({}, "", url);
          onSwitchToStore();
        }}
      />
    </div>
  );
}
export default RepartidorPiramidal;
