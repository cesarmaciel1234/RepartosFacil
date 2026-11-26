export interface Product {
  id: string;
  name: string;
  category: string;
  price?: number;
  unit: string;
  description: string;
  image?: string;
  priceSource?: "tpv";
  catalogCached?: boolean;
  isPopular?: boolean;
  discountBadge?: string;
  badge?: string;
  stockKg?: number;
  companyId?: string;
  companyName?: string;
  sucursal_id?: number;
  distanceKm?: number;
}

export const CATEGORIES = [
  { id: "todos", name: "Todos los cortes", icon: "🔥" },
  { id: "vacuno", name: "Cortes Vacunos", icon: "🥩" },
  { id: "bebidas", name: "Bebidas & Kiosco", icon: "🥤" },
  { id: "pollo", name: "Pollo & Granja", icon: "🍗" },
  { id: "cerdo", name: "Cortes de Cerdo", icon: "🥓" },
  { id: "achuras", name: "Achuras & Embutidos", icon: "🌭" },
  { id: "combos", name: "Combos & Ofertas", icon: "📦" },
  { id: "almacen", name: "Carbón & Especias", icon: "🧂" },
];
