"use client";

import React from "react";
import { VistaMercadosEmpresas } from "../ui/VistaMercadosEmpresas";
import type { PantallaComerciosProps } from "./tipos";

export function PromocionesTienda(props: PantallaComerciosProps) {
  return (
    <section className="mx-auto w-full max-w-3xl space-y-4">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Para aprovechar</p>
        <h1 className="text-2xl font-black text-slate-900">Promociones</h1>
        <p className="text-sm text-slate-500">Ofertas y beneficios disponibles en tus comercios.</p>
      </header>
      <VistaMercadosEmpresas
        {...props}
        promotionsOnly
        showCategories={false}
        emptyTitle="Por ahora no hay promociones disponibles."
        emptyDescription="Volvé a Inicio para explorar todos los comercios."
      />
    </section>
  );
}
