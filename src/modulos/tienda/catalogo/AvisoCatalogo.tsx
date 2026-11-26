"use client";

import { Button } from "@/components/ui/button";

export function formatSavedTime(value: string | null) {
  if (!value) return "sin copia guardada";
  return `última actualización: ${new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  })}`;
}

interface AvisoCatalogoProps {
  companiesCached: boolean;
  productsCached: boolean;
  companiesSavedAt: string | null;
  productsSavedAt: string | null;
  productsError: boolean;
  warnings: string[];
  cacheError: boolean;
  onRetry: () => void;
}

export function AvisoCatalogo({
  companiesCached,
  productsCached,
  companiesSavedAt,
  productsSavedAt,
  productsError,
  warnings,
  cacheError,
  onRetry,
}: AvisoCatalogoProps) {
  if (!companiesCached && !productsCached && !productsError && warnings.length === 0 && !cacheError) return null;

  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
      <div className="space-y-1">
        {(companiesCached || productsCached) && (
          <p>Mostramos información guardada o pendiente de actualizar. La disponibilidad, los precios y el estado de los comercios pueden haber cambiado.</p>
        )}
        {companiesCached && companiesSavedAt && <p>Comercios: {formatSavedTime(companiesSavedAt)}.</p>}
        {productsCached && productsSavedAt && <p>Productos: {formatSavedTime(productsSavedAt)}.</p>}
        {productsError && <p>El carrito se conserva, pero no se pueden finalizar compras sin validar precio y stock.</p>}
        {warnings.length > 0 && <p>Catálogo parcial: {warnings.length} problema(s) al leer el inventario.</p>}
        {cacheError && <p>No se pudo guardar una copia para usarla sin conexión. Revisá el almacenamiento del dispositivo.</p>}
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onRetry} className="shrink-0 border-amber-300 bg-white text-amber-900">
        Reintentar
      </Button>
    </div>
  );
}
