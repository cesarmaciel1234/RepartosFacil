"use client";

import React from "react";
import { Product } from "@/data/mockProducts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Sparkles, Store, MapPin } from "lucide-react";
import {
  hasValidPrice,
  hasValidStock,
  isProductPurchasable,
  productAvailabilityMessage,
} from "@/modulos/tienda/motor/productoDisponibilidad";
import { ImagenProducto } from "./ImagenProducto";

interface TarjetaProductoProps {
  product: Product;
  quantityInCart: number;
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
}

export function TarjetaProducto({
  product,
  quantityInCart,
  onAddToCart,
  onUpdateQuantity,
}: TarjetaProductoProps) {
  const formatMoney = (val: number) => "$" + val.toLocaleString("es-AR");
  const canPurchase = isProductPurchasable(product);
  const priceIsValid = product.priceSource === "tpv" && hasValidPrice(product);
  const cachedPriceIsValid = product.catalogCached && hasValidPrice(product);
  const displayedPrice = hasValidPrice(product) && (priceIsValid || cachedPriceIsValid)
    ? product.price
    : null;
  const stockIsValid = hasValidStock(product);
  const stockIsCurrent = product.priceSource === "tpv" && stockIsValid;
  const stockAtLimit =
    stockIsValid && quantityInCart >= product.stockKg;
  const pendingData = [
    !product.image ? "Foto pendiente" : "",
    !priceIsValid && !cachedPriceIsValid ? "Precio pendiente" : "",
    !stockIsCurrent
      ? "Stock pendiente"
      : product.stockKg < 0
        ? "Stock a revisar"
        : product.stockKg === 0
          ? "Agotado"
          : product.stockKg < 1
            ? "Stock insuficiente"
            : "",
  ].filter(Boolean);

  return (
    <div className="group bg-white border border-slate-200/90 hover:border-blue-400 rounded-2xl p-3 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md">
      <div>
        {/* Imagen y Badges */}
        <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-slate-100 mb-2.5">
          <ImagenProducto
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {product.isPopular && (
            <Badge className="absolute top-2 left-2 bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.5 border-none shadow-xs flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" />
              DESTACADO
            </Badge>
          )}
          {product.badge && (
            <Badge className="absolute top-2 right-2 bg-blue-600 text-white font-black text-[9px] px-1.5 py-0.5 border-none shadow-xs">
              {product.badge}
            </Badge>
          )}
        </div>

        {/* Info */}
        <div className="space-y-1">
          {/* Badge de Empresa y Distancia (Multi-Empresa) */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 pb-0.5">
            <span className="font-bold text-blue-600 truncate max-w-[130px] flex items-center gap-1">
              <Store className="w-3 h-3 shrink-0 text-blue-600" />
              <span>{product.companyName || "Frigorífico Maciel"}</span>
            </span>
            <span className="font-semibold text-slate-600 flex items-center gap-0.5 shrink-0 bg-slate-100 px-1.5 py-0.5 rounded-md text-[9px]">
              <MapPin className="w-2.5 h-2.5 text-blue-600" />
              <span>
                {typeof product.distanceKm === "number" &&
                Number.isFinite(product.distanceKm)
                  ? `~${product.distanceKm < 1 ? Math.round(product.distanceKm * 1000) + ' m' : product.distanceKm.toFixed(1) + ' km'}`
                  : "Distancia no disponible"}
              </span>
            </span>
          </div>

          <h3 className="font-extrabold text-sm text-slate-900 line-clamp-1 leading-snug group-hover:text-blue-600 transition-colors">
            {product.name}
          </h3>
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
          {stockIsCurrent && (
            <p className="text-[10px] font-semibold text-slate-600">
              Stock informado: {product.stockKg.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
              {product.unit ? ` ${product.unit}` : ""}
            </p>
          )}
          {pendingData.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {pendingData.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-800"
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Precio y Acción */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2">
        <div className="shrink-0">
          {displayedPrice !== null ? (
            <>
              <span className="font-black text-sm xs:text-base text-slate-900 tracking-tight">
                {formatMoney(displayedPrice)}
              </span>
              {cachedPriceIsValid && (
                <span className="block text-[10px] font-semibold text-amber-800">
                  Último precio guardado
                </span>
              )}
              {product.unit && (
                <span className="text-[10px] text-slate-500 font-semibold ml-1">
                  /{product.unit}
                </span>
              )}
            </>
          ) : (
            <span className="font-bold text-xs text-amber-800">
              Precio pendiente
            </span>
          )}
        </div>

        {quantityInCart === 0 ? (
          <Button
            size="sm"
            disabled={!canPurchase}
            onClick={() => onAddToCart(product)}
            className="h-8 w-full xs:w-auto px-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-600 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all shrink-0"
          >
            {canPurchase ? (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </>
            ) : (
              <span>{product.catalogCached ? "Sin actualizar" : productAvailabilityMessage(product)}</span>
            )}
          </Button>
        ) : (
          <div className="flex items-center justify-center w-full xs:w-auto gap-1 bg-blue-50 border border-blue-200 rounded-xl p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onUpdateQuantity(product.id, -1)}
              aria-label={`Quitar una unidad de ${product.name}`}
              className="w-6 h-6 rounded-lg bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 flex items-center justify-center transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-5 text-center font-black text-xs text-blue-950">
              {quantityInCart}
            </span>
            <button
              type="button"
              disabled={!canPurchase || stockAtLimit}
              onClick={() => onUpdateQuantity(product.id, 1)}
              aria-label={`Agregar una unidad de ${product.name}`}
              className="w-6 h-6 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white flex items-center justify-center transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
