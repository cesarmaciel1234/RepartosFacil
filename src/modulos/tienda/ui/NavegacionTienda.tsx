"use client";

import React from "react";
import {
  BadgePercent,
  Home,
  ReceiptText,
  ShoppingBasket,
  UserRound,
} from "lucide-react";

export type SeccionTienda =
  | "home"
  | "markets"
  | "promotions"
  | "orders"
  | "profile";

interface NavegacionTiendaProps {
  activeSection: SeccionTienda;
  onChangeSection: (section: SeccionTienda) => void;
}

const items = [
  { id: "home", label: "Inicio", Icon: Home },
  { id: "markets", label: "Súper", Icon: ShoppingBasket },
  { id: "promotions", label: "Promociones", Icon: BadgePercent },
  { id: "orders", label: "Pedidos", Icon: ReceiptText },
  { id: "profile", label: "Mi perfil", Icon: UserRound },
] as const;

export function NavegacionTienda({
  activeSection,
  onChangeSection,
}: NavegacionTiendaProps) {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto grid max-w-xl grid-cols-5">
        {items.map(({ id, label, Icon }) => {
          const isActive = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onChangeSection(id)}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 pt-2 text-[10px] transition-colors sm:text-xs ${
                isActive
                  ? "font-bold text-blue-700"
                  : "font-medium text-slate-500 hover:text-blue-600"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : "stroke-[1.8]"}`}
                aria-hidden="true"
              />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
