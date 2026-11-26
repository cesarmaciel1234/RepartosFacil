"use client";

import { TiendaPiramidal } from "@/modulos/tienda/TiendaPiramidal";
import type { CartItem } from "@/modulos/tienda/motor/tipos";

export type { CartItem };

export interface EcommerceStoreProps {
  onSwitchToDriver: () => void;
}

export function EcommerceStore({ onSwitchToDriver }: EcommerceStoreProps) {
  return <TiendaPiramidal onSwitchToDriver={onSwitchToDriver} />;
}

export default EcommerceStore;
