"use client";

import React from "react";
import { VistaMercadosEmpresas } from "../ui/VistaMercadosEmpresas";
import type { PantallaComerciosProps } from "./tipos";

export function SupermercadosTienda(props: PantallaComerciosProps) {
  return (
    <section className="mx-auto w-full max-w-3xl space-y-4">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Explorar</p>
        <h1 className="text-2xl font-black text-slate-900">Súper cerca tuyo</h1>
        <p className="text-sm text-slate-500">Supermercados y minimercados en tu zona.</p>
      </header>
      <VistaMercadosEmpresas
        {...props}
        categoryFilter={["supermercados", "minimercados"]}
        showCategories={false}
        emptyTitle="Todavía no hay supermercados disponibles."
        emptyDescription="Estamos incorporando nuevos comercios a tu zona."
      />
    </section>
  );
}
