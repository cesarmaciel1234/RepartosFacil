"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Product } from "@/data/mockProducts";
import type { CompanyStore } from "@/data/mockCompanies";
import {
  asCachedProducts,
  isCatalogCompany,
  isCatalogProduct,
  readCompaniesCache,
  readProductsCache,
  saveCompaniesCache,
  saveProductsCache,
} from "../cacheCatalogo";

export type CatalogProduct = Product & {
  department?: string;
  categoryName?: string;
};

export type CatalogStatus = "loading" | "ready" | "error";

interface UseCatalogoTiendaParams {
  selectedCompany: CompanyStore | null;
  selectedCategory: string;
  searchQuery: string;
}

function getDepartmentIcon(department: string) {
  if (department.includes("CARNE") || department.includes("VACUN")) return "🥩";
  if (department.includes("AVE") || department.includes("POLLO")) return "🍗";
  if (department.includes("CERDO")) return "🥓";
  if (department.includes("ACHURA")) return "🔥";
  if (department.includes("EMBUTID") || department.includes("FIAMBR")) return "🌭";
  if (department.includes("PREPARAD") || department.includes("MILANES")) return "🍲";
  if (department.includes("HUEVO")) return "🥚";
  if (department.includes("ALMACEN") || department.includes("CONDIMENT")) return "🛒";
  if (department.includes("VERDU")) return "🥬";
  if (department.includes("CONGELAD")) return "❄️";
  if (department.includes("GRASA")) return "🧈";
  if (department.includes("BEBIDA") || department.includes("KIOSCO")) return "🥤";
  return "📦";
}

