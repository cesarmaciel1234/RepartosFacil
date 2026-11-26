"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Product } from "@/data/mockProducts";
import { CartItem } from "./tipos";
import { useToast } from "@/hooks/use-toast";
import {
  isProductPurchasable,
  productAvailabilityMessage,
} from "./productoDisponibilidad";

const STORAGE_KEY = "rf_cart";
const DEFAULT_COMPANY_ID = "frigorifico-maciel";

function isStoredCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (!item.product || typeof item.product !== "object") return false;
  const product = item.product as Record<string, unknown>;
  return (
    typeof product.id === "string" &&
    typeof product.name === "string" &&
    typeof product.category === "string" &&
    typeof product.unit === "string" &&
    typeof product.description === "string" &&
    typeof item.quantity === "number" &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0
  );
}

function getCompanyId(product: Product) {
  return product.companyId || DEFAULT_COMPANY_ID;
}

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { toast } = useToast();

  // Carga inicial segura desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const validItems = parsed.filter(isStoredCartItem);
          setCart(validItems);
          if (validItems.length !== parsed.length) {
            toast({
              title: "Carrito revisado",
              description: "Se omitieron artículos con datos locales dañados.",
            });
          }
        }
      }
    } catch (e) {
      console.warn("No se pudo cargar el carrito local:", e);
    } finally {
      setIsLoaded(true);
    }
  }, [toast]);

  // Persistencia automática ante cambios
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.warn("No se pudo guardar el carrito local:", e);
    }
  }, [cart, isLoaded]);

  const addToCart = useCallback((product: Product) => {
    if (!isProductPurchasable(product)) {
      toast({
        title: "Producto en revisión",
        description:
          productAvailabilityMessage(product) ||
          "El producto no tiene datos vigentes de precio y stock en el TPV.",
      });
      return;
    }

    const existing = cart.find(
      (item) =>
        item.product.id === product.id &&
        getCompanyId(item.product) === getCompanyId(product)
    );
    const currentQuantity = existing?.quantity || 0;
    if (currentQuantity + 1 > product.stockKg) {
      toast({
        title: "Stock insuficiente",
        description: `Solo quedan ${product.stockKg} ${product.unit || "unidades"} informadas por el TPV.`,
      });
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex(
        (item) =>
          item.product.id === product.id &&
          getCompanyId(item.product) === getCompanyId(product)
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          product,
          quantity: next[idx].quantity + 1,
        };
        return next;
      }
      return [...prev, { product, quantity: 1 }];
    });

    toast({
      title: "Agregado al carrito",
      description: `${product.name} fue añadido.`,
      duration: 1500,
    });
  }, [cart, toast]);

  const updateQuantity = useCallback((
    productId: string,
    delta: number,
    companyId?: string
  ) => {
    const currentItem = cart.find(
      (item) =>
        item.product.id === productId &&
        (!companyId || getCompanyId(item.product) === companyId)
    );
    if (!currentItem) return;

    const nextQuantity = currentItem.quantity + delta;
    if (delta > 0 && !isProductPurchasable(currentItem.product)) {
      toast({
        title: "Producto en revisión",
        description:
          productAvailabilityMessage(currentItem.product) ||
          "El producto no tiene datos vigentes de precio y stock en el TPV.",
      });
      return;
    }
    if (
      delta > 0 &&
      isProductPurchasable(currentItem.product) &&
      nextQuantity > currentItem.product.stockKg
    ) {
      toast({
        title: "Stock insuficiente",
        description: `Solo quedan ${currentItem.product.stockKg} ${currentItem.product.unit || "unidades"} informadas por el TPV.`,
      });
      return;
    }

    setCart((prev) => {
      return prev
        .map((item) => {
          if (
            item.product.id === productId &&
            (!companyId || getCompanyId(item.product) === companyId)
          ) {
            const nextQ = item.quantity + delta;
            return nextQ > 0 ? { ...item, quantity: nextQ } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  }, [cart, toast]);

  const removeFromCart = useCallback((productId: string, companyId?: string) => {
    setCart((prev) =>
      prev.filter(
        (item) =>
          item.product.id !== productId ||
          (!companyId || getCompanyId(item.product) !== companyId)
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const clearCompanyCart = useCallback((companyId: string) => {
    setCart((prev) => prev.filter((item) => getCompanyId(item.product) !== companyId));
  }, []);

  const reconcileCatalogProducts = useCallback((products: Product[]) => {
    const catalogById = new Map(products.map((product) => [product.id, product]));
    setCart((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const catalogProduct = catalogById.get(item.product.id);
        if (!catalogProduct) {
          if (item.product.priceSource !== "tpv") return item;
          changed = true;
          return {
            ...item,
            product: { ...item.product, priceSource: undefined },
          };
        }
        if (JSON.stringify(item.product) === JSON.stringify(catalogProduct)) {
          return item;
        }
        changed = true;
        return { ...item, product: catalogProduct };
      });
      return changed ? next : prev;
    });
  }, []);

  const cartTotal = useMemo(() => {
    return cart.reduce(
      (acc, item) =>
        isProductPurchasable(item.product) &&
        item.quantity <= item.product.stockKg
          ? acc + item.product.price * item.quantity
          : acc,
      0
    );
  }, [cart]);

  const cartItemsCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  return {
    cart,
    isLoaded,
    reconcileCatalogProducts,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    clearCompanyCart,
    cartTotal,
    cartItemsCount,
  };
}
