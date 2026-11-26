"use client";

import React, { useState } from "react";
import type { CompanyStore } from "@/data/mockCompanies";
import type { Product } from "@/data/mockProducts";
import type { CatalogStatus } from "../hooks/useCatalogoTienda";
import type { CartItem } from "../../motor/tipos";
import { isCompanyCoordinates } from "../../motor/ubicacionComercio";
import { haversineKm } from "../../motor/tarifaUberService";
import { FiltroCategorias } from "../../ui/FiltroCategorias";
import { TarjetaProducto } from "../../ui/TarjetaProducto";
import { ResenasComercio } from "./ResenasComercio";
import {
  ArrowLeft,
  Bike,
  Check,
  Clock,
  MapPin,
  PackageOpen,
  Phone,
  Share2,
  Star,
  Tag,
} from "lucide-react";

interface CatalogoEmpresaTiendaProps {
  company: CompanyStore;
  companyCached?: boolean;
  categories: Array<{ id: string; name: string; icon: string }>;
  searchQuery: string;
  selectedCategory: string;
  products: Product[];
  catalogSize: number;
  catalogStatus: CatalogStatus;
  cart: CartItem[];
  deliveryCoordinates?: { lat: number; lng: number } | null;
  deliveryAddress?: string;
  onOpenChangeAddress?: () => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  onCategorySelect: (category: string) => void;
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onBackToStores: () => void;
}

const money = (value: number) => `$${value.toLocaleString("es-AR")}`;

