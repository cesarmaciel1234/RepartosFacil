"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { CheckoutFormData, OrderData } from "../motor/tipos";
import { loadSavedCustomer, buildWhatsAppLink } from "../motor/pedidoService";
import { loadClientProfile } from "@/modulos/repartidor/motor/driverService";
import { calcularTarifaEnvio } from "../motor/tarifaUberService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Store,
  CreditCard,
  Banknote,
  Send,
  Check,
  User,
  Phone,
  MessageCircle,
  Copy,
  Zap,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * CONFIGURACIÓN DE VALIDACIÓN GPS:
 * - En PRODUCCIÓN REAL: REQUIRE_VERIFIED_GPS = true para forzar que el cliente
 *   haya marcado su ubicación en el mapa con GPS antes de poder enviar el pedido,
 *   evitando compras maliciosas o fraudulentas fuera del radio permitido.
 * - En MODO PRUEBA (Actual): REQUIRE_VERIFIED_GPS = false para permitir comprar
 *   y testear pedidos en computadoras o navegadores sin geolocalización activa.
 */
export const REQUIRE_VERIFIED_GPS = false;

interface ModalCheckoutProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  cartTotal: number;
  companyName?: string;
  companyDeliveryFee?: number;
  freeDeliveryThreshold?: number;
  profileAddress?: string;
  selectedDeliveryAddress?: string;
  deliveryCoordinates?: { lat: number; lng: number } | null;
  onOpenAddressPicker?: () => void;
  isSubmitting: boolean;
  onConfirmOrder: (formData: CheckoutFormData, clientId: string) => Promise<void>;
  orderConfirmed: OrderData | null;
  onCloseConfirmed: () => void;
}

function parseAddressParts(raw: string) {
  if (!raw) return { street: "", number: "", unit: "", city: "" };
  const commaParts = raw.split(",").map((s) => s.trim());
  const first = commaParts[0] || "";
  const match = first.match(/^(.*?)(?:\s+(\d+[\w-]*))$/);
  let street = first;
  let number = "";
  if (match) {
    street = match[1].trim();
    number = match[2].trim();
  }
  let unit = "";
  const otherParts: string[] = [];
  for (let i = 1; i < commaParts.length; i++) {
    const part = commaParts[i];
    if (!number && /^\d+$/.test(part)) {
      number = part;
    } else if (/^(piso|depto|dto|departamento|timbre)/i.test(part)) {
      unit = part;
    } else {
      otherParts.push(part);
    }
  }
  const city = otherParts.join(", ");
  return { street, number, unit, city };
}

