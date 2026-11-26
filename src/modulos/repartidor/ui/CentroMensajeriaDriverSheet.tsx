"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Search,
  Store,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { DriverOrder } from "../motor/tipos";
import { useDriverChatSummaries } from "../motor/useDriverChatSummaries";

interface CentroMensajeriaDriverSheetProps {
  isOpen: boolean;
  orders: DriverOrder[];
  onSelectOrderChat: (order: DriverOrder) => void;
  onSelectCopilot: () => void;
}

export function CentroMensajeriaDriverSheet({
  isOpen,
  orders = [],
  onSelectOrderChat,
  onSelectCopilot,
}: CentroMensajeriaDriverSheetProps) {
  const [searchFilter, setSearchFilter] = useState("");
  const { summaries: chatSummaries, error } = useDriverChatSummaries(isOpen, orders);

  // Filtrado por buscador
  const filteredConversations = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    if (!q) return chatSummaries;

    return chatSummaries.filter((c) => {
      const name = (c.order.clientName || c.order.customerName || "").toLowerCase();
      const id = (c.order.id || "").toLowerCase();
      const branch = (c.order.branch || "").toLowerCase();
      const msg = c.lastMessage.toLowerCase();
      return (
        name.includes(q) ||
        id.includes(q) ||
        branch.includes(q) ||
        msg.includes(q)
      );
    });
  }, [chatSummaries, searchFilter]);

  const showCopilotContact = ["copo", "ia", "asistente", "ruta"].some((term) =>
    term.includes(searchFilter.toLowerCase().trim())
  ) || !searchFilter.trim();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white text-slate-900 font-sans select-none">
        {/* Buscador de Chats (Estilo WhatsApp) */}
        <div className="p-3 border-b border-slate-100 bg-slate-50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Buscar cliente, pedido, comercio o Copo..."
              className="pl-9 h-9 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl text-xs focus:ring-yellow-400"
            />
          </div>
        </div>

        {/* Lista de Conversaciones (Tipo WhatsApp - El nuevo primero) */}
        {error && <p role="status" className="bg-amber-50 px-3 py-2 text-xs text-amber-950">{error}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredConversations.length === 0 && !showCopilotContact ? (
            <div className="py-16 text-center space-y-3 px-6">
              <div className="w-12 h-12 rounded-2xl bg-yellow-50 text-yellow-700 mx-auto flex items-center justify-center border border-yellow-200">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Sin conversaciones activas</h4>
              <p className="text-xs text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                Cuando aceptes pedidos en tu ruta, los canales de mensajería privada con cada cliente aparecerán acá ordenados automáticamente por el mensaje más reciente.
              </p>
            </div>
          ) : (
            <>
            {showCopilotContact && (
              <button
                type="button"
                onClick={onSelectCopilot}
                className="w-full p-3.5 flex items-start gap-3 hover:bg-yellow-50 active:bg-yellow-100 transition-colors text-left group"
              >
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full bg-yellow-100 border border-yellow-300 flex items-center justify-center text-[#2D3277] shadow-sm group-hover:border-yellow-500 transition-colors">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-black text-xs text-slate-900 truncate">Copo · Asistente IA</span>
                    <Badge className="bg-yellow-100 text-yellow-900 border border-yellow-200 text-[9px] font-bold px-1.5 py-0 shrink-0">
                      IA
                    </Badge>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mb-1">
                    Asistente de prueba · respuestas simuladas
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-600 truncate">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-700 shrink-0" />
                    <span className="truncate">Consultá el estado de tus entregas</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-yellow-800 shrink-0 self-center transition-colors" />
              </button>
            )}
            {filteredConversations.map((item) => {
              const client =
                item.order.clientName || item.order.customerName || "Cliente";
              const initials = client
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase() || "C";
              const store = item.order.branch || "Sucursal";
              const rawTicket = item.order.ticketId || item.order.id || "";
              const cleanTicket = String(rawTicket).replace(/^#?RF-?/i, "");
              const shortBadge = cleanTicket.length > 6 ? `RF-${cleanTicket.slice(0, 5)}` : `RF-${cleanTicket}`;

              return (
                <button
                  key={item.order.id}
                  type="button"
                  onClick={() => onSelectOrderChat(item.order)}
                  className="w-full p-3.5 flex items-start gap-3 hover:bg-yellow-50 active:bg-yellow-100 transition-colors text-left group"
                >
                  {/* Avatar con Iniciales y Punto En Línea */}
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-yellow-100 border border-yellow-300 flex items-center justify-center font-black text-sm text-[#2D3277] shadow-sm group-hover:border-yellow-500 transition-colors">
                      {initials}
                    </div>
                  </div>

                  {/* Detalle de la Conversación */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-black text-xs text-slate-900 truncate">
                          {client}
                        </span>
                        <Badge className="bg-yellow-100 text-yellow-900 border border-yellow-200 text-[9px] font-mono font-bold px-1.5 py-0 shrink-0">
                          #{shortBadge}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium shrink-0 font-mono">
                        {item.lastTime}
                      </span>
                    </div>

                    {/* Comercio y Destino */}
                    <div className="text-[10px] text-slate-500 flex items-center gap-1 truncate mb-1">
                      <Store className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{store}</span>
                    </div>

                    {/* Último Mensaje Snippet (Estilo WhatsApp) */}
                    <div className="flex items-center gap-1 text-[11px] text-slate-600 truncate">
                      <span className="truncate">
                        <strong className="text-slate-700 font-semibold">
                          {item.lastSender}:
                        </strong>{" "}
                        {item.lastMessage}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-yellow-800 shrink-0 self-center transition-colors" />
                </button>
              );
            })}
            </>
          )}
        </div>

    </div>
  );
}
