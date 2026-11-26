import { CartItem, CheckoutFormData, OrderData } from "./tipos";
import { calcularTarifaEnvio, estimateAddressCoords, MARKET_CENTRAL } from "./tarifaUberService";
import { authHeaders } from "@/lib/clientAuth";
import {
  loadClientProfile,
  saveClientProfile,
  getOrCreateActiveClientIdentity,
  ORDERS_STORAGE_KEY,
} from "@/modulos/repartidor/motor/driverService";
import {
  isProductPurchasable,
  productAvailabilityMessage,
} from "./productoDisponibilidad";

const CUSTOMER_STORAGE_KEY = "rf_customer_data";
const PLACEHOLDER_CUSTOMER_NAMES = new Set(["cliente", "cliente frecuente"]);
const PLACEHOLDER_CUSTOMER_PHONE = "+54 9 341 555-1234";
const PLACEHOLDER_CUSTOMER_ADDRESSES = new Set([
  "bv. oroño 1200, rosario",
  "bv orono 1200 rosario",
  "tucumán 2130, rosario",
  "tucuman 2130, rosario",
]);
const PAYMENT_METHOD_MAP: Record<CheckoutFormData["paymentMethod"], OrderData["paymentMethod"]> = {
  efectivo: "cash",
  transferencia: "transfer",
  tarjeta: "card",
};

export function loadSavedCustomer(): Partial<CheckoutFormData> {
  if (typeof window === "undefined") return {};
  try {
    const client = loadClientProfile();
    if (client) {
      const customerName = client.displayName.trim();
      const customerPhone =
        client.phone === PLACEHOLDER_CUSTOMER_PHONE ? "" : client.phone || "";
      const deliveryAddress =
        PLACEHOLDER_CUSTOMER_ADDRESSES.has(
          (client.address || "").trim().toLocaleLowerCase("es-AR")
        )
          ? ""
          : client.address || "";

      return {
        customerName: PLACEHOLDER_CUSTOMER_NAMES.has(customerName.toLocaleLowerCase("es-AR"))
          ? ""
          : customerName,
        customerPhone,
        deliveryAddress,
        deliveryType: "delivery",
      };
    }

    const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as Partial<CheckoutFormData>;
    const customerName = saved.customerName?.trim() || "";
    const customerPhone = saved.customerPhone?.trim() || "";
    const deliveryAddress = saved.deliveryAddress?.trim() || "";
    return {
      ...saved,
      customerName: PLACEHOLDER_CUSTOMER_NAMES.has(customerName.toLocaleLowerCase("es-AR"))
        ? ""
        : customerName,
      customerPhone:
        customerPhone === PLACEHOLDER_CUSTOMER_PHONE ? "" : customerPhone,
      deliveryAddress: PLACEHOLDER_CUSTOMER_ADDRESSES.has(
        deliveryAddress.toLocaleLowerCase("es-AR")
      )
        ? ""
        : deliveryAddress,
    };
  } catch {
    return {};
  }
}

export function saveCustomerData(form: CheckoutFormData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      CUSTOMER_STORAGE_KEY,
      JSON.stringify({
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        deliveryAddress: form.deliveryAddress,
        deliveryType: form.deliveryType,
        selectedBranch: form.selectedBranch,
      })
    );
  } catch (e) {
    console.warn("No se pudo guardar datos del cliente:", e);
  }
}

export async function readRegisteredCustomer(profileId: string, authorization: string): Promise<{
  displayName?: string;
  phone?: string;
  address?: string;
} | null> {
  let response: Response;
  try {
    response = await fetch(`/api/db/clients/${encodeURIComponent(profileId)}`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });
  } catch (error) {
    console.warn("No se pudo consultar el perfil del comprador:", error);
    throw new Error("No se pudieron cargar tus datos de contacto. Revisá tu conexión e intentá nuevamente.");
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("No se pudieron cargar tus datos de contacto. Intentá nuevamente.");
  }
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("El perfil recibido no es válido. Intentá nuevamente.");
  }
  const profile = data as Record<string, unknown>;
  if (["displayName", "phone", "address"].some(
    (key) => profile[key] != null && typeof profile[key] !== "string"
  )) {
    throw new Error("El perfil recibido no es válido. Intentá nuevamente.");
  }
  return {
    displayName: typeof profile.displayName === "string" ? profile.displayName : undefined,
    phone: typeof profile.phone === "string" ? profile.phone : undefined,
    address: typeof profile.address === "string" ? profile.address : undefined,
  };
}

