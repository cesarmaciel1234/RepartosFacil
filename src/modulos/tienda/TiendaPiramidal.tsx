"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CompanyStore } from "@/data/mockCompanies";
import { useCart } from "./motor/useCart";
import {
  isProductPurchasable,
  productAvailabilityMessage,
} from "./motor/productoDisponibilidad";
import { createOrder, refreshMissingCustomerProfile, saveMissingCustomerProfile } from "./motor/pedidoService";
import type { CheckoutFormData, DeliveryCoordinates, OrderData } from "./motor/tipos";
import { useCatalogoTienda } from "./catalogo/hooks/useCatalogoTienda";
import { usePedidosCliente } from "./pedidos/hooks/usePedidosCliente";
import { CatalogoEmpresaTienda } from "./catalogo/pantallas/CatalogoEmpresaTienda";
import { AvisoCatalogo, formatSavedTime } from "./catalogo/AvisoCatalogo";
import { HeaderTienda } from "./ui/HeaderTienda";
import { DrawerCarrito, type CompanyCartSummary } from "./ui/DrawerCarrito";
import { ModalCheckout } from "./ui/ModalCheckout";
import { ModalCambiarDireccion } from "./ui/ModalCambiarDireccion";
import { ModalClientAuth } from "./ui/ModalClientAuth";
import { CentroPedidosClienteSheet } from "./ui/CentroPedidosClienteSheet";
import { MensajesClienteSheet } from "./ui/MensajesClienteSheet";
import { useMensajesNoLeidos } from "./pedidos/hooks/useMensajesNoLeidos";
import { OrderChatSheet } from "../repartidor/ui/OrderChatSheet";
import { InicioTienda } from "./pantallas/InicioTienda";
import { SupermercadosTienda } from "./pantallas/SupermercadosTienda";
import { PromocionesTienda } from "./pantallas/PromocionesTienda";
import { HistorialPedidosTienda } from "./pantallas/HistorialPedidosTienda";
import { PerfilCliente } from "./pantallas/PerfilCliente";
import { NavegacionTienda, type SeccionTienda } from "./ui/NavegacionTienda";
import {
  clearClientProfile,
  loadClientProfile,
  type ClientProfile,
} from "../repartidor/motor/driverService";
import { ShoppingBag, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { authHeaders } from "@/lib/clientAuth";

interface TiendaPiramidalProps {
  onSwitchToDriver: () => void;
}

const PLACEHOLDER_DELIVERY_ADDRESSES = new Set([
  "bv orono 1200 rosario",
  "tucuman 2130 rosario",
]);

function normalizeDeliveryAddress(address: string) {
  return address
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isValidDeliveryAddress(address?: string | null): address is string {
  return Boolean(
    address?.trim() &&
      !PLACEHOLDER_DELIVERY_ADDRESSES.has(normalizeDeliveryAddress(address))
  );
}

function readSavedDeliveryCoordinates(): DeliveryCoordinates | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("repartofacil_delivery_coordinates");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.address === "string" &&
      isValidDeliveryAddress(parsed.address) &&
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lng) &&
      Math.abs(parsed.lat) <= 90 &&
      Math.abs(parsed.lng) <= 180
    ) {
      return parsed;
    }
  } catch (error) {
    console.warn("No se pudieron cargar las coordenadas de entrega:", error);
  }
  return null;
}

