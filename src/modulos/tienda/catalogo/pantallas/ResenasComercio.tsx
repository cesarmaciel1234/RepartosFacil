"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Resena = { estrellas: number; comentario: string; created_at: string };

export function ResenasComercio({ empresaId, open, onOpenChange }: {
  empresaId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setResenas([]);
    setError("");
    setLoading(true);
    fetch(`/api/resenas/publicas?empresaId=${encodeURIComponent(empresaId)}`, {
      cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.resenas)) throw new Error(data.error || "No se pudieron cargar las reseñas.");
      if (!controller.signal.aborted) setResenas(data.resenas);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudieron cargar las reseñas.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, empresaId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reseñas del comercio</DialogTitle>
          <DialogDescription>Opiniones de compradores con pedidos entregados. Se muestran las 50 más recientes.</DialogDescription>
        </DialogHeader>
        {loading && <p role="status">Cargando reseñas…</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {!loading && !error && !resenas.length && <p className="text-sm text-slate-500">Todavía no hay reseñas.</p>}
        <div className="max-h-[50vh] space-y-3 overflow-y-auto">
          {resenas.map((resena, index) => (
            <article key={index} className="rounded-xl border border-slate-200 p-3">
              <p className="font-bold text-amber-700">{resena.estrellas} / 5 ★</p>
              {resena.comentario && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{resena.comentario}</p>}
            </article>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