export function CatalogoEmpresaTienda({
  company,
  companyCached = false,
  categories,
  searchQuery,
  selectedCategory,
  products,
  catalogSize,
  catalogStatus,
  cart,
  deliveryCoordinates,
  deliveryAddress,
  onOpenChangeAddress,
  onRetry,
  onSearchChange,
  onCategorySelect,
  onAddToCart,
  onUpdateQuantity,
  onBackToStores,
}: CatalogoEmpresaTiendaProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const mapQuery = isCompanyCoordinates(company.coordinates)
    ? `${company.coordinates.lat},${company.coordinates.lng}`
    : company.address || company.name;
  const companyMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const isClosed = company.isOpen === false;

  const distanceKm =
    deliveryCoordinates && isCompanyCoordinates(company.coordinates)
      ? haversineKm(
          deliveryCoordinates.lat,
          deliveryCoordinates.lng,
          company.coordinates.lat,
          company.coordinates.lng
        )
      : null;

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: company.name, text: `Pedí en ${company.name}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* el usuario canceló el diálogo de compartir */
    }
  };

  return (
    <div className="space-y-4">
      {/* ─── Portada del comercio ─── */}
      <section
        aria-label={`Información de ${company.name}`}
        className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="relative h-24 bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500 sm:h-32">
          <button
            type="button"
            onClick={onBackToStores}
            aria-label="Volver a los comercios"
            className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Compartir tienda"
            className="absolute right-3 top-3 flex h-9 items-center gap-1.5 rounded-full bg-white/90 px-3 text-xs font-bold text-slate-800 shadow hover:bg-white"
          >
            {linkCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
            {linkCopied ? "Link copiado" : "Compartir"}
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-start gap-3">
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
                alt=""
                className="relative -mt-9 h-[72px] w-[72px] shrink-0 rounded-2xl border-4 border-white bg-white object-cover shadow-md"
              />
            ) : (
              <div className="relative -mt-9 flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-blue-600 to-blue-800 text-2xl font-black text-white shadow-md">
                {company.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 pt-2">
              <h1 className="break-words text-lg font-black text-slate-900 sm:text-xl">
                {company.name}
              </h1>
              <p className="truncate text-xs font-semibold text-slate-500">
                {company.category}
              </p>
            </div>
          </div>

          {/* Dirección y Distancia al Domicilio del Comprador */}
          <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 font-bold">
              <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span>{company.address ? company.address : "Dirección comercial"}</span>
            </div>
            {distanceKm !== null ? (
              <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-black shadow-xs animate-pulse">
                <span>🎯 A {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} de tu ubicación</span>
              </div>
            ) : deliveryAddress ? (
              <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-semibold">
                <span>📍 Calculando distancia...</span>
              </div>
            ) : onOpenChangeAddress ? (
              <button
                type="button"
                onClick={onOpenChangeAddress}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-yellow-100 hover:bg-yellow-200 border border-yellow-400 text-yellow-900 text-[11px] font-extrabold cursor-pointer transition-all active:scale-95"
              >
                <span>📍 Fijá tu dirección para ver la distancia</span>
              </button>
            ) : null}
          </div>

          {company.description && <p className="mt-2.5 text-sm text-slate-600">{company.description}</p>}
          {company.openingHours && <p className="mt-1 text-xs text-slate-600">Horario: {company.openingHours}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
            <span
              className={`rounded-full px-2.5 py-1 font-black ${
                isClosed || companyCached ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {companyCached ? "Estado sin actualizar" : isClosed ? "Cerrado" : company.openingHours ? "Horario informado" : "Abierto ahora"}
            </span>
            <button type="button" disabled={!company.empresa_id} onClick={() => setReviewsOpen(true)}
              className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 font-extrabold text-slate-900">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {company.rating > 0 ? company.rating.toFixed(1) : "Nuevo"}
              {company.ratingCount ? (
                <span className="font-medium text-slate-400">({company.ratingCount})</span>
              ) : null}
            </button>
            <span className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {company.deliveryTimeMin}-{company.deliveryTimeMax} min
            </span>
            <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-bold text-blue-700">
              <Bike className="h-3.5 w-3.5" />
              {company.deliveryFee > 0 ? `Envío ${money(company.deliveryFee)}` : "Envío gratis"}
            </span>
            <a
              href={companyMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 font-bold text-blue-600 hover:text-blue-700"
            >
              <MapPin className="h-3.5 w-3.5" />
              Ubicación
            </a>
            {company.phone && !companyCached && (
              <a
                href={`tel:${company.phone.replace(/[^\d+]/g, "")}`}
                className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 font-bold text-blue-600 hover:text-blue-700"
              >
                <Phone className="h-3.5 w-3.5" />
                Llamar
              </a>
            )}
            {company.phone && !companyCached && /^\d{7,15}$/.test(company.phone) && (
              <a
                href={`https://wa.me/${company.phone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 font-bold text-green-700 hover:text-green-800"
              >
                WhatsApp
              </a>
            )}
          </div>

          {company.freeDeliveryThreshold ? (
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              <Tag className="h-3.5 w-3.5" />
              Envío gratis en compras desde {money(company.freeDeliveryThreshold)}
            </div>
          ) : null}

          {isClosed && !companyCached && (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              Este comercio está cerrado en este momento. Podés ver el catálogo y armar tu carrito.
            </div>
          )}
        </div>
      </section>
      {company.empresa_id && (
        <ResenasComercio empresaId={company.empresa_id} open={reviewsOpen} onOpenChange={setReviewsOpen} />
      )}

      {catalogStatus === "error" && catalogSize > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900"
        >
          <span>No se pudo actualizar el catálogo. Mostramos los últimos productos cargados.</span>
          <button type="button" onClick={onRetry} className="font-extrabold underline">
            Reintentar
          </button>
        </div>
      )}

      {catalogSize === 0 ? (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-6 py-16 text-center">
          <PackageOpen className="mx-auto h-10 w-10 text-slate-300" />
          <p className="text-base font-bold text-slate-800">
            {catalogStatus === "loading"
              ? "Cargando catálogo..."
              : catalogStatus === "error"
                ? "No pudimos cargar los productos"
                : `${company.name} todavía no publicó productos`}
          </p>
          <p className="text-xs text-slate-500">
            {catalogStatus === "error"
              ? "El catálogo de este comercio no está disponible en este momento."
              : catalogStatus === "loading"
                ? "Estamos sincronizando el catálogo desde Cobro Fácil."
                : "Su catálogo se sincroniza desde Cobro Fácil. Volvé a pasar pronto."}
          </p>
          {catalogStatus === "error" ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
            >
              Reintentar
            </button>
          ) : catalogStatus !== "loading" ? (
            <button
              type="button"
              onClick={onBackToStores}
              className="mt-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
            >
              Ver otros comercios
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <FiltroCategorias
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            selectedCategory={selectedCategory}
            onCategorySelect={onCategorySelect}
            categories={categories}
          />

          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => {
              const quantity =
                cart.find(
                  (item) =>
                    item.product.id === product.id &&
                    (item.product.companyId || company.id) === (product.companyId || company.id)
                )?.quantity || 0;
              return (
                <TarjetaProducto
                  key={product.id}
                  product={
                    distanceKm !== null && product.distanceKm === undefined
                      ? { ...product, distanceKm, companyName: company.name }
                      : product
                  }
                  quantityInCart={quantity}
                  onAddToCart={onAddToCart}
                  onUpdateQuantity={onUpdateQuantity}
                />
              );
            })}
          </div>

          {products.length === 0 && (
            <div className="space-y-2 rounded-3xl border border-slate-200 bg-slate-50 p-6 py-16 text-center">
              <p className="text-base font-bold text-slate-800">
                {searchQuery
                  ? <>No encontramos &ldquo;{searchQuery}&rdquo; en {company.name}</>
                  : "No hay productos en esta categoría"}
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Limpiar búsqueda
                  </button>
                )}
                <button
                  type="button"
                  onClick={onBackToStores}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  Buscar en todos los comercios
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
