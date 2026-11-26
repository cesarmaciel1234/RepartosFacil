"use client";

import React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CATEGORIES } from "@/data/mockProducts";

interface CategoryOption {
  id: string;
  name: string;
  icon: string;
}

interface FiltroCategoriasProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategorySelect: (id: string) => void;
  categories?: CategoryOption[];
}

export function FiltroCategorias({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategorySelect,
  categories,
}: FiltroCategoriasProps) {
  const activeCategories = categories && categories.length > 0 ? categories : CATEGORIES;
  return (
    <div className="space-y-3">
      {/* Buscador de inventario de la empresa */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <Input
          placeholder="Buscar artículo o departamento en el inventario..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="bg-slate-100 hover:bg-slate-100/80 border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-full pl-10 pr-4 h-11 text-xs sm:text-sm focus:bg-white focus:ring-2 focus:ring-blue-600/15 focus:border-blue-600 transition-all shadow-2xs"
        />
      </div>

      {/* Pills de departamentos del inventario de la empresa */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {activeCategories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20 scale-102"
                  : "bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
