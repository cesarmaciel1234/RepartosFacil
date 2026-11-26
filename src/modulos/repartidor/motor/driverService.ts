import { DriverOrder, DriverProfile } from "./tipos";

export const DRIVER_USER_KEY = "repartofacil_driver_user";
export const DRIVER_TOKEN_KEY = "repartofacil_driver_token";
export const CLIENT_USER_KEY = "repartofacil_client_user";
export const CLIENT_TOKEN_KEY = "repartofacil_client_token";
export const ORDERS_STORAGE_KEY = "rf_orders_history";

export const DEFAULT_AVAILABLE_ORDERS: DriverOrder[] = [
  {
    id: "RF-7420",
    clientName: "Familia Gómez",
    deliveryAddress: "San Lorenzo 2040, Rosario",
    customerPhone: "+54 9 11 4589-2310",
    items: [
      { name: "Asado Especial Novillito", quantity: 2, unit: "kg", price: 9800 },
      { name: "Chorizo Criollo Puro Cerdo", quantity: 1, unit: "kg", price: 6500 },
      { name: "Carbón Vegetal 4kg", quantity: 1, unit: "bolsa", price: 2300 },
    ],
    subtotal: 28400,
    deliveryFee: 2100,
    total: 30500,
    paymentMethod: "cash",
    status: "Pending",
    distanceToStoreKm: 0.6,
    distanceToDeliveryKm: 1.1,
    distanceKm: 1.7,
    driverEarnings: 2450,
    isPeakHour: true,
    estimatedMinutes: 18,
    branch: "Alfaro 1964 (Presidente Derqui)",
    storeCoords: { lat: -34.486522, lng: -58.833579 },
    destinationCoords: { lat: -34.4895, lng: -58.8315 },
    createdAt: new Date().toISOString(),
  },
  {
    id: "RF-7421",
    clientName: "Martín Benítez",
    deliveryAddress: "Belgrano 450, Presidente Derqui",
    customerPhone: "+54 9 11 3214-9988",
    items: [
      { name: "Vacío Fino de Ternera", quantity: 1.5, unit: "kg", price: 10400 },
      { name: "Morcilla Bombón Casera", quantity: 0.8, unit: "kg", price: 5250 },
    ],
    subtotal: 19800,
    deliveryFee: 1850,
    total: 21650,
    paymentMethod: "cash",
    status: "Pending",
    distanceToStoreKm: 0.8,
    distanceToDeliveryKm: 1.4,
    distanceKm: 2.2,
    driverEarnings: 2100,
    isPeakHour: true,
    estimatedMinutes: 22,
    branch: "Alfaro 1964 (Presidente Derqui)",
    storeCoords: { lat: -34.486522, lng: -58.833579 },
    destinationCoords: { lat: -34.4830, lng: -58.8350 },
    createdAt: new Date().toISOString(),
  },
  {
    id: "RF-7422",
    clientName: "Lorena Silva",
    deliveryAddress: "Av. de Mayo 820, Presidente Derqui",
    customerPhone: "+54 9 11 6720-1144",
    items: [
      { name: "Combo Gran Parrillada (4 pers)", quantity: 1, unit: "combo", price: 32000 },
      { name: "Matambre de Cerdo", quantity: 1.2, unit: "kg", price: 10416 },
    ],
    subtotal: 44500,
    deliveryFee: 2600,
    total: 47100,
    paymentMethod: "transfer",
    status: "Pending",
    distanceToStoreKm: 1.2,
    distanceToDeliveryKm: 2.3,
    distanceKm: 3.5,
    driverEarnings: 2850,
    isPeakHour: false,
    estimatedMinutes: 28,
    branch: "Alfaro 1964 (Presidente Derqui)",
    storeCoords: { lat: -34.486522, lng: -58.833579 },
    destinationCoords: { lat: -34.4910, lng: -58.8280 },
    createdAt: new Date().toISOString(),
  },
];