/** Un producto pertenece a un comercio si su companyId coincide con el id o el slug. */
export function productBelongsToCompany(product: Product, company: CompanyStore) {
  const productCompany = (product.companyId || "").toLowerCase();
  if (!productCompany) return false;

  const productSucId = (product as any).sucursal_id ?? (product as any).branchId;
  const companySucId = company.sucursal_id;

  // Si el comercio es una sucursal específica: aislamiento estricto de inventario por local
  if (companySucId != null) {
    if (productSucId != null) {
      return Number(productSucId) === Number(companySucId);
    }
    if (productCompany === company.id.toLowerCase()) {
      return true;
    }
    if (productCompany.includes("-suc-")) {
      return false;
    }
    // Si el producto no tiene sufijo -suc-, solo pertenece a la sucursal 1 si no es multirama
    if (Number(companySucId) === 1 || !company.isMultiBranch) {
      const candidates = [
        company.id,
        company.slug,
        company.parentCompanyId,
        company.parentSlug,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      if (
        company.id === "frigorifico-maciel" ||
        company.slug === "maciel" ||
        company.parentCompanyId === "frigorifico-maciel" ||
        company.parentSlug === "maciel"
      ) {
        candidates.push("maciel", "frigorifico-maciel");
      }
      return candidates.includes(productCompany);
    }
    return false;
  }

  // Comercio sin sucursales o vista consolidada
  const candidates = [
    company.id,
    company.slug,
    company.slug && `empresa-${company.slug}`,
    (company as any).parentCompanyId,
    (company as any).parentSlug,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  if (
    company.id === "frigorifico-maciel" ||
    company.slug === "maciel" ||
    (company as any).parentCompanyId === "frigorifico-maciel" ||
    (company as any).parentSlug === "maciel"
  ) {
    candidates.push("maciel", "frigorifico-maciel");
  }
  if (company.id === "empresa-prueba" || company.slug === "prueba") candidates.push("prueba");
  return candidates.includes(productCompany);
}

export function departmentOf(product: CatalogProduct) {
  return String(product.department || product.categoryName || product.category || "GENERAL")
    .trim()
    .toUpperCase();
}

const FALLBACK_COMPANIES: CompanyStore[] = [
  {
    id: "frigorifico-maciel-suc-1",
    name: "Maciel · Alfaro 1964",
    slug: "maciel",
    empresa_id: 1,
    category: "Carnes y Pescados",
    categorySlug: "carnes",
    rating: 5,
    ratingCount: 12,
    deliveryTimeMin: 20,
    deliveryTimeMax: 40,
    deliveryFee: 1500,
    badges: ["Carnes de Primera"],
    address: "Doctor Aráoz Alfaro 1964, Monterrey, Presidente Derqui",
    phone: "1135627803",
    isOpen: true,
    sucursal_id: 1,
    parentCompanyId: "frigorifico-maciel",
    parentSlug: "maciel",
    isMultiBranch: true,
    isSingleBranch: false,
  },
  {
    id: "frigorifico-maciel-suc-2",
    name: "Maciel · prueba2",
    slug: "prueba2",
    empresa_id: 1,
    category: "Carnes y Pescados",
    categorySlug: "carnes",
    rating: 5,
    ratingCount: 3,
    deliveryTimeMin: 20,
    deliveryTimeMax: 40,
    deliveryFee: 1500,
    badges: [],
    address: "Chacabuco 21300",
    phone: "1135627803",
    isOpen: true,
    sucursal_id: 2,
    parentCompanyId: "frigorifico-maciel",
    parentSlug: "maciel",
    isMultiBranch: true,
    isSingleBranch: false,
  },
];

export function useCatalogoTienda({
  selectedCompany,
  selectedCategory,
  searchQuery,
}: UseCatalogoTiendaParams) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [companies, setCompanies] = useState<CompanyStore[]>(FALLBACK_COMPANIES);
  const [status, setStatus] = useState<CatalogStatus>("ready");
  const [productsStatus, setProductsStatus] = useState<CatalogStatus>("loading");
  const [productsWarnings, setProductsWarnings] = useState<string[]>([]);
  const [companiesCached, setCompaniesCached] = useState(false);
  const [productsCached, setProductsCached] = useState(false);
  const [companiesSavedAt, setCompaniesSavedAt] = useState<string | null>(null);
  const [productsSavedAt, setProductsSavedAt] = useState<string | null>(null);
  const [companiesCacheError, setCompaniesCacheError] = useState(false);
  const [productsCacheError, setProductsCacheError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    let loading = false;
    let refreshQueued = false;
    let activeRequest: AbortController | null = null;
    const cachedCompanies = readCompaniesCache();
    const cachedProducts = readProductsCache();
    if (cachedCompanies) {
      setCompanies(cachedCompanies.data);
      setCompaniesSavedAt(cachedCompanies.savedAt);
      setCompaniesCached(true);
      setStatus("ready");
    } else {
      setCompanies(FALLBACK_COMPANIES);
      setStatus("ready");
      setCompaniesCached(false);
    }
    if (cachedProducts) {
      setProducts(asCachedProducts(cachedProducts.data));
      setProductsSavedAt(cachedProducts.savedAt);
      setProductsCached(true);
      setProductsStatus("ready");
    }

    const loadCompanies = async (signal: AbortSignal): Promise<CompanyStore[]> => {
      const response = await fetch("/api/cobrofacil/companies", { cache: "no-store", signal });
      if (!response.ok) throw new Error(`Error cargando comercios: ${response.status}`);
      const companiesData = await response.json();
      if (!Array.isArray(companiesData?.empresas) || !companiesData.empresas.every(isCatalogCompany)) {
        throw new Error("Cobro Fácil no devolvió el listado de comercios");
      }
      return companiesData.empresas;
    };

    const loadProducts = async (signal: AbortSignal): Promise<{
      products: CatalogProduct[];
      warnings: string[];
    }> => {
      const response = await fetch("/api/cobrofacil/products", { cache: "no-store", signal });
      if (!response.ok) throw new Error(`Error cargando productos: ${response.status}`);
      const productsData = await response.json();
      if (!Array.isArray(productsData?.products) || !productsData.products.every(isCatalogProduct)) {
        throw new Error("Cobro Fácil no devolvió el catálogo de productos");
      }
      const warnings = Array.isArray(productsData.warnings)
        ? productsData.warnings.map(String)
        : [];
      return { products: productsData.products, warnings };
    };

    const load = async (retryCount = 0) => {
      if (loading) {
        refreshQueued = true;
        return;
      }
      loading = true;
      activeRequest = new AbortController();
      const request = activeRequest;
      // 35 segundos de timeout para tolerar el inicio en frío (cold start) de Render
      const timeout = window.setTimeout(() => request.abort(), 35000);
      let companiesResult: PromiseSettledResult<CompanyStore[]>;
      let productsResult: PromiseSettledResult<{ products: CatalogProduct[]; warnings: string[] }>;

      try {
        [companiesResult, productsResult] = await Promise.allSettled([
          loadCompanies(request.signal),
          loadProducts(request.signal),
        ]);
      } finally {
        window.clearTimeout(timeout);
      }

      if (cancelled) return;

      const isOnline = typeof navigator === "undefined" || navigator.onLine !== false;
      const companiesOk = companiesResult.status === "fulfilled" && isOnline;
      const productsOk = productsResult.status === "fulfilled" && isOnline;

      // Si falló alguno y aún nos quedan reintentos automáticos, reintentamos antes de dar error visible
      if ((!companiesOk || !productsOk) && retryCount < 2 && !cancelled) {
        loading = false;
        console.warn(`[useCatalogoTienda] Reintentando carga de catálogo en 1.5s (intento ${retryCount + 1}/2)...`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (cancelled) return;
        return load(retryCount + 1);
      }

      if (companiesOk && companiesResult.status === "fulfilled") {
        setCompanies(companiesResult.value);
        setStatus("ready");
        setCompaniesCached(false);
        setCompaniesSavedAt(new Date().toISOString());
        try {
          setCompaniesSavedAt(saveCompaniesCache(companiesResult.value));
          setCompaniesCacheError(false);
        } catch (error) {
          console.warn("No se pudieron guardar los comercios para uso sin conexión:", error);
          setCompaniesCacheError(true);
        }
      } else {
        if (companiesResult.status === "rejected") {
          console.warn("No se pudieron actualizar los comercios de Cobro Fácil:", companiesResult.reason);
        }
        const hasCache = Boolean(cachedCompanies?.data?.length);
        if (hasCache && cachedCompanies?.data) {
          setCompanies(cachedCompanies.data);
          setCompaniesCached(true);
          setStatus("ready");
        } else {
          setCompanies(FALLBACK_COMPANIES);
          setCompaniesCached(false);
          setStatus("ready");
        }
      }

      if (productsOk && productsResult.status === "fulfilled") {
        setProducts(productsResult.value.products);
        setProductsWarnings(productsResult.value.warnings);
        setProductsCached(false);
        setProductsSavedAt(new Date().toISOString());
        if (productsResult.value.warnings.length > 0) {
          console.warn(
            "El catálogo se cargó parcialmente desde Cobro Fácil:",
            productsResult.value.warnings
          );
        } else {
          try {
            setProductsSavedAt(saveProductsCache(productsResult.value.products));
            setProductsCacheError(false);
          } catch (error) {
            console.warn("No se pudieron guardar los productos para uso sin conexión:", error);
            setProductsCacheError(true);
          }
        }
        setProductsStatus("ready");
      } else {
        if (productsResult.status === "rejected") {
          console.warn("No se pudieron actualizar los productos de Cobro Fácil:", productsResult.reason);
        }
        const hasCache = Boolean(cachedProducts?.data?.length);
        setProducts((current) => (hasCache ? asCachedProducts(current) : []));
        setProductsCached(hasCache);
        setProductsWarnings([]);
        setProductsStatus("error");
      }

      loading = false;
      if (refreshQueued && isOnline) {
        refreshQueued = false;
        void load();
      }
    };

    void load();
    const timer = window.setInterval(() => {
      const isOnline = typeof navigator === "undefined" || navigator.onLine !== false;
      if (isOnline) void load();
    }, 60000);
    const handleOnline = () => void load();
    const handleOffline = () => {
      const hasCompCache = Boolean(readCompaniesCache()?.data?.length);
      const hasProdCache = Boolean(readProductsCache()?.data?.length);
      setCompaniesCached(hasCompCache);
      setProductsCached(hasProdCache);
      setProducts((current) => asCachedProducts(current));
      setProductsStatus("error");
    };
    const handleVisible = () => {
      const isOnline = typeof navigator === "undefined" || navigator.onLine !== false;
      if (document.visibilityState === "visible" && isOnline) {
        void load();
      }
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      cancelled = true;
      activeRequest?.abort();
      window.clearInterval(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [reloadKey]);

  /** Cantidad de productos reales por comercio (para mostrar en la portada). */
  const productCountByCompany = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const company of companies) {
      counts[company.id] = products.filter((product) =>
        productBelongsToCompany(product, company)
      ).length;
    }
    return counts;
  }, [companies, products]);

  const activeCompanyCatalog = useMemo(() => {
    if (!selectedCompany) return [];
    return products.filter((product) => productBelongsToCompany(product, selectedCompany));
  }, [products, selectedCompany]);

  const companyDepartments = useMemo(() => {
    if (!selectedCompany) return [];
    const counts = new Map<string, number>();
    activeCompanyCatalog.forEach((product) => {
      const department = departmentOf(product);
      counts.set(department, (counts.get(department) || 0) + 1);
    });

    const departmentList = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([department, count]) => ({
        id: department.toLowerCase(),
        name: `${department} (${count})`,
        icon: getDepartmentIcon(department),
      }));

    return [
      { id: "todos", name: `Todos (${activeCompanyCatalog.length})`, icon: "🔥" },
      ...departmentList,
    ];
  }, [selectedCompany, activeCompanyCatalog]);

  const filteredProducts = useMemo(() => {
    if (!selectedCompany) return [];
    const query = searchQuery.toLowerCase().trim();
    const category = selectedCategory.toLowerCase();

    return activeCompanyCatalog.filter((product) => {
      const department = departmentOf(product).toLowerCase();
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        (product.description || "").toLowerCase().includes(query) ||
        department.includes(query);
      const matchesCategory =
        category === "todos" ||
        department === category ||
        (product.category || "").toLowerCase() === category;

      return matchesSearch && matchesCategory;
    });
  }, [activeCompanyCatalog, selectedCategory, searchQuery, selectedCompany]);

  return {
    products,
    companies,
    status,
    productsStatus,
    productsWarnings,
    companiesCached,
    productsCached,
    companiesSavedAt,
    productsSavedAt,
    cacheError: companiesCacheError || productsCacheError,
    reload,
    productCountByCompany,
    companyCatalogSize: activeCompanyCatalog.length,
    companyDepartments,
    filteredProducts,
  };
}
