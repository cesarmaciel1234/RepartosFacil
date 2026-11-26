"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, MapPin, X } from "lucide-react";
import type { LocationPickerSelection } from "@/components/LocationPickerMap";

const LocationPickerMap = dynamic(() => import("@/components/LocationPickerMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-sm font-semibold text-slate-500">
      Cargando mapa...
    </div>
  ),
});

interface ModalCambiarDireccionProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentAddress: string;
  onSelectAddress: (newAddress: string, coordinates: { lat: number; lng: number }) => void;
}

export function ModalCambiarDireccion({
  isOpen,
  onOpenChange,
  currentAddress,
  onSelectAddress,
}: ModalCambiarDireccionProps) {
  const [step, setStep] = useState<"map" | "details">("map");
  const [selectedLocation, setSelectedLocation] = useState<LocationPickerSelection | null>(null);
  const [streetInput, setStreetInput] = useState("");
  const [numberInput, setNumberInput] = useState("");
  const [unitInput, setUnitInput] = useState("");

  const parseAddress = (addr: string) => {
    const parts = addr.split(",").map((p) => p.trim());
    const first = parts[0] || "";
    const match = first.match(/^(.*?)(?:\s+(\d+[\w-]*))?$/);
    const street = match?.[1]?.trim() || first;
    const num = match?.[2]?.trim() || "";
    const unit = parts.length > 2 ? parts[1] : "";
    return { street, num, unit };
  };

  useEffect(() => {
    setStep("map");
    const parsed = parseAddress(currentAddress);
    setStreetInput(parsed.street);
    setNumberInput(parsed.num);
    setUnitInput(parsed.unit);
    setSelectedLocation(null);
  }, [currentAddress, isOpen]);

  const handleLocationChange = useCallback((location: LocationPickerSelection | null) => {
    setSelectedLocation(location);
  }, []);

  const handleSave = () => {
    if (!selectedLocation) return;
    const street = streetInput.trim() || selectedLocation.road || "Calle";
    const num = numberInput.trim() || selectedLocation.houseNumber || "";
    const unit = unitInput.trim();
    const city = selectedLocation.city || "";
    const neighborhood = selectedLocation.neighborhood || "";

    const streetAndNum = num ? `${street} ${num}` : street;
    const combinedParts = [streetAndNum, unit, neighborhood, city].filter(Boolean);
    const finalAddress = combinedParts.join(", ");

    onSelectAddress(
      finalAddress,
      { lat: selectedLocation.lat, lng: selectedLocation.lng }
    );
    onOpenChange(false);
  };

  const handleContinue = () => {
    if (!selectedLocation || selectedLocation.isResolving) return;
    if (selectedLocation.road) {
      setStreetInput(selectedLocation.road);
    } else if (selectedLocation.address) {
      const parsed = parseAddress(selectedLocation.address);
      setStreetInput(parsed.street);
      if (parsed.num && !numberInput) setNumberInput(parsed.num);
    }
    if (selectedLocation.houseNumber) {
      setNumberInput(selectedLocation.houseNumber);
    }
    setStep("details");
  };

  const handleBack = () => {
    if (step === "details") {
      setStep("map");
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-white"
        className="fixed inset-0 left-0 top-0 h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 bg-slate-100 p-0 text-slate-900 shadow-none sm:rounded-none"
      >
        <div className="relative flex h-full w-full flex-col">
          <header
            className="z-20 flex shrink-0 items-center justify-between bg-white px-4 pb-3 shadow-sm"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
          >
            <button
              type="button"
              onClick={handleBack}
              aria-label={step === "map" ? "Volver" : "Volver al mapa"}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 text-center">
              <DialogTitle className="text-base font-extrabold text-slate-900">
                {step === "map" ? "Ubicación actual" : "Detalles de entrega"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Elegí una dirección dentro de 1 km de tu ubicación GPS y completá los detalles de entrega.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Cerrar modal"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="relative min-h-0 flex-1">
            <LocationPickerMap
              className="absolute inset-0"
              onSelectionChange={handleLocationChange}
            />

            {step === "map" ? (
              <section
                className="absolute bottom-0 left-0 right-0 z-20 space-y-3 rounded-t-[28px] bg-white px-5 pt-5 shadow-[0_-8px_24px_rgba(15,23,42,0.12)]"
                style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))" }}
              >
                <div className="space-y-1">
                  <h2 className="text-xl font-extrabold text-slate-900">
                    Indicá dónde recibir tu pedido
                  </h2>
                  <p className="text-sm text-slate-600">
                    El domicilio debe quedar dentro de 1 km de tu ubicación GPS.
                    Luego podrás completar la calle y la altura.
                  </p>
                </div>

                {selectedLocation ? (
                  <div className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 p-3">
                    <MapPin className="h-5 w-5 shrink-0 text-blue-600" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {selectedLocation.isResolving
                          ? "Buscando dirección..."
                          : selectedLocation.neighborhood || "Ubicación seleccionada"}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {selectedLocation.address || "Ubicación seleccionada; completá la dirección si hace falta"}
                      </p>
                    </div>
                    {selectedLocation.isResolving && (
                      <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin text-blue-600" />
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Buscá una calle o tocá el mapa para marcar el punto de entrega.
                  </p>
                )}

                <Button
                  type="button"
                  disabled={!selectedLocation || selectedLocation.isResolving}
                  onClick={handleContinue}
                  className="h-13 w-full rounded-full bg-blue-600 text-sm font-extrabold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {selectedLocation?.isResolving ? "Buscando ubicación..." : "Continuar"}
                </Button>
              </section>
            ) : (
              <section
                className="absolute bottom-0 left-0 right-0 z-20 space-y-3.5 rounded-t-[28px] bg-white px-5 pt-4 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] max-h-[85vh] overflow-y-auto"
                style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))" }}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      🎯 Coordenadas fijadas en mapa
                    </span>
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Número de tu casa y detalles
                  </h2>
                  <p className="text-xs text-slate-600">
                    Completá la altura exacta para que la navegación GPS del repartidor llegue directo a tu puerta.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <label htmlFor="delivery-street" className="text-xs font-bold text-slate-700">
                      Calle *
                    </label>
                    <Input
                      id="delivery-street"
                      value={streetInput}
                      onChange={(event) => setStreetInput(event.target.value)}
                      placeholder="Ej. Tucumán o San Lorenzo"
                      className="h-11 rounded-xl border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="delivery-num" className="text-xs font-black text-blue-700">
                      Número / Altura *
                    </label>
                    <Input
                      id="delivery-num"
                      autoFocus
                      value={numberInput}
                      onChange={(event) => setNumberInput(event.target.value)}
                      placeholder="Ej. 2040"
                      className="h-11 rounded-xl border-blue-400 bg-blue-50/40 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="delivery-unit" className="text-xs font-bold text-slate-700">
                    Piso, Depto, Timbre o Referencia (opcional)
                  </label>
                  <Input
                    id="delivery-unit"
                    value={unitInput}
                    onChange={(event) => setUnitInput(event.target.value)}
                    placeholder="Ej. Piso 4 Depto B / Portón negro"
                    className="h-11 rounded-xl border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-500"
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700 flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-blue-600" />
                  <span className="truncate">
                    <strong>Destino:</strong> {streetInput || "Calle"} {numberInput || "S/N"}
                    {unitInput ? `, ${unitInput}` : ""} ({selectedLocation?.neighborhood || "Barrio"})
                  </span>
                </div>

                <Button
                  type="button"
                  disabled={!streetInput.trim() || !numberInput.trim()}
                  onClick={handleSave}
                  className="h-12 w-full rounded-full bg-blue-600 text-sm font-extrabold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirmar dirección y punto GPS
                </Button>
              </section>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
