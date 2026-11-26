export type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "Ready"
  | "Embalado"
  | "Assigned"
  | "Picked Up"
  | "In Transit"
  | "Delivered"
  | "Cancelled"
  | "Rejected";

export interface OrderItemSummary {
  name: string;
  quantity: number;
  unit: string;
  price?: number;
}

export interface GPSCoords {
  lat: number;
  lng: number;
}

export interface DriverOrder {
  id: string;
  clientName: string;
  customerName?: string;
  deliveryAddress: string;
  customerPhone?: string;
  items: OrderItemSummary[];
  subtotal?: number;
  deliveryFee?: number;
  total: number;
  paymentMethod?: "cash" | "transfer" | "card";
  status: OrderStatus;
  
  // Métricas estándar Uber / PedidosYa
  distanceToStoreKm?: number;    // Distancia del repartidor al market
  distanceToDeliveryKm?: number; // Distancia del market al cliente
  distanceKm?: number;           // Distancia total
  estimatedMinutes?: number;
  driverEarnings?: number | null; // Ganancia neta informada para el repartidor
  isPeakHour?: boolean;          // Tarifa dinámica / horario pico
  
  // Coordenadas para geocerca y mapa
  destinationCoords?: GPSCoords;
  storeCoords?: GPSCoords;
  
  branch?: string;
  ticketId?: string;
  ticket_id?: string;
  notes?: string;
  driverId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DriverProfile {
  id: string; // ID único del perfil repartidor (rep_xxxx)
  uid: string;
  userId?: string; // ID único de la cuenta de usuario (usr_rep_xxxx)
  firstName: string;
  role: "Driver";
  vehicleType?: "Motorcycle" | "Bicycle" | "Car";
  availabilityStatus?: "Available" | "Busy" | "Offline";
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  orderId: string;
  type: "earning" | "cash_collection";
  amount: number;
  description: string;
  timestamp: string;
}

export interface DriverWallet {
  balance: number;          // Ganancias netas acumuladas disponibles
  cashInHand: number;       // Efectivo cobrado de clientes en mano
  completedOrdersCount: number;
  transactions: WalletTransaction[];
}

export type HeadingSource = "gps" | "compass" | "bearing_history" | "initial";

export interface TelemetryState {
  coords: GPSCoords | null;
  heading: number;         // Rumbo suavizado final (0-360)
  rawHeading: number;      // Rumbo crudo antes del filtro
  speed: number | null;    // Velocidad instantánea en m/s (null si está detenido o desconocido)
  accuracy: number | null; // Precisión del GPS en metros
  source: HeadingSource;   // Origen de la orientación (GPS o Brújula)
  isMoving: boolean;       // true si la velocidad supera el umbral de movimiento
  gpsError: string | null;
  requestCompassPermission?: () => Promise<boolean>;
}

export function formatShortOrderCode(idOrTicket?: string | null): string {
  if (!idOrTicket) return "#RF-0000";
  const str = String(idOrTicket).trim();
  const clean = str.replace(/^#?RF-?/i, "");
  const shortPart = clean.slice(0, 4).toUpperCase();
  return `#RF-${shortPart}`;
}

export const STORE_DEFAULT_DERQUI = {
  name: "Frigorífico Maciel (Alfaro 1964)",
  address: "Doctor Aráoz Alfaro 1964, Presidente Derqui, Buenos Aires",
  coords: {
    lat: -34.486522,
    lng: -58.833579,
  },
};


