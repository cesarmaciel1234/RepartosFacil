"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Store,
  Search,
  Star,
  Clock,
  Bike,
  Tag,
  ExternalLink,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import type { CompanyStore } from "@/data/mockCompanies";
import type { Product } from "@/data/mockProducts";
import { productBelongsToCompany } from "@/modulos/tienda/catalogo/hooks/useCatalogoTienda";
import { hasValidPrice } from "@/modulos/tienda/motor/productoDisponibilidad";

interface ModalMercadosProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCompanyId: string;
  onSelectCompany: (company: CompanyStore) => void;
}

export function ModalMercados({
  isOpen,
  onOpenChange,
  selectedCompanyId,
  onSelectCompany,
}: ModalMercadosProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("todos");
  const [companies, setCompanies] = useState<CompanyStore[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Sincronizar dinámicamente las empresas dadas de alta en Cobro Fácil (PostgreSQL)
  React.useEffect(() => {
    fetch("/api/cobrofacil/companies")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.empresas)) {
          setCompanies(data.empresas);
        }
      })
      .catch((err) => console.warn("Error cargando empresas dinámicas en modal:", err));
    fetch("/api/cobrofacil/products", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data && Array.isArray(data.products)) setProducts(data.products); })
      .catch((err) => console.warn("Error cargando productos en modal:", err));
  }, []);

  const categories = [
    { id: "todos", name: "Todos", emoji: "🛒" },
    { id: "carnes", name: "Carnicerías", emoji: "🥩" },
    { id: "supermercados", name: "Supermercados", emoji: "🏪" },
    { id: "bebidas", name: "Bebidas", emoji: "🍾" },
    { id: "kioscos", name: "Kioscos 24hs", emoji: "🍫" },
    { id: "minimercados", name: "Almacén", emoji: "🧀" },
  ];

  const term = searchTerm.toLowerCase().trim();

  const filtered = companies.map((comp) => {
    // Buscar si la empresa tiene productos que coincidan en su catálogo
    const matchingProducts = term
      ? products.filter(
          (p) =>
            productBelongsToCompany(p, comp) &&
            (p.name.toLowerCase().includes(term) ||
              (p.description || "").toLowerCase().includes(term) ||
              p.category.toLowerCase().includes(term))
        )
      : [];

    const matchesSearch =
      !term ||
      comp.name.toLowerCase().includes(term) ||
      comp.category.toLowerCase().includes(term) ||
      (comp.address || "").toLowerCase().includes(term) ||
      matchingProducts.length > 0;

    const matchesCat = selectedCat === "todos" || comp.categorySlug === selectedCat;

    return {
      comp,
      matchingProducts,
      isVisible: matchesSearch && matchesCat,
    };
  }).filter((item) => item.isVisible);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 border-slate-800 text-slate-100 w-[94vw] max-w-md p-5 rounded-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden scrollbar-hide">
        <DialogHeader className="text-left pb-2 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-white">
                  Mercados y Empresas
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Ecosistema multitienda conectado a Cobro Fácil en Render.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Barra de Búsqueda (Estilo PedidosYa Mercados - Captura 4) */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar productos (ej. asado, coca, fernet)..."
              className="pl-9 h-11 bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 rounded-2xl text-xs"
            />
          </div>

          {/* Carrusel de Categorías Rápidas */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCat(cat.id)}
                className={`h-8 px-3 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all ${
                  selectedCat === cat.id
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                    : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Lista de Empresas / Locales (Captura 4) */}
          <div className="space-y-2.5">
            {filtered.map(({ comp, matchingProducts }) => {
              const isSelected = comp.id === selectedCompanyId;
              return (
                <div
                  key={comp.id}
                  onClick={() => {
                    onSelectCompany(comp);
                    onOpenChange(false);
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-emerald-950/40 border-emerald-500/60 shadow-lg"
                      : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-700 flex items-center justify-center font-black text-lg text-emerald-400 shrink-0">
                        {comp.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-white">
                            {comp.name}
                          </span>
                          {isSelected && (
                            <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0 font-bold">
                              ACTIVO
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block font-medium">
                          {comp.category}
                        </span>

                        {/* Metricas: Rating, Tiempo, Envio */}
                        <div className="flex items-center gap-2.5 mt-1 text-[10px] text-slate-400 font-semibold">
                          <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                            <Star className="w-3 h-3 fill-current" />
                            {comp.rating}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {comp.deliveryTimeMin}-{comp.deliveryTimeMax} min
                          </span>
                          <span className="flex items-center gap-0.5 text-emerald-400">
                            <Bike className="w-3 h-3" />
                            ${comp.deliveryFee.toLocaleString("es-AR")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resultados encontrados en el catálogo de esta empresa */}
                  {matchingProducts.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Productos disponibles en catálogo:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {matchingProducts.map((p) => (
                          <span
                            key={p.id}
                            className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          >
                            {p.name} ·{" "}
                            {p.priceSource === "tpv" && hasValidPrice(p)
                              ? `$${p.price.toLocaleString("es-AR")}`
                              : "Precio pendiente"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Badges de Promociones (Estilo PedidosYa) */}
                  {comp.badges && comp.badges.length > 0 && matchingProducts.length === 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5 pt-2 border-t border-slate-800/80">
                      {comp.badges.map((b, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Banner Cobro Fácil Cloud Sync */}
          <div className="p-3 rounded-2xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between text-xs text-blue-200">
            <div className="space-y-0.5">
              <span className="font-bold flex items-center gap-1.5 text-white">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Conectado con Cobro Fácil en Render
              </span>
              <span className="text-[10px] text-blue-300 block">
                Sincronización automática de inventario y facturación multitienda.
              </span>
            </div>
            <a
              href="https://cobrofacil.onrender.com"
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
