"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  User,
  ShieldCheck,
  Bike,
  ArrowLeft,
  ArrowDown,
} from "lucide-react";
import { loadClientProfile, loadDriverProfile } from "../motor/driverService";
import { ModalTicketDigital } from "@/components/ModalTicketDigital";
import { OrderChatMessageList } from "./OrderChatMessageList";
import { authHeaders } from "@/lib/clientAuth";

export type ChatAuthorRole = "driver" | "client" | "company";

export interface OrderChatMessage {
  id: string;
  orderId: string;
  authorRole: ChatAuthorRole;
  authorName: string;
  content: string;
  timestamp: string;
  createdAt?: string;
  isRead?: boolean;
}

interface OrderChatSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  embedded?: boolean;
  activeOrder?: {
    id: string;
    status?: string;
    clientName?: string;
    deliveryAddress?: string;
    ticketId?: string;
    ticket_id?: string;
  } | null;
  driverName?: string;
  clientName?: string;
  viewerRole?: "client" | "driver";
  defaultRole?: "client" | "driver"; // compatibilidad
  deliveryAddress?: string;
  onBackToOrdersHub?: () => void;
  backButtonLabel?: string;
  conversationTitle?: string;
  reserveCloseButton?: boolean;
}

export function OrderChatSheet({
  isOpen,
  onOpenChange,
  embedded = false,
  activeOrder,
  driverName = "Lucas Motomensajero",
  clientName,
  viewerRole,
  defaultRole = "client",
  deliveryAddress,
  onBackToOrdersHub,
  backButtonLabel: customBackButtonLabel,
  conversationTitle,
  reserveCloseButton = false,
}: OrderChatSheetProps) {
  // El rol real del usuario que visualiza el chat
  const effectiveRole: "client" | "driver" = viewerRole || defaultRole;
  const isDriverViewer = effectiveRole === "driver";
  const orderId = activeOrder?.id || "RF-7420";
  const ticketId = activeOrder?.ticketId || activeOrder?.ticket_id || orderId;
  const clientId = !isDriverViewer ? loadClientProfile()?.userId : undefined;
  const storageKey = `rf_client_chat_v2:${encodeURIComponent(clientId || "")}:${encodeURIComponent(orderId)}`;

  const [messages, setMessages] = useState<OrderChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);
  const [hasNewMessagesBelow, setHasNewMessagesBelow] = useState(false);
  const isInitialLoadRef = useRef(true);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const chatContext = useRef({ isOpen, orderId, isDriverViewer });
  chatContext.current = { isOpen, orderId, isDriverViewer };

  // Al abrir el chat, despachar de inmediato la lectura para borrar el contador sin esperar
  useEffect(() => {
    if (isOpen && orderId) {
      window.dispatchEvent(new CustomEvent("rf-chat-read", { detail: { orderId } }));
    }
  }, [isOpen, orderId]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNear = distanceToBottom < 75;
    isNearBottomRef.current = isNear;
    if (isNear) {
      setHasNewMessagesBelow(false);
    }
  };

  // Auto-scroll al final del chat con soporte para scroll suave
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior,
      });
      isNearBottomRef.current = true;
      setHasNewMessagesBelow(false);
    }
  };

  // Cargar mensajes persistentes y sincronizar con backend PostgreSQL
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    let fetching = false;
    const controller = new AbortController();
    const role = isDriverViewer ? "Driver" : "Client";
    const authorization = authHeaders(role).Authorization;
    setMessages([]);
    setInputText("");
    setLoadError(null);
    setSendError(null);

    // 1. Cargar caché local primero
    try {
      const canReadCache = !isDriverViewer && clientId && authHeaders("Client").Authorization;
      const raw = canReadCache ? localStorage.getItem(storageKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (error) {
      console.warn("No se pudo leer el historial del chat:", error);
    }

    // 2. Sincronizar con API cloud /api/chat/[orderId]
    const fetchCloudMessages = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const markRead = document.visibilityState === "visible";
        const res = await fetch(`/api/chat/${encodeURIComponent(orderId)}${markRead ? "?read=1" : ""}`, {
          cache: "no-store",
          headers: authorization ? { Authorization: authorization } : {},
          signal: controller.signal,
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403 || res.status === 404) {
            if (active) setMessages([]);
            throw new Error("La conversación no está disponible para esta sesión.");
          }
          throw new Error("No se pudo actualizar el chat. Los mensajes guardados pueden estar desactualizados.");
        }
        const data = await res.json();
        if (!data.success || !Array.isArray(data.messages)) throw new Error("La respuesta del chat no es válida.");
        if (active && authHeaders(role).Authorization === authorization) {
          setMessages(data.messages);
          setLoadError(null);
          try {
            if (!isDriverViewer && clientId) localStorage.setItem(storageKey, JSON.stringify(data.messages));
          } catch (error) {
            console.warn("No se pudo guardar el historial del chat:", error);
          }
          if (markRead) {
            window.dispatchEvent(new CustomEvent("rf-chat-read", { detail: { orderId } }));
          }
        }
      } catch (err) {
        if (active && !controller.signal.aborted) {
          console.warn("No se pudo actualizar el chat:", err);
          setLoadError(err instanceof Error ? err.message : "No se pudo actualizar el chat.");
        }
      } finally {
        fetching = false;
      }
    };

    fetchCloudMessages();
    const interval = setInterval(fetchCloudMessages, 2000);

    // 3. Escucha reactiva entre pestañas (Storage Event)
    const handleStorageChange = (e: StorageEvent) => {
      if (!isDriverViewer && e.key === storageKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        } catch (error) {
          console.warn("No se pudo leer el historial del chat:", error);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    const handleIdentityChange = () => {
      if (authHeaders(role).Authorization !== authorization) {
        active = false;
        controller.abort();
        setMessages([]);
        onOpenChangeRef.current(false);
      }
    };
    window.addEventListener(isDriverViewer ? "repartofacil-driver-auth" : "repartofacil-client-auth", handleIdentityChange);
    window.addEventListener("storage", handleIdentityChange);

    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(isDriverViewer ? "repartofacil-driver-auth" : "repartofacil-client-auth", handleIdentityChange);
      window.removeEventListener("storage", handleIdentityChange);
    };
  }, [isOpen, orderId, storageKey, isDriverViewer, clientId]);

  useEffect(() => {
    if (!isOpen) return;

    const currentLen = messages.length;
    const prevLen = prevMessagesLengthRef.current;

    // 1. Carga inicial: siempre scrollear abajo para ver los últimos mensajes
    if (isInitialLoadRef.current && currentLen > 0) {
      isInitialLoadRef.current = false;
      prevMessagesLengthRef.current = currentLen;
      setTimeout(() => scrollToBottom("auto"), 50);
      return;
    }

    // 2. Si es una actualización periódica (polling) sin mensajes nuevos: NO alterar el scroll del usuario
    if (currentLen === prevLen) {
      return;
    }

    // 3. Si ingresaron mensajes nuevos:
    if (currentLen > prevLen) {
      prevMessagesLengthRef.current = currentLen;
      // Solo auto-scrollear si el usuario ya estaba al fondo
      if (isNearBottomRef.current) {
        setTimeout(() => scrollToBottom("smooth"), 50);
      } else {
        // Si el usuario subió para leer el historial: RESPETAR SU LECTURA y mostrar indicador flotante
        setHasNewMessagesBelow(true);
      }
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      isInitialLoadRef.current = true;
      isNearBottomRef.current = true;
      setHasNewMessagesBelow(false);
    }
  }, [isOpen, orderId]);

  // Nombre resuelto del autor según su cuenta real
  const getMyAuthorName = () => {
    if (effectiveRole === "driver") {
      const dp = loadDriverProfile();
      return dp?.firstName || driverName || "Lucas Motomensajero";
    } else {
      const cp = loadClientProfile();
      return cp?.displayName || clientName || activeOrder?.clientName || "Cliente";
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;
    const role = isDriverViewer ? "Driver" : "Client";
    const authorization = authHeaders(role).Authorization;
    const stillCurrent = () => chatContext.current.isOpen &&
      chatContext.current.orderId === orderId &&
      chatContext.current.isDriverViewer === isDriverViewer &&
      authHeaders(role).Authorization === authorization;

    const myName = getMyAuthorName();
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    const newMsg: OrderChatMessage = {
      id: `msg-${Date.now()}`,
      orderId,
      authorRole: effectiveRole,
      authorName: myName,
      content: text,
      timestamp: timeStr,
    };

    setSendError(null);
    setIsSending(true);
    try {
      const response = await fetch(`/api/chat/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) },
        body: JSON.stringify(newMsg),
      });
      if (!response.ok) {
        throw new Error(response.status === 401 || response.status === 403
          ? "Tu sesión no permite enviar mensajes. Volvé a iniciar sesión."
          : "No se pudo enviar el mensaje. Intentá nuevamente.");
      }
      const data = await response.json();
      if (!data.success || !data.message) throw new Error("El servidor no confirmó el mensaje.");
      if (!stillCurrent()) return;
      setMessages((current) => {
        const updated = current.some((message) => message.id === data.message.id)
          ? current
          : [...current, data.message];
        try {
          if (!isDriverViewer && clientId) localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (error) {
          console.warn("No se pudo guardar el chat local:", error);
        }
        return updated;
      });
      setInputText("");
      isNearBottomRef.current = true;
      setHasNewMessagesBelow(false);
      setTimeout(() => scrollToBottom("smooth"), 50);
    } catch (err) {
      console.warn("No se pudo enviar el mensaje:", err);
      if (stillCurrent()) setSendError(err instanceof Error ? err.message : "No se pudo enviar el mensaje. Intentá nuevamente.");
    } finally {
      setIsSending(false);
    }
  };

  const isClientViewer = effectiveRole === "client";
  const displayDestAddress = deliveryAddress || activeOrder?.deliveryAddress || "Tucumán 2130, Rosario";
  const interlocutorName = isDriverViewer
    ? (clientName || activeOrder?.clientName || (activeOrder as any)?.customerName || "Cliente")
    : (driverName || (activeOrder as any)?.driverName || "Repartidor");
  const numericTicket = activeOrder?.ticketId || activeOrder?.ticket_id;
  const hasNumericTicket = numericTicket && /^\d+$/.test(String(numericTicket).replace(/^#?RF-?/i, ""));
  const cleanTicketStr = hasNumericTicket
    ? String(numericTicket).replace(/^#?RF-?/i, "")
    : String(activeOrder?.id || orderId || "").replace(/^#?RF-?/i, "").slice(0, 5);
  const ticketLabel = hasNumericTicket ? `Ticket #${cleanTicketStr}` : `#RF-${cleanTicketStr}`;
  const backButtonLabel = customBackButtonLabel || (isDriverViewer ? "Volver a mensajes" : embedded ? "Volver al pedido" : "Volver a mensajes");

  const chatContent = (
    <>
        {/* Header Scoped: Título con nombre del cliente y dirección, punto verde EN VIVO */}
        <SheetHeader
          className={`flex flex-row items-center justify-between gap-2 border-b p-3 sm:p-4 ${reserveCloseButton ? "pr-12" : ""} ${
            embedded || isDriverViewer
              ? "border-slate-100 bg-white"
              : "border-slate-800 bg-slate-900"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2 flex-1">
            {onBackToOrdersHub && (
              <button
                type="button"
                onClick={onBackToOrdersHub}
                autoFocus={reserveCloseButton}
                aria-label={backButtonLabel}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all ${
                  isDriverViewer
                    ? "border-yellow-300 bg-yellow-50 text-yellow-900 hover:bg-yellow-100"
                    : embedded
                    ? "border-slate-200 text-slate-600 hover:bg-slate-100"
                    : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
                title={backButtonLabel}
              >
                <ArrowLeft
                  className={`h-4 w-4 ${
                    isDriverViewer ? "text-yellow-800" : embedded ? "text-blue-600" : "text-emerald-400"
                  }`}
                />
              </button>
            )}
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl shadow-xs ${
                isDriverViewer
                  ? "bg-yellow-100 text-yellow-900"
                  : embedded
                  ? "bg-blue-50 text-blue-600"
                  : isClientViewer
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-emerald-500/20 text-emerald-400"
              }`}
            >
              {isClientViewer ? <Bike className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-1.5">
                {embedded ? (
                  <h2 className="truncate text-sm font-black text-slate-900" title={interlocutorName}>
                    {conversationTitle || interlocutorName}
                  </h2>
                ) : (
                  <SheetTitle className={`text-sm font-black truncate ${isDriverViewer ? "text-slate-900" : "text-white"}`} title={interlocutorName}>
                    {conversationTitle || interlocutorName}
                  </SheetTitle>
                )}
              </div>
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
                <span
                  title={displayDestAddress}
                  className="truncate font-semibold text-slate-600 max-w-[130px] sm:max-w-[200px]"
                >
                  📍 {displayDestAddress}
                </span>
                {isDriverViewer && (
                  <button
                    type="button"
                    onClick={() => setIsTicketModalOpen(true)}
                    className="flex shrink-0 items-center gap-1 rounded-md border border-yellow-300 bg-yellow-50 px-1.5 py-0.5 text-[9.5px] font-bold text-yellow-900 hover:bg-yellow-100 transition-all"
                    title="Ver Ticket Digital Cobro Fácil"
                  >
                    <span>🧾 {ticketLabel} ↗</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Punto verde pulsante de estado en vivo (sin textos innecesarios) */}
          <div className="flex items-center gap-1.5 shrink-0 pl-1" title="Canal de chat en vivo">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white" />
            </span>
          </div>
        </SheetHeader>

        {!isDriverViewer && (
          <p className={`border-b px-4 py-2 text-xs ${embedded ? "border-blue-100 bg-blue-50 text-blue-800" : "border-slate-800 bg-slate-900 text-slate-300"}`}>
            {["delivered", "cancelled", "cancelled_by_client", "cancelled_timeout", "rejected"].includes(String(activeOrder?.status || "").toLowerCase())
              ? "Conversación entre comprador y empresa. Se conservan los mensajes anteriores."
              : "Comparten este chat el comprador, la empresa y el repartidor asignado hasta la entrega."}
          </p>
        )}

        {/* Barra de perfil activo (Auditoría de Identidad) */}
        <div
          className={`flex items-center justify-between border-b px-4 py-1.5 text-[11px] ${
            embedded
              ? "border-slate-100 bg-white text-slate-500"
              : isDriverViewer
              ? "border-slate-100 bg-white text-slate-500"
              : "border-slate-800/80 bg-slate-950/80 text-slate-400"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck
              className={`h-3.5 w-3.5 ${
                embedded ? "text-blue-600" : isDriverViewer ? "text-yellow-800" : "text-emerald-400"
              }`}
            />
            <span>
              Conectado como:{" "}
              <strong className={embedded || isDriverViewer ? "text-slate-900" : "text-white"}>
                {getMyAuthorName()} ({isClientViewer ? "Comprador" : "Repartidor"})
              </strong>
            </span>
          </div>
          <span
            className={`text-[10px] ${
              embedded || isDriverViewer ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Cobro Fácil Sync
          </span>
        </div>

        {loadError && <p role="status" className={`px-3 pt-2 text-xs ${embedded || isDriverViewer ? "text-amber-800" : "text-amber-300"}`}>{loadError}</p>}
        <div className="relative min-h-0 flex-1 flex flex-col">
          <OrderChatMessageList
            messages={messages}
            effectiveRole={effectiveRole}
            embedded={embedded && !isDriverViewer}
            scrollRef={scrollRef}
            onScroll={handleScroll}
          />
          {hasNewMessagesBelow && (
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black shadow-lg flex items-center gap-1.5 active:scale-95 transition-all animate-bounce"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Mensajes nuevos abajo ↓</span>
            </button>
          )}
        </div>

        {/* Input de Mensaje Scoped a la Cuenta Actual */}
        {sendError && <p role="alert" className="px-3 pt-1 text-xs text-red-700">{sendError}</p>}
        <form
          onSubmit={handleSendMessage}
          className={`flex items-center gap-2 border-t p-3 ${
            embedded || isDriverViewer
              ? "border-slate-200 bg-white"
              : "border-slate-800 bg-slate-950"
          }`}
        >
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isClientViewer
                ? "Escribir al grupo..."
                : `Escribir mensaje al cliente (${clientName || activeOrder?.clientName || "Cliente"})...`
            }
            className={
              isDriverViewer
                ? "h-10 rounded-xl border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:border-yellow-400 focus:ring-yellow-400"
                : embedded
                ? "h-10 rounded-xl border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500"
                : "h-10 rounded-xl border-slate-800 bg-slate-900 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500"
            }
          />
          <Button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className={`h-10 w-10 p-0 rounded-xl text-white shrink-0 shadow-lg active:scale-95 transition-all ${
              isDriverViewer
                ? "bg-[#FFE600] hover:bg-yellow-300 text-[#2D3277] shadow-yellow-500/20 disabled:opacity-40"
                : embedded || isClientViewer
                ? "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 disabled:opacity-40"
                : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 disabled:opacity-40"
            }`}
            title="Enviar mensaje"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>

        {/* Modal Ticket Digital Cobro Fácil */}
        {(!embedded || isDriverViewer) && (
          <ModalTicketDigital
            isOpen={isTicketModalOpen}
            onOpenChange={setIsTicketModalOpen}
            order={activeOrder}
            viewerRole={isDriverViewer ? "Driver" : "Client"}
          />
        )}
    </>
  );

  if (embedded) {
    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">{chatContent}</div>;
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        className={`flex h-full w-full flex-col p-0 sm:max-w-md ${
          isDriverViewer
            ? "border-l border-slate-200 bg-white text-slate-900"
            : "border-l border-slate-800 bg-slate-900 text-slate-100"
        }`}
      >
        {chatContent}
      </SheetContent>
    </Sheet>
  );
}
