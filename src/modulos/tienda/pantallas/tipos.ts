import type { CompanyStore } from "@/data/mockCompanies";
import type { Product } from "@/data/mockProducts";

export interface PantallaComerciosProps {
  companies: CompanyStore[];
  companiesCached?: boolean;
  products?: Product[];
  onSelectCompany: (company: CompanyStore, initialSearch?: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  deliveryAddress?: string;
  deliveryCoordinates?: { lat: number; lng: number } | null;
  status?: "loading" | "ready" | "error";
  onRetry?: () => void;
  productCountByCompany?: Record<string, number>;
}
