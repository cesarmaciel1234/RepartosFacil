export interface BranchInfo {
  id: number;
  nombre: string;
  codigo?: string;
  direccion?: string;
  latitud?: number | null;
  longitud?: number | null;
  telefono?: string;
  whatsapp?: string;
  horario?: string;
  esCentroDistribucion?: boolean;
}

export interface CompanyStore {
  id: string;
  name: string;
  slug?: string;
  empresa_id?: number;
  category: string;
  categorySlug: "carnes" | "supermercados" | "bebidas" | "kioscos" | "minimercados";
  rating: number;
  ratingCount: number;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  deliveryFee: number;
  freeDeliveryThreshold?: number;
  badges: string[];
  logoUrl?: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  phone: string;
  description?: string;
  openingHours?: string;
  cobroFacilApiEndpoint?: string;
  isOpen: boolean;
  sucursal_id?: number;
  parentCompanyId?: string;
  parentSlug?: string;
  sucursales?: BranchInfo[];
  isMultiBranch?: boolean;
  isSingleBranch?: boolean;
}
