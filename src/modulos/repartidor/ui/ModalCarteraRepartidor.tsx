"use client";

import React from "react";
import { DriverWallet } from "../motor/tipos";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, Banknote, CheckCircle, ArrowDownLeft, Clock } from "lucide-react";

interface ModalCarteraRepartidorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: DriverWallet;
}

export function ModalCarteraRepartidor({
  isOpen,
  onOpenChange,
  wallet,
}: ModalCarteraRepartidorProps) {
  const formatMoney = (val: number) => "$" + (val || 0).toLocaleString("es-AR");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-slate-200 text-slate-900 w-[94vw] max-w-sm p-5 rounded-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="text-left pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-yellow-100 text-yellow-800 flex items-center justify-center mb-1.5">
            <Wallet className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg font-black text-slate-900">
            Mi Cartera de Repartidor
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Resumen de ganancias acreditadas y efectivo cobrado en la jornada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Card Saldo Ganancias */}
          <div className="bg-gradient-to-br from-yellow-100 to-white border border-yellow-300 rounded-2xl p-4 text-center">
            <span className="text-[11px] font-bold text-yellow-900 uppercase tracking-wider block">
              Ganancia Neta Disponible
            </span>
            <span className="text-3xl font-black text-[#2D3277] tracking-tight my-1 block">
              {formatMoney(wallet.balance)}
            </span>
            <span className="text-[11px] text-slate-600 font-medium">
              {wallet.completedOrdersCount} {wallet.completedOrdersCount === 1 ? "entrega realizada" : "entregas realizadas"}
            </span>
          </div>

          {/* Card Efectivo en Mano y Rendición */}
          {wallet.cashInHand > 0 && (
            <div className="space-y-2">
              <div className="bg-yellow-50 border border-yellow-300 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-yellow-100 text-yellow-800 flex items-center justify-center">
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Efectivo Cobrado en Mano</div>
                    <div className="text-[10px] text-slate-500">Total recibido de pedidos en efectivo</div>
                  </div>
                </div>
                <span className="text-sm font-black text-yellow-900">
                  {formatMoney(wallet.cashInHand)}
                </span>
              </div>

              {/* Conciliación con Central (Rendición neta) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Liquidación a Rendir a Central</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Efectivo cobrado menos tus ganancias acumuladas
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-[#2D3277] block">
                    {formatMoney(Math.max(0, wallet.cashInHand - wallet.balance))}
                  </span>
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                    A rendir en caja
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Historial de Movimientos */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 block">Movimientos Recientes</span>
            {wallet.transactions.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-500">
                Aún no hay entregas completadas hoy.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {wallet.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-yellow-100 text-yellow-800 flex items-center justify-center shrink-0">
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 truncate max-w-[160px]">
                          {tx.description}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(tx.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                    <span className="font-black text-[#2D3277] shrink-0">
                      +{formatMoney(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={() => onOpenChange(false)}
            className="w-full h-10 rounded-xl bg-[#FFE600] hover:bg-yellow-300 text-[#2D3277] font-bold text-xs"
          >
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