export function ModalCheckout({
  isOpen,
  onOpenChange,
  cartTotal,
  companyName,
  companyDeliveryFee,
  freeDeliveryThreshold = 35000,
  profileAddress,
  selectedDeliveryAddress,
  deliveryCoordinates,
  onOpenAddressPicker,
  isSubmitting,
  onConfirmOrder,
  orderConfirmed,
  onCloseConfirmed,
}: ModalCheckoutProps) {
  const formatMoney = (val: number) => "$" + val.toLocaleString("es-AR");
  const initializedForOpen = useRef(false);
  const checkoutClientId = useRef<string | null>(null);
  const [missingName, setMissingName] = useState(true);
  const [missingPhone, setMissingPhone] = useState(true);
  const [formError, setFormError] = useState("");
  const [addressUnit, setAddressUnit] = useState("");
  const [streetInput, setStreetInput] = useState("");
  const [numberInput, setNumberInput] = useState("");
  const [citySuffix, setCitySuffix] = useState("");

  const [form, setForm] = useState<CheckoutFormData>({
    customerName: "",
    customerPhone: "",
    deliveryType: "delivery",
    deliveryAddress: "",
    selectedBranch: "Sucursal Central - Tucumán 2130",
    paymentMethod: "efectivo",
    orderNotes: "",
  });

  const updateCombinedAddress = (
    street: string,
    num: string,
    unit: string,
    city: string
  ) => {
    const streetWithNum = num.trim() ? `${street.trim()} ${num.trim()}` : street.trim();
    const combined = [streetWithNum, unit.trim(), city.trim()].filter(Boolean).join(", ");
    setForm((p) => ({ ...p, deliveryAddress: combined }));
  };

  useEffect(() => {
    if (!isOpen) {
      initializedForOpen.current = false;
      return;
    }
    if (initializedForOpen.current) return;
    initializedForOpen.current = true;

    checkoutClientId.current = loadClientProfile()?.id || null;
    const saved = loadSavedCustomer();
    const customerName = saved.customerName?.trim() || "";
    const customerPhone = saved.customerPhone?.trim() || "";
    setMissingName(!customerName);
    setMissingPhone(!customerPhone);
    setFormError("");

    const initialAddr =
      profileAddress || selectedDeliveryAddress || saved.deliveryAddress || "";
    const parsed = parseAddressParts(initialAddr);
    setStreetInput(parsed.street);
    setNumberInput(parsed.number);
    setCitySuffix(parsed.city);
    if (parsed.unit) setAddressUnit(parsed.unit);

    setForm((prev) => ({
      ...prev,
      customerName,
      customerPhone,
      deliveryAddress: initialAddr,
      deliveryType: saved.deliveryType || "delivery",
      selectedBranch: saved.selectedBranch || "Sucursal Central - Tucumán 2130",
    }));
  }, [isOpen, profileAddress, selectedDeliveryAddress]);

  // Si cambia la dirección seleccionada desde el mapa mientras el checkout está abierto
  useEffect(() => {
    if (selectedDeliveryAddress) {
      const parsed = parseAddressParts(selectedDeliveryAddress);
      if (parsed.street) setStreetInput(parsed.street);
      if (parsed.number) setNumberInput(parsed.number);
      if (parsed.city) setCitySuffix(parsed.city);
      if (parsed.unit && !addressUnit) setAddressUnit(parsed.unit);
      setForm((prev) => ({ ...prev, deliveryAddress: selectedDeliveryAddress }));
    }
  }, [selectedDeliveryAddress]);

  // Cálculo de tarifa estándar Uber / PedidosYa (usando coordenadas exactas o dirección)
  const tarifa = useMemo(
    () => calcularTarifaEnvio(deliveryCoordinates || form.deliveryAddress || ""),
    [deliveryCoordinates, form.deliveryAddress]
  );

  const deliveryFee =
    form.deliveryType === "delivery" && cartTotal > 0
      ? cartTotal >= freeDeliveryThreshold
        ? 0
        : companyDeliveryFee ?? tarifa.totalDeliveryFee
      : 0;

  const finalTotal = cartTotal + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutClientId.current || loadClientProfile()?.id !== checkoutClientId.current) {
      setFormError("La sesión cambió. Cerrá el formulario y volvé a abrirlo.");
      return;
    }
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      setFormError("Completá tus datos de contacto.");
      return;
    }
    if (form.deliveryType === "delivery") {
      if (!streetInput.trim()) {
        setFormError("Por favor ingresá la calle de tu domicilio.");
        return;
      }
      if (!numberInput.trim() && !deliveryCoordinates) {
        setFormError("Por favor ingresá el número de tu casa (altura) o marcá el punto en el mapa para que el repartidor llegue a tu puerta.");
        return;
      }
      if (REQUIRE_VERIFIED_GPS && !deliveryCoordinates) {
        setFormError("Para envío a domicilio es obligatorio seleccionar tu ubicación en el mapa dentro de 1 km.");
        onOpenAddressPicker?.();
        return;
      }
    }
    setFormError("");

    const streetWithNum = numberInput.trim()
      ? `${streetInput.trim()} ${numberInput.trim()}`
      : streetInput.trim();
    const finalAddress = [streetWithNum, addressUnit.trim(), citySuffix.trim()]
      .filter(Boolean)
      .join(", ");

    await onConfirmOrder(
      {
        ...form,
        deliveryAddress: finalAddress,
        deliveryStreet: streetInput.trim(),
        deliveryNumber: numberInput.trim(),
        deliveryFloor: addressUnit.trim(),
        deliveryCoordinates: deliveryCoordinates || null,
      },
      checkoutClientId.current
    );
  };

  return (
    <>
      {/* ─── Diálogo Formulario Checkout ─── */}
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="w-[94vw] max-w-sm max-h-[88vh] overflow-y-auto rounded-3xl border-slate-200 bg-white p-4 pt-5 text-slate-900 shadow-xl">
          <DialogHeader className="border-b border-slate-100 pb-2 pr-8 text-left">
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Store className="h-4 w-4" />
              </span>
              {companyName ? `Pagar en ${companyName}` : "Finalizar Pedido"}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-slate-500">
              Revisá el método de pago y los datos de entrega de tu pedido.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
            {/* Tipo de Entrega */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Modalidad de Entrega
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, deliveryType: "delivery" }))}
                  className={`p-2.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                    form.deliveryType === "delivery"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span>Envío a Domicilio</span>
                  <span className="text-[10px] font-normal text-slate-500">
                    {cartTotal >= freeDeliveryThreshold
                      ? "Gratis"
                      : formatMoney(companyDeliveryFee ?? tarifa.totalDeliveryFee)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, deliveryType: "pickup" }))}
                  className={`p-2.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                    form.deliveryType === "pickup"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Store className="w-4 h-4" />
                  <span>Retiro en Local</span>
                  <span className="text-[10px] font-semibold text-blue-600">Sin costo</span>
                </button>
              </div>
            </div>

            {/* Datos Personales */}
            <div className="space-y-2.5">
              {missingName && <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Nombre y Apellido *
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    autoComplete="name"
                    placeholder="Ej. Juan Pérez"
                    value={form.customerName}
                    onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 bg-white pl-8 text-xs text-slate-900 placeholder:text-slate-400"
                    required
                  />
                </div>
              </div>}

              {missingPhone && <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  WhatsApp / Celular de Contacto *
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="tel"
                    autoComplete="tel"
                    placeholder="Ej. 11 5566-7788"
                    value={form.customerPhone}
                    onChange={(e) => setForm((p) => ({ ...p, customerPhone: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 bg-white pl-8 text-xs text-slate-900 placeholder:text-slate-400"
                    required
                  />
                </div>
              </div>}

              {form.deliveryType === "delivery" ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      Dirección y Número de Casa *
                    </label>
                    {deliveryCoordinates ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Punto GPS fijado
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400">
                        Punto GPS opcional
                      </span>
                    )}
                  </div>

                  {/* Tarjeta de Punto en el Mapa */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-2.5 flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${deliveryCoordinates ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {deliveryCoordinates ? "Punto fijado en el mapa" : "Punto exacto sin marcar"}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {deliveryCoordinates
                            ? `${deliveryCoordinates.lat.toFixed(4)}, ${deliveryCoordinates.lng.toFixed(4)}`
                            : "Tocá el mapa para ubicar tu puerta"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenAddressPicker}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-blue-600 hover:text-blue-800 text-[11px] font-bold shrink-0 shadow-xs active:scale-95 transition-all"
                    >
                      {deliveryCoordinates ? "Cambiar punto" : "Elegir en mapa"}
                    </button>
                  </div>

                  {/* Campos estructurados para Calle y Altura / Número de casa */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">
                        Calle *
                      </label>
                      <Input
                        placeholder="Ej. San Lorenzo o Tucumán"
                        value={streetInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStreetInput(val);
                          updateCombinedAddress(val, numberInput, addressUnit, citySuffix);
                        }}
                        className="h-10 rounded-xl border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-blue-700">
                        Número / Altura *
                      </label>
                      <Input
                        placeholder="Ej. 2040"
                        value={numberInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNumberInput(val);
                          updateCombinedAddress(streetInput, val, addressUnit, citySuffix);
                        }}
                        className="h-10 rounded-xl border-blue-400 bg-blue-50/40 text-xs font-bold text-slate-900 placeholder:text-slate-400"
                        required
                      />
                    </div>
                  </div>

                  {/* Piso, Depto o Referencia */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">
                      Piso, Depto o Timbre (opcional)
                    </label>
                    <Input
                      placeholder="Ej. Piso 3 Depto B / Timbre blanco"
                      value={addressUnit}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAddressUnit(val);
                        updateCombinedAddress(streetInput, numberInput, val, citySuffix);
                      }}
                      className="h-9 rounded-xl border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400"
                    />
                  </div>

                  {/* Preview de entrega para el cliente */}
                  <div className="text-[10px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5 truncate">
                    <span className="font-bold text-slate-700 shrink-0">📍 Destino:</span>
                    <span className="truncate">
                      {streetInput.trim() || "Calle"} {numberInput.trim() || "S/N"}
                      {addressUnit.trim() ? `, ${addressUnit.trim()}` : ""}
                      {citySuffix.trim() ? `, ${citySuffix.trim()}` : ""}
                    </span>
                  </div>

                  {/* Tarifa dinámica estándar Uber / PedidosYa */}
                  <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="flex items-center gap-1 text-[10px] font-bold">
                        <Zap className="h-3 w-3 fill-current text-amber-500" />
                        {tarifa.isPeakHour ? "Horario Pico (1.35x demanda)" : "Horario Normal"}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {tarifa.distanceKm} km desde Market
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-600">Envío:</span>
                      <span className="font-black text-blue-700">
                        {deliveryFee === 0 ? "GRATIS" : formatMoney(deliveryFee)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Seleccioná Sucursal de Retiro
                  </label>
                  <select
                    value={form.selectedBranch}
                    onChange={(e) => setForm((p) => ({ ...p, selectedBranch: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Sucursal Central - Tucumán 2130">Sucursal Central - Tucumán 2130</option>
                    <option value="Sucursal Frigorífico Norte">Sucursal Frigorífico Norte</option>
                    <option value="Sucursal Express Centro">Sucursal Express Centro</option>
                  </select>
                </div>
              )}
            </div>

            {/* Medio de Pago */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Medio de Pago
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "efectivo", label: "Efectivo", sub: "al recibir" },
                  { id: "transferencia", label: "Transferencia", sub: "Mercado Pago" },
                  { id: "tarjeta", label: "Tarjeta", sub: "Débito / crédito" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        paymentMethod: m.id as CheckoutFormData["paymentMethod"],
                      }))
                    }
                    className={`p-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                      form.paymentMethod === m.id
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="leading-tight truncate">{m.label}</div>
                    <div className="text-[9px] font-normal opacity-70 mt-0.5 truncate">{m.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Notas opcionales */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                Notas / Aclaraciones (opcional)
              </label>
              <Textarea
                placeholder="Ej. Cortes envasados por separado, o tocar timbre 4B..."
                value={form.orderNotes}
                onChange={(e) => setForm((p) => ({ ...p, orderNotes: e.target.value }))}
                className="min-h-[50px] rounded-xl border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400"
              />
            </div>

            {/* Total y Botón Confirmar */}
            <div className="space-y-2.5 border-t border-slate-100 pt-2">
              {formError && <p role="alert" className="text-xs font-medium text-red-600">{formError}</p>}
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500">Total a abonar:</span>
                <span className="text-base font-black text-blue-700">{formatMoney(finalTotal)}</span>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-98"
              >
                {isSubmitting ? (
                  <span>Procesando pedido...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar y Enviar Pedido</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Diálogo de Pedido Confirmado ─── */}
      <Dialog open={!!orderConfirmed} onOpenChange={(open) => !open && onCloseConfirmed()}>
        <DialogContent className="max-w-sm space-y-4 rounded-3xl border-slate-200 bg-white p-6 text-center text-slate-900 shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
            <Check className="w-8 h-8 stroke-[3]" />
          </div>

          <div className="space-y-1">
            <DialogTitle className="text-xl font-black text-slate-900">
              ¡Pedido Confirmado!
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Tu compra ya fue ingresada al radar del comercio y repartidores.
            </DialogDescription>
          </div>

          {orderConfirmed && (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500">Código de Pedido:</span>
                <span className="font-mono text-sm font-black text-blue-700">
                  #{orderConfirmed.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Final:</span>
                <span className="font-bold text-slate-900">{formatMoney(orderConfirmed.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Entrega:</span>
                <span className="max-w-[170px] truncate font-bold text-slate-900">
                  {orderConfirmed.deliveryAddress}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pago:</span>
                <span className="text-[11px] font-bold uppercase text-blue-700">
                  {{
                    cash: "Efectivo",
                    transfer: "Transferencia",
                    card: "Tarjeta",
                    web: "Pago web",
                  }[orderConfirmed.paymentMethod]}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            {orderConfirmed && (
              <a
                href={buildWhatsAppLink(orderConfirmed)}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-xs font-extrabold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700"
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                <span>Avisar al Comercio por WhatsApp</span>
              </a>
            )}

            <Button
              variant="outline"
              onClick={onCloseConfirmed}
              className="h-10 w-full rounded-2xl border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Cerrar y seguir navegando
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