export function loadLocalOrders(): DriverOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Excluir órdenes demo antiguas sin clientId real
    return parsed.filter(
      (o) => o && o.id && !["RF-7420", "RF-7421", "RF-7422"].includes(o.id)
    );
  } catch {
    return [];
  }
}

export function saveLocalOrders(orders: DriverOrder[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    window.dispatchEvent(new Event("rf-orders-updated"));
  } catch (e) {
    console.warn("Error guardando órdenes locales:", e);
  }
}

export function generateUniqueEntityId(prefix: "usr_cli" | "usr_rep" | "cli" | "rep"): string {
  const rand = Math.random().toString(36).substring(2, 9);
  const time = Date.now().toString(36).substring(4);
  return `${prefix}_${rand}${time}`;
}

export function loadDriverProfile(): DriverProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRIVER_USER_KEY) || localStorage.getItem("repartofacil_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.role && parsed.role.toLowerCase() !== "driver") {
      return null;
    }

    const driverName = (parsed.firstName || parsed.displayName || "Lucas Motomensajero").trim();
    // ID único de cuenta de usuario y ID único de perfil
    const userId = (parsed.userId && parsed.userId !== "repartidor-01") ? parsed.userId : (parsed.uid && parsed.uid !== "repartidor-01" ? parsed.uid : generateUniqueEntityId("usr_rep"));
    const profileId = (parsed.id && parsed.id !== "repartidor-01") ? parsed.id : generateUniqueEntityId("rep");

    const profile: DriverProfile = {
      id: profileId,
      uid: userId,
      userId: userId,
      firstName: driverName,
      role: "Driver",
      vehicleType: parsed.vehicleType || "Motorcycle",
      availabilityStatus: parsed.availabilityStatus || "Available",
      createdAt: parsed.createdAt || new Date().toISOString(),
    };

    if (!parsed.userId || parsed.id === "repartidor-01") {
      try {
        localStorage.setItem(DRIVER_USER_KEY, JSON.stringify(profile));
      } catch {}
    }

    return profile;
  } catch {
    return null;
  }
}

export interface ClientProfile {
  id: string; // ID único de perfil del cliente (cli_xxxx)
  uid: string;
  userId: string; // ID único de cuenta de usuario (usr_cli_xxxx)
  displayName: string;
  email: string;
  role: "Client";
  phone?: string;
  address?: string;
}

const DEFAULT_CLIENT_PHONE = "+54 9 341 555-1234";
const DEFAULT_CLIENT_ADDRESSES = new Set(["bv orono 1200 rosario", "tucuman 2130 rosario"]);

function normalizeProfileValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function loadClientProfile(): ClientProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CLIENT_USER_KEY) || localStorage.getItem("repartofacil_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.role && parsed.role.toLowerCase() !== "client") {
      return null;
    }

    // ID único de cuenta de usuario y ID único de perfil para blindar aislamiento
    const userId = (parsed.userId && parsed.userId !== "cliente-01") ? parsed.userId : (parsed.uid && parsed.uid !== "cliente-01" ? parsed.uid : generateUniqueEntityId("usr_cli"));
    const profileId = (parsed.id && parsed.id !== "cliente-01") ? parsed.id : generateUniqueEntityId("cli");

    const profile: ClientProfile = {
      id: profileId,
      uid: userId,
      userId: userId,
      displayName: parsed.displayName || parsed.firstName || "Cliente Frecuente",
      email: parsed.email || "cliente@repartofacil.com",
      role: "Client",
      phone:
        typeof parsed.phone === "string" &&
        parsed.phone.trim() &&
        parsed.phone !== DEFAULT_CLIENT_PHONE
          ? parsed.phone.trim()
          : undefined,
      address:
        typeof parsed.address === "string" &&
        parsed.address.trim() &&
        !DEFAULT_CLIENT_ADDRESSES.has(normalizeProfileValue(parsed.address))
          ? parsed.address.trim()
          : undefined,
    };

    if (!parsed.userId || parsed.id === "cliente-01") {
      try {
        localStorage.setItem(CLIENT_USER_KEY, JSON.stringify(profile));
      } catch {}
    }

    return profile;
  } catch {
    return null;
  }
}