export async function refreshMissingCustomerProfile(): Promise<void> {
  const profile = loadClientProfile();
  const authorization = authHeaders("Client").Authorization;
  if (!profile || !authorization) throw new Error("Iniciá sesión como comprador para continuar.");
  const saved = loadSavedCustomer();
  if (saved.customerName?.trim() && saved.customerPhone?.trim()) return;

  const registered = await readRegisteredCustomer(profile.id, authorization);
  if (loadClientProfile()?.id !== profile.id || authHeaders("Client").Authorization !== authorization) {
    throw new Error("La sesión cambió. Volvé a abrir el carrito.");
  }
  if (!registered) return;
  const name = typeof registered.displayName === "string" ? registered.displayName.trim() : "";
  const phone = typeof registered.phone === "string" ? registered.phone.trim() : "";
  const address = typeof registered.address === "string" ? registered.address.trim() : "";
  const updates = {
    ...(!saved.customerName?.trim() && name && !PLACEHOLDER_CUSTOMER_NAMES.has(name.toLocaleLowerCase("es-AR")) ? { displayName: name } : {}),
    ...(!saved.customerPhone?.trim() && phone && phone !== PLACEHOLDER_CUSTOMER_PHONE ? { phone } : {}),
    ...(!saved.deliveryAddress?.trim() && address && !PLACEHOLDER_CUSTOMER_ADDRESSES.has(address.toLocaleLowerCase("es-AR")) ? { address } : {}),
  };
  if (Object.keys(updates).length) saveClientProfile({ ...profile, ...updates });
}

