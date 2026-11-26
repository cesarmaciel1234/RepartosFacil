import type { CompanyStore } from "@/data/mockCompanies";
import type { Product } from "@/data/mockProducts";

type CatalogCache<T> = { savedAt: string; data: T[] };

const COMPANIES_KEY = "rf_catalog_companies_v1";
const PRODUCTS_KEY = "rf_catalog_products_v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isCatalogCompany(value: unknown): value is CompanyStore {
  return isRecord(value) && typeof value.id === "string" && Boolean(value.id.trim()) &&
    typeof value.name === "string" && Boolean(value.name.trim());
}

export function isCatalogProduct(value: unknown): value is Product {
  return isRecord(value) && (typeof value.id === "string" || typeof value.id === "number") &&
    typeof value.name === "string" && Boolean(value.name.trim());
}

function readCache<T>(key: string, validate: (value: unknown) => value is T): CatalogCache<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || typeof value.savedAt !== "string" ||
      !Number.isFinite(Date.parse(value.savedAt)) ||
      !Array.isArray(value.data) || !value.data.every(validate)) {
      throw new Error("Los datos guardados no tienen el formato esperado.");
    }
    return { savedAt: value.savedAt, data: value.data };
  } catch (error) {
    console.warn("No se pudo leer el catálogo guardado:", error);
    return null;
  }
}

function saveCache<T>(key: string, data: T[]): string {
  const savedAt = new Date().toISOString();
  localStorage.setItem(key, JSON.stringify({ savedAt, data }));
  return savedAt;
}

export function readCompaniesCache() {
  return readCache(COMPANIES_KEY, isCatalogCompany);
}

export function readProductsCache() {
  return readCache(PRODUCTS_KEY, isCatalogProduct);
}

export function saveCompaniesCache(companies: CompanyStore[]) {
  return saveCache(COMPANIES_KEY, companies);
}

export function saveProductsCache(products: Product[]) {
  return saveCache(PRODUCTS_KEY, products);
}

export function asCachedProducts<T extends Product>(products: T[]): T[] {
  return products.map((product) => ({
    ...product,
    priceSource: undefined,
    catalogCached: true,
  }));
}
