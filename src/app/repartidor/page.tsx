"use client";

import React, { Suspense } from "react";
import { useRouter } from "next/navigation";
import { RepartidorPiramidal } from "@/modulos/repartidor/RepartidorPiramidal";

export default function RepartidorPage() {
  const router = useRouter();

  return (
    <Suspense
      fallback={
        <div className="h-screen w-full bg-slate-950 flex items-center justify-center text-slate-400 font-mono text-xs">
          Cargando Modo Repartidor...
        </div>
      }
    >
      <RepartidorPiramidal onSwitchToStore={() => router.push("/")} />
    </Suspense>
  );
}
