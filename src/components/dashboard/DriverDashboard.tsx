"use client";

import { RepartidorPiramidal } from "@/modulos/repartidor/RepartidorPiramidal";

export interface DriverDashboardProps {
  onSwitchToStore: () => void;
}

export function DriverDashboard({ onSwitchToStore }: DriverDashboardProps) {
  return <RepartidorPiramidal onSwitchToStore={onSwitchToStore} />;
}

export default DriverDashboard;