export function getOrCreateActiveClientIdentity(): { clientId: string; userId: string } {
  const logged = loadClientProfile();
  if (logged?.id) {
    return { clientId: logged.id, userId: logged.userId || logged.uid || logged.id };
  }
  if (typeof window === "undefined") {
    return { clientId: "cli_ssr", userId: "usr_cli_ssr" };
  }
  try {
    const raw = localStorage.getItem("repartofacil_guest_identity");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.clientId && parsed?.userId) return parsed;
    }
    const created = {
      clientId: generateUniqueEntityId("cli"),
      userId: generateUniqueEntityId("usr_cli"),
    };
    localStorage.setItem("repartofacil_guest_identity", JSON.stringify(created));
    return created;
  } catch {
    return {
      clientId: generateUniqueEntityId("cli"),
      userId: generateUniqueEntityId("usr_cli"),
    };
  }
}

export function saveDriverProfile(profile: DriverProfile, token?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DRIVER_USER_KEY, JSON.stringify(profile));
    if (token) localStorage.setItem(DRIVER_TOKEN_KEY, token);
    window.dispatchEvent(new Event("repartofacil-auth"));
    window.dispatchEvent(new Event("repartofacil-driver-auth"));
  } catch (e) {
    console.warn("Error guardando perfil repartidor:", e);
  }
}

export function clearDriverProfile() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DRIVER_USER_KEY);
    localStorage.removeItem(DRIVER_TOKEN_KEY);
    const legacy = localStorage.getItem("repartofacil_user");
    if (legacy && legacy.toLowerCase().includes('"role":"driver"')) {
      localStorage.removeItem("repartofacil_user");
      localStorage.removeItem("repartofacil_token");
    }
    window.dispatchEvent(new Event("repartofacil-auth"));
    window.dispatchEvent(new Event("repartofacil-driver-auth"));
  } catch {}
}

export function saveClientProfile(profile: ClientProfile, token?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLIENT_USER_KEY, JSON.stringify(profile));
    if (token) localStorage.setItem(CLIENT_TOKEN_KEY, token);
    // Sincronizar identidad activa y limpiar pedidos locales de otros compradores
    localStorage.setItem(
      "repartofacil_guest_identity",
      JSON.stringify({ clientId: profile.id, userId: profile.userId || profile.uid || profile.id })
    );
    try {
      const rawOrders = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (rawOrders) {
        const parsedOrders = JSON.parse(rawOrders);
        if (Array.isArray(parsedOrders)) {
          const onlyMine = parsedOrders.filter((o) => o && o.clientId === profile.id);
          localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(onlyMine));
        }
      }
    } catch {}
    window.dispatchEvent(new Event("repartofacil-auth"));
    window.dispatchEvent(new Event("repartofacil-client-auth"));
    window.dispatchEvent(new Event("rf-orders-updated"));
  } catch (e) {
    console.warn("Error guardando perfil cliente:", e);
    throw new Error("No se pudo guardar la sesión en este dispositivo.");
  }
}

export function clearClientProfile() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CLIENT_USER_KEY);
    localStorage.removeItem(CLIENT_TOKEN_KEY);
    localStorage.removeItem("repartofacil_guest_identity");
    localStorage.removeItem(ORDERS_STORAGE_KEY);
    const legacy = localStorage.getItem("repartofacil_user");
    if (legacy && legacy.toLowerCase().includes('"role":"client"')) {
      localStorage.removeItem("repartofacil_user");
      localStorage.removeItem("repartofacil_token");
    }
    window.dispatchEvent(new Event("repartofacil-auth"));
    window.dispatchEvent(new Event("repartofacil-client-auth"));
    window.dispatchEvent(new Event("rf-orders-updated"));
  } catch {}
}