export function TiendaPiramidal({ onSwitchToDriver }: TiendaPiramidalProps) {
  const { toast } = useToast();
  const {
    cart,
    isLoaded: isCartLoaded,
    reconcileCatalogProducts,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCompanyCart,
    cartTotal,
  } = useCart();

  // Al arrancar, no hay empresa "clavada": arranca en la vista de empresas / mercados
  const [selectedCompany, setSelectedCompany] = useState<CompanyStore | null>(null);
  const selectedCompanyRef = useRef<CompanyStore | null>(null);
  selectedCompanyRef.current = selectedCompany;
  const [selectedCategory, setSelectedCategory] = useState("todos");
  const [activeBottomTab, setActiveBottomTab] = useState<SeccionTienda>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeCartCompanyId, setActiveCartCompanyId] = useState<string | null>(null);
  const [checkoutCompanyId, setCheckoutCompanyId] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isClientAuthOpen, setIsClientAuthOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isOrdersHubOpen, setIsOrdersHubOpen] = useState(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [isOrderChatOpen, setIsOrderChatOpen] = useState(false);
  const [selectedChatOrder, setSelectedChatOrder] = useState<any>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<DeliveryCoordinates | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState<OrderData | null>(null);
  const {
    products,
    companies,
    status: catalogStatus,
    productsStatus: catalogProductsStatus,
    productsWarnings,
    companiesCached,
    productsCached,
    companiesSavedAt,
    productsSavedAt,
    cacheError,
    reload: reloadCatalog,
    productCountByCompany,
    companyCatalogSize,
    companyDepartments,
    filteredProducts,
  } = useCatalogoTienda({
    selectedCompany,
    selectedCategory,
    searchQuery,
  });

  useEffect(() => {
    if (!isCartLoaded) return;
    reconcileCatalogProducts(
      catalogProductsStatus === "ready" ? products : []
    );
  }, [
    catalogProductsStatus,
    isCartLoaded,
    products,
    reconcileCatalogProducts,
  ]);

  const companyCarts = useMemo<CompanyCartSummary[]>(() => {
    const groups = new Map<string, typeof cart>();
    cart.forEach((item) => {
      const companyId = item.product.companyId || "sin-comercio";
      const items = groups.get(companyId) || [];
      items.push(item);
      groups.set(companyId, items);
    });

    return Array.from(groups.entries())
      .map(([companyId, items]) => {
        const company = companies.find(
          (entry) =>
            entry.id === companyId ||
            entry.slug === companyId ||
            entry.id === `empresa-${companyId}`
        );
        return {
          companyId,
          companyName: company?.name || items[0]?.product.companyName || companyId,
          company,
          items,
          total:
            catalogProductsStatus === "ready"
              ? items.reduce(
                  (total, item) =>
                    isProductPurchasable(item.product) &&
                    item.quantity <= item.product.stockKg
                      ? total + item.product.price * item.quantity
                      : total,
                  0
                )
              : 0,
          itemCount: items.reduce((total, item) => total + item.quantity, 0),
        };
      })
      .sort((a, b) => a.companyName.localeCompare(b.companyName, "es"));
  }, [cart, companies, catalogProductsStatus]);
  const selectedCompanyCart = selectedCompany
    ? companyCarts.find(
        (companyCart) =>
          companyCart.companyId === selectedCompany.id ||
          companyCart.company?.id === selectedCompany.id ||
          Boolean(
            selectedCompany.slug &&
              (companyCart.companyId === selectedCompany.slug ||
                companyCart.company?.slug === selectedCompany.slug)
          ) ||
          Boolean(
            selectedCompany.empresa_id &&
              companyCart.company?.empresa_id === selectedCompany.empresa_id
          )
      )
    : undefined;
  const checkoutCart = useMemo(
    () =>
      checkoutCompanyId
        ? cart.filter(
            (item) =>
              (item.product.companyId || "sin-comercio") === checkoutCompanyId
          )
        : [],
    [cart, checkoutCompanyId]
  );
  const checkoutCartTotal =
    catalogProductsStatus === "ready"
      ? checkoutCart.reduce(
          (total, item) =>
            isProductPurchasable(item.product) &&
            item.quantity <= item.product.stockKg
              ? total + item.product.price * item.quantity
              : total,
          0
        )
      : 0;
  const { clientOrdersList, ordersCached, ordersSavedAt } = usePedidosCliente({
    selectedChatOrder,
    setSelectedChatOrder,
    orderConfirmed,
  });
  const { unread, unreadTotal, unreadError } = useMensajesNoLeidos();

  // Cargar y sincronizar dirección de entrega del cliente
  useEffect(() => {
    const client = loadClientProfile();
    setClientProfile(client);
    const savedCoordinates = readSavedDeliveryCoordinates();
    const savedAddress = localStorage.getItem("repartofacil_delivery_address");
    const activeAddress = savedCoordinates?.address ||
      (isValidDeliveryAddress(savedAddress) ? savedAddress : "") ||
      (isValidDeliveryAddress(client?.address) ? client.address : "");
    const activeCoordinates =
      savedCoordinates?.lat && savedCoordinates?.lng ? savedCoordinates : null;
    setDeliveryAddress(activeAddress);
    setDeliveryCoordinates(activeCoordinates);

    const syncAuth = () => {
      const c = loadClientProfile();
      setClientProfile(c);
      const currentCoordinates = readSavedDeliveryCoordinates();
      const currentAddress = currentCoordinates?.address ||
        (isValidDeliveryAddress(localStorage.getItem("repartofacil_delivery_address"))
          ? localStorage.getItem("repartofacil_delivery_address")!
          : isValidDeliveryAddress(c?.address)
            ? c.address
            : "");
      setDeliveryAddress(currentAddress);
      setDeliveryCoordinates(
        currentCoordinates?.lat && currentCoordinates?.lng ? currentCoordinates : null
      );
    };
    const syncClientProfileFromStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "repartofacil_client_user" || event.key === "repartofacil_client_token") {
        setClientProfile(loadClientProfile());
      }
    };
    window.addEventListener("repartofacil-auth", syncAuth);
    window.addEventListener("repartofacil-client-auth", syncAuth);
    window.addEventListener("storage", syncClientProfileFromStorage);
    return () => {
      window.removeEventListener("repartofacil-auth", syncAuth);
      window.removeEventListener("repartofacil-client-auth", syncAuth);
      window.removeEventListener("storage", syncClientProfileFromStorage);
    };
  }, []);

  const handleAddressChange = (
    newAddr: string,
    coordinates: { lat: number; lng: number }
  ) => {
    const location = { address: newAddr, ...coordinates };
    setDeliveryAddress(newAddr);
    setDeliveryCoordinates(location);
    localStorage.setItem("repartofacil_delivery_address", newAddr);
    localStorage.setItem("repartofacil_delivery_coordinates", JSON.stringify(location));

    // Si el usuario estaba en proceso de pago, reabrir el checkout con su ubicación confirmada
    if (checkoutCompanyId) {
      setIsCheckoutOpen(true);
    }
  };

  const handleAddToCart = (product: typeof products[number]) => {
    if (!selectedCompany) return;
    addToCart({
      ...product,
      companyId: product.companyId || selectedCompany.id,
      companyName: product.companyName || selectedCompany.name,
    });
  };

  const updateSelectedCompanyQuantity = (productId: string, delta: number) => {
    const productCompanyId =
      filteredProducts.find((product) => product.id === productId)?.companyId ||
      selectedCompany?.id;
    if (productCompanyId) updateQuantity(productId, delta, productCompanyId);
  };

  const updateDrawerQuantity = (productId: string, delta: number, companyId: string) => {
    updateQuantity(productId, delta, companyId);
  };

  const removeDrawerItem = (productId: string, companyId: string) => {
    removeFromCart(productId, companyId);
  };

  // Manejo de checkout: libre navegación en tienda, solo se pide login al pagar (y luego no vuelve a pedir)
  const handleProceedToPayment = async (companyId: string) => {
    if (catalogProductsStatus !== "ready") {
      toast({
        title: "Inventario no disponible",
        description: "Espera a que Cobro Fácil confirme precio y stock.",
        variant: "destructive",
      });
      return;
    }
    setCheckoutCompanyId(companyId);
    setIsCartOpen(false);
    const client = loadClientProfile();
    if (!client || !authHeaders("Client").Authorization) {
      setIsClientAuthOpen(true);
      return;
    }
    try {
      await refreshMissingCustomerProfile();
      setIsCheckoutOpen(true);
    } catch (error) {
      console.error("No se pudo cargar el perfil del comprador:", error);
      setIsCartOpen(true);
      toast({
        title: "No se pudieron cargar tus datos",
        description: error instanceof Error ? error.message : "Intentá nuevamente.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmOrder = async (formData: CheckoutFormData, expectedClientId: string) => {
    setIsSubmittingOrder(true);
    try {
      if (!checkoutCompanyId || checkoutCart.length === 0) {
        throw new Error("El carrito de este comercio está vacío.");
      }
      if (catalogProductsStatus !== "ready") {
        throw new Error("No se pudo validar el inventario actual. Intenta nuevamente.");
      }
      const unavailableItem = checkoutCart.find(
        (item) =>
          !isProductPurchasable(item.product) ||
          item.quantity > item.product.stockKg
      );
      if (unavailableItem) {
        const reason =
          productAvailabilityMessage(unavailableItem.product) ||
          "la cantidad supera el stock informado por el TPV";
        throw new Error(
          `${unavailableItem.product.name}: ${reason}. Ajusta el carrito antes de continuar.`
        );
      }
      const orderCompany = companies.find(
        (company) =>
          company.id === checkoutCompanyId ||
          company.slug === checkoutCompanyId ||
          company.id === `empresa-${checkoutCompanyId}`
      );
      const companySlug =
        orderCompany?.slug || checkoutCompanyId.replace(/^empresa-/, "");
      const isTestCompany =
        checkoutCompanyId === "empresa-prueba" || companySlug === "prueba";
      const isMacielCompany =
        checkoutCompanyId === "frigorifico-maciel" || companySlug === "maciel";
      const orderForm: CheckoutFormData = {
        ...formData,
        companyId: orderCompany?.id || checkoutCompanyId,
        companySlug,
        empresaId:
          orderCompany?.empresa_id ||
          (isTestCompany ? 2 : isMacielCompany ? 1 : undefined),
        selectedBranch:
          orderCompany?.name ||
          checkoutCart[0]?.product.companyName ||
          formData.selectedBranch,
        deliveryFeeOverride: orderCompany?.deliveryFee,
        freeDeliveryThreshold: orderCompany?.freeDeliveryThreshold,
      };
      await saveMissingCustomerProfile(orderForm, expectedClientId);
      if (loadClientProfile()?.id !== expectedClientId) {
        throw new Error("La sesión cambió. Cerrá el formulario y volvé a abrirlo.");
      }
      const newOrder = await createOrder(checkoutCart, orderForm);
      setIsCheckoutOpen(false);
      setOrderConfirmed(newOrder);
      clearCompanyCart(checkoutCompanyId);
    } catch (error) {
      console.error("No se pudo confirmar el pedido:", error);
      toast({
        title: "No se pudo registrar el pedido",
        description: error instanceof Error
          ? error.message
          : "Tu carrito sigue guardado. Intentá nuevamente más tarde.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const formatMoney = (val: number) => "$" + val.toLocaleString("es-AR");

  // ─── Cada comercio tiene su propia URL: /?tienda=<slug> ───
  const companyKey = (company: CompanyStore) => company.slug || company.id;

  const openCompany = (
    company: CompanyStore,
    initialSearch = "",
    { pushHistory = true }: { pushHistory?: boolean } = {}
  ) => {
    setSelectedCompany(company);
    setSelectedCategory("todos");
    setSearchQuery(initialSearch);
    if (pushHistory && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tienda", companyKey(company));
      window.history.pushState({ tienda: companyKey(company) }, "", url);
    }
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeCompany = ({ pushHistory = true }: { pushHistory?: boolean } = {}) => {
    setSelectedCompany(null);
    setSelectedCategory("todos");
    setSearchQuery("");
    if (pushHistory && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("tienda")) {
        url.searchParams.delete("tienda");
        window.history.pushState({}, "", url);
      }
    }
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const findCompanyByKey = (key: string | null) => {
    if (!key) return null;
    const normalizedKey = key.toLowerCase().trim();
    return (
      companies.find((company) => {
        const id = (company.id || "").toLowerCase();
        const slug = (company.slug || "").toLowerCase();
        const parentId = ((company as any).parentCompanyId || "").toLowerCase();
        const parentSlug = ((company as any).parentSlug || "").toLowerCase();
        return (
          slug === normalizedKey ||
          id === normalizedKey ||
          id === `empresa-${normalizedKey}` ||
          parentId === normalizedKey ||
          parentSlug === normalizedKey ||
          (normalizedKey === "maciel" && (id.includes("maciel") || slug.includes("maciel")))
        );
      }) || null
    );
  };

  // Abrir la tienda indicada en la URL al cargar y responder al botón "atrás" del navegador
  useEffect(() => {
    if (catalogStatus !== "ready") return;
    const syncFromUrl = () => {
      const key = new URL(window.location.href).searchParams.get("tienda");
      const company = findCompanyByKey(key);
      if (company && company.id === selectedCompanyRef.current?.id) {
        setSelectedCompany(company);
      } else if (company) {
        openCompany(company, "", { pushHistory: false });
      } else if (selectedCompanyRef.current) {
        closeCompany({ pushHistory: false });
      }
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogStatus, companies]);

  const browseProps = {
    companies,
    companiesCached,
    products,
    status: catalogStatus,
    onRetry: reloadCatalog,
    productCountByCompany,
    onSelectCompany: (company: CompanyStore, initialSearch?: string) =>
      openCompany(company, initialSearch || ""),
    searchQuery,
    onSearchChange: setSearchQuery,
    deliveryAddress,
    deliveryCoordinates,
  };

  return (
    <div className="min-h-screen w-full bg-white text-slate-900 flex flex-col font-sans pb-32">
      {/* ─── Encabezado Superior (Blanco y Azul con el camioncito y el carrito arriba) ─── */}
      <HeaderTienda
        cartCount={companyCarts.length}
        cartTotal={catalogProductsStatus === "ready" ? cartTotal : 0}
        deliveryType="delivery"
        deliveryAddress={deliveryAddress}
        selectedCompanyName={selectedCompany ? selectedCompany.name : null}
        onBackToMarkets={() => closeCompany()}

        onChangeAddress={() => setIsAddressModalOpen(true)}
        onOpenCart={() => {
          setActiveCartCompanyId(null);
          setIsCartOpen(true);
        }}
        onSwitchToDriver={onSwitchToDriver}
        onOpenOrderChat={() => setIsMessagesOpen(true)}
        unreadCount={unreadTotal}
        unreadError={unreadError}
      />

      {/* ─── Contenido Principal ─── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 space-y-4">
        <AvisoCatalogo
          companiesCached={companiesCached}
          productsCached={productsCached}
          companiesSavedAt={companiesSavedAt}
          productsSavedAt={productsSavedAt}
          productsError={catalogProductsStatus === "error"}
          warnings={productsWarnings}
          cacheError={cacheError}
          onRetry={reloadCatalog}
        />
        {activeBottomTab === "orders" && ordersCached && (
          <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
            Mostramos los pedidos guardados; sus estados pueden haber cambiado ({formatSavedTime(ordersSavedAt)}).
          </p>
        )}
        {activeBottomTab === "profile" ? (
          <PerfilCliente
            clientProfile={clientProfile}
            isClientAuthenticated={!!clientProfile && !!authHeaders("Client").Authorization}
            deliveryAddress={deliveryAddress}
            onLogin={() => setIsClientAuthOpen(true)}
            onLogout={() => {
              clearClientProfile();
              setClientProfile(null);
            }}
            onEditAddress={() => setIsAddressModalOpen(true)}
            onSwitchToDriver={onSwitchToDriver}
          />
        ) : activeBottomTab === "orders" ? (
          <HistorialPedidosTienda
            orders={clientOrdersList}
            onGoToHome={() => setActiveBottomTab("home")}
            onSelectActiveOrder={(order) => {
              setActiveOrderId(String(order.id));
              setIsOrdersHubOpen(true);
            }}
            onSelectOrderChat={(order) => {
              setSelectedChatOrder(order);
              setIsOrderChatOpen(true);
            }}
          />
        ) : !selectedCompany ? (
          activeBottomTab === "markets" ? (
            <SupermercadosTienda {...browseProps} />
          ) : activeBottomTab === "promotions" ? (
            <PromocionesTienda {...browseProps} />
          ) : (
            <InicioTienda {...browseProps} />
          )
        ) : (
          <CatalogoEmpresaTienda
            company={selectedCompany}
            companyCached={companiesCached}
            categories={companyDepartments}
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
            products={filteredProducts}
            cart={cart}
            deliveryCoordinates={deliveryCoordinates}
            deliveryAddress={deliveryAddress}
            onOpenChangeAddress={() => setIsAddressModalOpen(true)}
            catalogStatus={catalogProductsStatus}
            onRetry={reloadCatalog}
            onSearchChange={setSearchQuery}
            onCategorySelect={setSelectedCategory}
            onAddToCart={handleAddToCart}
            onUpdateQuantity={updateSelectedCompanyQuantity}
            catalogSize={companyCatalogSize}
            onBackToStores={() => closeCompany()}
          />
        )}
      </main>

      {/* ─── Barra Inferior Flotante Móvil (Acceso Rápido al Carrito) ─── */}
      {selectedCompanyCart && (
        <div
          style={{
            bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
          }}
          className="fixed left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-30"
        >
          <Button
            onClick={() => {
              setActiveCartCompanyId(selectedCompanyCart.companyId);
              setIsCartOpen(true);
            }}
            className="w-full h-13 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-xl shadow-blue-600/30 border border-blue-500 flex items-center justify-between px-4 active:scale-98 transition-all"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-xs font-black leading-tight">
                  {selectedCompanyCart.itemCount}{" "}
                  {selectedCompanyCart.itemCount === 1 ? "ítem" : "ítems"}
                </div>
                <div className="max-w-[200px] truncate text-[10px] font-medium text-blue-100">
                  Carrito de {selectedCompanyCart.companyName}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-tight">
                {formatMoney(selectedCompanyCart.total)}
              </span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Button>
        </div>
      )}

      <NavegacionTienda
        activeSection={activeBottomTab}
        onChangeSection={(section) => {
          setActiveBottomTab(section);
          closeCompany();
        }}
      />

      {/* ─── Drawer Lateral del Carrito ─── */}
      <DrawerCarrito
        isOpen={isCartOpen}
        onOpenChange={setIsCartOpen}
        companyCarts={companyCarts}
        activeCompanyCartId={activeCartCompanyId}
        inventoryReady={catalogProductsStatus === "ready"}
        deliveryType="delivery"
        deliveryAddress={deliveryAddress}
        deliveryCoordinates={deliveryCoordinates}
        onSelectCompanyCart={setActiveCartCompanyId}
        onUpdateQuantity={updateDrawerQuantity}
        onRemoveItem={removeDrawerItem}
        onClearCompanyCart={clearCompanyCart}
        onRemoveCompanyCart={clearCompanyCart}
        onProceedToPayment={handleProceedToPayment}
        onContinueShopping={(companyId) => {
          const company = companies.find(
            (entry) =>
              entry.id === companyId ||
              entry.slug === companyId ||
              entry.id === `empresa-${companyId}`
          );
          if (!company) {
            toast({
              title: "No encontramos este comercio",
              description: "Volvé a la lista de comercios y abrí su carrito nuevamente.",
              variant: "destructive",
            });
            return;
          }
          openCompany(company);
          setIsCartOpen(false);
          setActiveCartCompanyId(null);
        }}
      />

      {/* ─── Modal de Checkout y Pago ─── */}
      <ModalCheckout
        isOpen={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        cartTotal={checkoutCartTotal}
        companyName={
          companyCarts.find((companyCart) => companyCart.companyId === checkoutCompanyId)
            ?.companyName
        }
        companyDeliveryFee={
          companyCarts.find((companyCart) => companyCart.companyId === checkoutCompanyId)
            ?.company?.deliveryFee
        }
        freeDeliveryThreshold={
          companyCarts.find((companyCart) => companyCart.companyId === checkoutCompanyId)
            ?.company?.freeDeliveryThreshold
        }
        profileAddress={
          isValidDeliveryAddress(clientProfile?.address)
            ? clientProfile.address
            : undefined
        }
        selectedDeliveryAddress={deliveryAddress}
        deliveryCoordinates={deliveryCoordinates}
        onOpenAddressPicker={() => {
          setIsCheckoutOpen(false);
          setIsAddressModalOpen(true);
        }}
        isSubmitting={isSubmittingOrder}
        onConfirmOrder={handleConfirmOrder}
        orderConfirmed={orderConfirmed}
        onCloseConfirmed={() => {
          setOrderConfirmed(null);
          setCheckoutCompanyId(null);
        }}
      />

      {/* ─── Modal para Editar / Cambiar Dirección de Entrega ─── */}
      <ModalCambiarDireccion
        isOpen={isAddressModalOpen}
        onOpenChange={setIsAddressModalOpen}
        currentAddress={deliveryAddress}
        onSelectAddress={handleAddressChange}
      />

      {/* ─── Modal de Autenticación de Cliente (Solo requerido al pagar si no está logueado) ─── */}
      <ModalClientAuth
        isOpen={isClientAuthOpen}
        onOpenChange={setIsClientAuthOpen}
        onSuccess={() => {
          setIsClientAuthOpen(false);
          const savedCoordinates = readSavedDeliveryCoordinates();
          if (savedCoordinates) {
            setDeliveryAddress(savedCoordinates.address);
            setDeliveryCoordinates(savedCoordinates);
          }
          if (checkoutCompanyId && checkoutCart.length > 0) {
            setIsCheckoutOpen(true);
          }
        }}
      />

      {/* ─── Centro de Pedidos en Curso (Hub Multitienda con el camioncito) ─── */}
      <CentroPedidosClienteSheet
        isOpen={isOrdersHubOpen}
        onOpenChange={setIsOrdersHubOpen}
        orders={clientOrdersList}
        ordersCached={ordersCached}
        ordersSavedAt={ordersSavedAt}
        initialOrderId={activeOrderId}
      />

      <MensajesClienteSheet
        isOpen={isMessagesOpen}
        onOpenChange={setIsMessagesOpen}
        unread={unread}
        unreadError={unreadError}
      />

      {/* ─── Chat Tripartito Privado del Pedido Seleccionado ─── */}
      <OrderChatSheet
        isOpen={isOrderChatOpen}
        onOpenChange={setIsOrderChatOpen}
        activeOrder={selectedChatOrder || clientOrdersList[0] || null}
        viewerRole="client"
        deliveryAddress={deliveryAddress}
        onBackToOrdersHub={() => {
          setIsOrderChatOpen(false);
          setIsMessagesOpen(true);
        }}
      />
    </div>
  );
}
