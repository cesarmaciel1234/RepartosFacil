"use client";

import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { authHeaders } from "@/lib/clientAuth";

interface ResenaPedidoDialogProps {
  order: { id: string } | null;
  onClose: () => void;
}

export function ResenaPedidoDialog({ order, onClose }: ResenaPedidoDialogProps) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const activeOrder = useRef<string | null>(null);
  const pendingSubmit = useRef<AbortController | null>(null);
  activeOrder.current = order?.id || null;

  useEffect(() => {
    if (!order) return;
    const controller = new AbortController();
    const authorization = authHeaders("Client").Authorization;
    setStars(0);
    setComment("");
    setSaved(false);
    setError("");
    setLoaded(false);
    setLoading(true);
    const onAuthChange = () => {
      if (authHeaders("Client").Authorization !== authorization) onClose();
    };
    window.addEventListener("repartofacil-client-auth", onAuthChange);
    window.addEventListener("storage", onAuthChange);
    fetch(`/api/resenas?pedidoId=${encodeURIComponent(order.id)}`, {
      headers: authHeaders("Client"), cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo consultar la reseña.");
      if (data.resena && (typeof data.resena.comentario !== "string" ||
          !Number.isInteger(data.resena.estrellas) || data.resena.estrellas < 1 || data.resena.estrellas > 5)) {
        throw new Error("La reseña recibida no es válida.");
      }
      if (!controller.signal.aborted && authHeaders("Client").Authorization === authorization) {
        setLoaded(true);
        if (data.resena) {
          setStars(data.resena.estrellas);
          setComment(data.resena.comentario);
          setSaved(true);
        }
      }
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo consultar la reseña.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => {
      controller.abort();
      pendingSubmit.current?.abort();
      window.removeEventListener("repartofacil-client-auth", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, [order, onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!order || !stars || loading || !loaded || pendingSubmit.current) return;
    const authorization = authHeaders("Client").Authorization;
    const orderId = order.id;
    const isCurrent = () => activeOrder.current === orderId && authHeaders("Client").Authorization === authorization;
    const controller = new AbortController();
    pendingSubmit.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/resenas", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders("Client") },
        body: JSON.stringify({ pedidoId: order.id, estrellas: stars, comentario: comment }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar la reseña.");
      if (isCurrent()) setSaved(true);
    } catch (cause) {
      if (!controller.signal.aborted && isCurrent()) {
        setError(cause instanceof Error ? cause.message : "No se pudo guardar la reseña.");
      }
    } finally {
      if (pendingSubmit.current === controller) pendingSubmit.current = null;
      if (isCurrent()) setLoading(false);
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Calificar comercio</DialogTitle>
          <DialogDescription>Tu puntuación y comentario serán públicos. Solo podés calificar una vez por pedido entregado.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={loading || saved}>
            <legend className="text-sm font-bold">Estrellas</legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value} className="flex cursor-pointer items-center gap-1">
                  <input type="radio" name="estrellas" value={value} checked={stars === value} onChange={() => setStars(value)} />
                  {value} ★
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-bold">
            Comentario opcional
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500}
              disabled={loading || saved} className="mt-1 w-full rounded-xl border border-slate-300 p-3 font-normal" />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {saved && <p role="status" className="text-sm text-green-700">Ya calificaste este pedido.</p>}
          {!saved && <Button type="submit" disabled={!stars || loading || !loaded}>Enviar reseña</Button>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
