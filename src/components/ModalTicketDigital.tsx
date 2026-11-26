"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { authHeaders } from "@/lib/clientAuth";

interface ModalTicketDigitalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  ticketIdOrOrderId?: string | null;
  order?: any | null;
  viewerRole?: "Client" | "Driver";
}

export function ModalTicketDigital({
  isOpen,
  onOpenChange,
  ticketIdOrOrderId,
  order,
  viewerRole = "Client",
}: ModalTicketDigitalProps) {
  const [ticketData, setTicketData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const formatMoney = (val: number) =>
    "$" +
    (Number(val) || 0).toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  useEffect(() => {
    if (!isOpen) return;

    const targetId = ticketIdOrOrderId || order?.ticketId || order?.ticket_id || order?.id;
    if (!targetId) return;

    setLoading(true);

    // Intentar buscar los datos del ticket desde PostgreSQL
    fetch(`/api/orders?status=all`, { headers: authHeaders(viewerRole) })
      .then((r) => r.json())
      .then((ordersList) => {
        if (Array.isArray(ordersList)) {
          const found = ordersList.find(
            (o) =>
              String(o.ticketId) === String(targetId) ||
              String(o.id) === String(targetId)
          );
          if (found) {
            setTicketData(found);
            setLoading(false);
            return;
          }
        }
        if (order) setTicketData(order);
        setLoading(false);
      })
      .catch(() => {
        if (order) setTicketData(order);
        setLoading(false);
      });
  }, [isOpen, ticketIdOrOrderId, order, viewerRole]);

  const displayOrder = ticketData || order;
  const ticketNum =
    displayOrder?.ticketId ||
    displayOrder?.ticket_id ||
    ticketIdOrOrderId ||
    (displayOrder?.id ? `109${displayOrder.id.replace(/[^0-9]/g, "").slice(-4)}` : "1093883");

  const fechaDisplay = displayOrder?.createdAt
    ? new Date(displayOrder.createdAt)
        .toISOString()
        .replace("T", " ")
        .slice(0, 19)
    : "2026-11-20 09:54:56";

  const pagoDisplay = "Web";

  const items = Array.isArray(displayOrder?.items) ? displayOrder.items : [];
  const total = displayOrder?.total || 19980;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-[390px] bg-white text-slate-900 border-0 rounded-[28px] p-6 shadow-2xl shadow-black/80 font-sans select-none">
        {/* Barra superior de arrastre estilo sheet */}
        <div className="w-9 h-1 bg-slate-300 rounded-full mx-auto -mt-1 mb-4" />

        <DialogHeader className="text-left pb-2">
          <DialogTitle className="text-2xl font-black text-slate-950 tracking-tight">
            Ticket #{ticketNum}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5 text-sm">
          {/* Metadatos del Ticket */}
          <div className="space-y-2 pb-3 text-slate-500 font-medium text-[13.5px]">
            <div className="flex justify-between items-center">
              <span>Cuándo</span>
              <span className="font-bold text-slate-900 font-mono">
                {fechaDisplay}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Modalidad</span>
              <span className="font-bold text-slate-900">
                {String(displayOrder?.deliveryType || displayOrder?.tipo_entrega || "").toLowerCase() === "pickup"
                  ? "🏪 Retiro en Tienda"
                  : "🛵 Envío a Domicilio"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Pago</span>
              <span className="font-bold text-slate-900">{pagoDisplay}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Cajero</span>
              <span className="text-slate-400 font-bold">—</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Caja</span>
              <span className="text-slate-400 font-bold">—</span>
            </div>
          </div>

          {/* Cortes y Productos (Con scroll controlado si el ticket es muy largo) */}
          <div className="border-t border-slate-100 py-3 space-y-2.5 max-h-[35vh] overflow-y-auto pr-1">
            {items.length > 0 ? (
              items.map((it: any, idx: number) => {
                const sub = (it.price || it.precio || 0) * (it.quantity || it.cantidad || 1);
                return (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-[13.5px] text-slate-800"
                  >
                    <span>
                      {it.name || it.nombre} · {it.quantity || it.cantidad}
                    </span>
                    <span className="font-bold text-slate-950 font-mono">
                      {formatMoney(sub)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex justify-between items-center text-[13.5px] text-slate-800">
                <span>Cortes cárnicos y mercadería</span>
                <span className="font-bold text-slate-950 font-mono">
                  {formatMoney(total)}
                </span>
              </div>
            )}
            {items.length > 4 && (
              <p className="text-[10px] text-slate-400 text-center pt-1 font-medium">
                ↕ Deslizá para ver todos los {items.length} ítems
              </p>
            )}
          </div>

          {/* Fila Total */}
          <div className="flex justify-between items-center pt-2 text-base font-extrabold text-slate-950 border-t border-slate-100">
            <span className="text-slate-500 font-medium">Total</span>
            <span className="font-black text-xl font-mono">
              {formatMoney(total)}
            </span>
          </div>

          {/* Botón Cerrar */}
          <div className="pt-4">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full h-12 bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-sm rounded-2xl active:scale-98 transition-all"
            >
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
