"use client";

import React from "react";
import { VistaMercadosEmpresas } from "../ui/VistaMercadosEmpresas";
import type { PantallaComerciosProps } from "./tipos";

export function InicioTienda(props: PantallaComerciosProps) {
  return (
    <VistaMercadosEmpresas
      {...props}
      emptyTitle="Todavía no hay comercios disponibles."
      emptyDescription="Volvé a intentarlo en unos minutos."
    />
  );
}