export async function saveMissingCustomerProfile(form: CheckoutFormData, expectedClientId: string): Promise<void> {
  const profile = loadClientProfile();
  const headers = authHeaders("Client");
  if (!profile || !headers.Authorization || profile.id !== expectedClientId) {
    throw new Error("La sesión cambió. Cerrá el formulario y volvé a abrirlo.");
  }
  const saved = loadSavedCustomer();
  const updates: { displayName?: string; phone?: string } = {};
  if (!saved.customerName?.trim()) updates.displayName = form.customerName.trim();
  if (!saved.customerPhone?.trim()) updates.phone = form.customerPhone.trim();
  if (!Object.keys(updates).length) return;
  if (("displayName" in updates && !updates.displayName) || ("phone" in updates && !updates.phone)) {
    throw new Error("Completá tu nombre y teléfono de contacto.");
  }

  let response: Response;
  try {
    response = await fetch(`/api/db/clients/${encodeURIComponent(profile.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(updates),
    });
  } catch (error) {
    console.warn("No se pudieron guardar los datos del comprador:", error);
    throw new Error("No se pudieron guardar tus datos de contacto. Revisá tu conexión e intentá nuevamente.");
  }
  if (!response.ok) {
    throw new Error("No se pudieron guardar tus datos de contacto. Intentá nuevamente.");
  }
  if (loadClientProfile()?.id !== expectedClientId || authHeaders("Client").Authorization !== headers.Authorization) {
    throw new Error("La sesión cambió. Cerrá el formulario y volvé a abrirlo.");
  }
  saveClientProfile({ ...profile, ...updates });
}

export async function createOrder(
  cart: CartItem[],
  form: CheckoutFormData
): Promise<OrderData> {
  const headers = authHeaders("Client");
  if (!loadClientProfile() || !headers.Authorization) {
    throw new Error("Iniciá sesión como comprador para confirmar el pedido.");
  }
  const verifiedCart = cart.map((item) => {
    if (!isProductPurchasable(item.product)) {
      throw new Error(
        `${item.product.name}: ${
          productAvailabilityMessage(item.product) || "producto no disponible"
        }.`
      );
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error(`${item.product.name}: la cantidad del carrito no es válida.`);
    }
    if (item.quantity > item.product.stockKg) {
      throw new Error(
        `${item.product.name}: la cantidad supera el stock informado por el TPV.`
      );
    }
    return { ...item, product: item.product };
  });
  const subtotal = verifiedCart.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );

  // Cálculo de tarifa estándar Uber / PedidosYa
  const tarifa = calcularTarifaEnvio(form.deliveryAddress || "");
  const freeDeliveryThreshold =
    typeof form.freeDeliveryThreshold === "number" &&
    Number.isFinite(form.freeDeliveryThreshold) &&
    form.freeDeliveryThreshold >= 0
      ? form.freeDeliveryThreshold
      : 35000;
  const deliveryFeeOverride =
    typeof form.deliveryFeeOverride === "number" &&
    Number.isFinite(form.deliveryFeeOverride) &&
    form.deliveryFeeOverride >= 0
      ? form.deliveryFeeOverride
      : null;
  const deliveryFee =
    form.deliveryType === "delivery" && subtotal > 0
      ? subtotal >= freeDeliveryThreshold
        ? 0
        : deliveryFeeOverride !== null
        ? deliveryFeeOverride
        : tarifa.totalDeliveryFee
      : 0;

  const total = subtotal + deliveryFee;
  const orderId = `RF-${crypto.randomUUID()}`;
  const destCoords = form.deliveryCoordinates
    ? { lat: Number(form.deliveryCoordinates.lat), lng: Number(form.deliveryCoordinates.lng) }
    : estimateAddressCoords(form.deliveryAddress || "").coords;

  // Asignar IDs únicos de usuario, perfil cliente y empresa destinataria (aislamiento estricto)
  const identity = getOrCreateActiveClientIdentity();
  const clientId = identity.clientId;
  const clientUserId = identity.userId;
  
  const targetCompanyId = form.companyId || cart[0]?.product?.companyId || "frigorifico-maciel";
  const rawSlug = (form.companySlug || targetCompanyId.replace(/^empresa-/, "")).toLowerCase().trim();
  const isPrueba = targetCompanyId === "empresa-prueba" || rawSlug === "prueba";
  const isMaciel = targetCompanyId === "frigorifico-maciel" || rawSlug === "maciel";
  const empresaId =
    typeof form.empresaId === "number" && form.empresaId > 0
      ? form.empresaId
      : isPrueba
      ? 2
      : isMaciel
      ? 1
      : Number(rawSlug) || 0;
  const empresaSlug = isMaciel ? "maciel" : isPrueba ? "prueba" : rawSlug || "maciel";
  const companyBranchName =
    form.selectedBranch ||
    cart[0]?.product?.companyName ||
    (isPrueba ? "Cobro Fácil - Empresa Prueba" : isMaciel ? "Frigorífico Maciel - Central" : rawSlug.toUpperCase());

  const newOrder: any = {
    id: orderId,
    clientId,
    clientUserId,
    empresaId,
    empresaSlug,
    companyId: targetCompanyId,
    clientName: form.customerName.trim(),
    customerName: form.customerName.trim(),
    customerPhone: form.customerPhone.trim(),
    deliveryType: form.deliveryType,
    deliveryAddress:
      form.deliveryType === "delivery" ? form.deliveryAddress.trim() : companyBranchName,
    paymentMethod: PAYMENT_METHOD_MAP[form.paymentMethod],
    notes: form.orderNotes.trim() || undefined,
    items: verifiedCart.map((i) => ({
      id: i.product.id,
      name: i.product.name,
      price: i.product.price,
      unit: i.product.unit,
      quantity: i.quantity,
    })),
    subtotal,
    deliveryFee,
    total,
    status: "pending_store",

    // Métricas para el repartidor (Uber / PedidosYa)
    distanceToStoreKm: 0.8,
    distanceToDeliveryKm: tarifa.distanceKm,
    distanceKm: tarifa.distanceKm,
    driverEarnings: tarifa.driverEarnings,
    isPeakHour: tarifa.isPeakHour,
    estimatedMinutes: tarifa.estimatedMinutes,
    branch: companyBranchName,
    storeCoords: MARKET_CENTRAL.coords,
    destinationCoords: destCoords,
    deliveryCoordinates: destCoords,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: "RepartoFacil Web",
  };

  // 1. Guardar datos de cliente para compras futuras
  saveCustomerData(form);

  // 2. Persistencia central: no confirmar un pedido que no llegó al servidor
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      ...newOrder,
      deliveryLat: destCoords.lat,
      deliveryLng: destCoords.lng,
      deliveryCoordinates: destCoords,
      destinationCoords: destCoords,
    }),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Tu sesión no permite comprar. Volvé a iniciar sesión.");
    }
    if (response.status === 409 || response.status === 503) {
      const error = await response.json();
      throw new Error(typeof error.error === "string" ? error.error : "No se pudo validar el pedido.");
    }
    throw new Error(`No se pudo registrar el pedido en el servidor (HTTP ${response.status}).`);
  }

  // 3. Persistencia en historial local (alimenta la vista inmediata del comprador)
  try {
    const existing: any[] = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) || "[]");
    existing.unshift(newOrder);
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(existing));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("rf-orders-updated", { detail: newOrder }));
    }
  } catch (e) {
    console.warn("Error guardando en historial local:", e);
  }

  return newOrder;
}

export function buildWhatsAppLink(order: OrderData, phoneNumber = "5491100000000"): string {
  const paymentLabels: Record<OrderData["paymentMethod"], string> = {
    cash: "Efectivo",
    transfer: "Transferencia",
    card: "Tarjeta",
    web: "Pago web",
  };
  const itemsText = order.items
    .map(
      (i: any) =>
        `• ${i.quantity} ${i.unit} de *${i.name}* ($${(i.price * i.quantity).toLocaleString("es-AR")})`
    )
    .join("\n");

  const msg =
    `🥩 *NUEVO PEDIDO REPARTO FÁCIL* #${order.id}\n\n` +
    `👤 *Cliente:* ${order.customerName}\n` +
    `📱 *Teléfono:* ${order.customerPhone}\n` +
    `📍 *Destino:* ${order.deliveryAddress} (${
      order.deliveryType === "delivery" ? "Envío a domicilio" : "Retiro en sucursal"
    })\n` +
    `💳 *Pago:* ${paymentLabels[order.paymentMethod]}\n\n` +
    `🛒 *Detalle de compra:*\n${itemsText}\n\n` +
    (order.deliveryFee > 0
      ? `🛵 *Costo de envío:* $${order.deliveryFee.toLocaleString("es-AR")}\n`
      : `🛵 *Envío:* GRATIS\n`) +
    `💰 *TOTAL A ABONAR:* $${order.total.toLocaleString("es-AR")}\n\n` +
    `_Pedido procesado automáticamente por Reparto Fácil Market._`;

  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(msg)}`;
}
