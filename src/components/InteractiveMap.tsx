
'use client';

import { MapContainer, TileLayer, Marker, Popup, ZoomControl, Polyline, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from '@/firebase/local-firestore';
import { Truck, User, Package, Navigation as NavIcon, AlertTriangle } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatShortOrderCode, STORE_DEFAULT_DERQUI } from '@/modulos/repartidor/motor/tipos';

const fixLeafletIcons = () => {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
};

const getVehicleEmoji = (type?: string) => {
  const t = (type || "").toLowerCase();
  if (t.includes("bici") || t.includes("bicycle")) return "🚲";
  if (t.includes("auto") || t.includes("car")) return "🚗";
  return "🛵";
};

const createSelfDriverIcon = (vehicleType?: string, heading: number = 0) => {
  const emoji = getVehicleEmoji(vehicleType);
  const iconHtml = renderToStaticMarkup(
    <div className="relative flex items-center justify-center">
      <div className="w-11 h-11 rounded-full bg-[#FFE600] border-[2.5px] border-[#2D3277] shadow-xl flex items-center justify-center text-xl transition-transform">
        <span style={{ display: 'inline-block', transform: heading ? `rotate(${heading}deg)` : undefined }}>{emoji}</span>
      </div>
      <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-xs" />
      <div className="absolute w-14 h-14 bg-yellow-400/20 rounded-full animate-ping pointer-events-none" />
    </div>
  );
  return L.divIcon({
    html: iconHtml,
    className: 'self-driver-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

const createFleetDriverIcon = (vehicleType?: string, isBusy: boolean = false) => {
  const emoji = getVehicleEmoji(vehicleType);
  const iconHtml = renderToStaticMarkup(
    <div className="relative flex items-center justify-center">
      <div className="w-9 h-9 rounded-full bg-white border-2 border-slate-300 shadow-md flex items-center justify-center text-base">
        {emoji}
      </div>
      <div className={cn(
        "absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
        isBusy ? "bg-amber-500" : "bg-emerald-500"
      )} />
    </div>
  );
  return L.divIcon({
    html: iconHtml,
    className: 'fleet-driver-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

const createStoreBasketIcon = (count: number = 0, isParada1: boolean = false) => {
  const iconHtml = renderToStaticMarkup(
    <div className="relative flex flex-col items-center">
      <div className={cn(
        "w-10 h-10 rounded-2xl border-2 shadow-xl flex items-center justify-center text-lg text-white",
        isParada1 ? "bg-amber-500 border-amber-300" : "bg-[#047857] border-white"
      )}>
        {isParada1 ? "🏪" : "🧺"}
      </div>
      {isParada1 ? (
        <span className="absolute -top-2 px-1.5 py-0.5 rounded-full bg-[#2D3277] text-white border border-yellow-300 text-[8.5px] font-black uppercase shadow tracking-wider">
          Parada 1
        </span>
      ) : count > 0 ? (
        <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-slate-900 border border-white text-[9px] font-black flex items-center justify-center shadow">
          {count}
        </span>
      ) : null}
      <div className={cn(
        "w-2.5 h-2.5 rotate-45 border-r border-b -mt-1 shadow-xs",
        isParada1 ? "bg-amber-500 border-amber-300" : "bg-[#047857] border-white"
      )} />
    </div>
  );
  return L.divIcon({
    html: iconHtml,
    className: 'store-basket-icon',
    iconSize: [44, 46],
    iconAnchor: [22, 46],
  });
};

const createOrderPinIcon = (orderId: string, isMyRoute: boolean = false, isParada2: boolean = false) => {
  const shortFormatted = formatShortOrderCode(orderId);
  const iconHtml = renderToStaticMarkup(
    <div className="relative flex flex-col items-center">
      <div className={cn(
        "px-2 py-0.5 rounded-xl border-2 shadow-lg flex items-center gap-1 text-[10px] font-black tracking-tight",
        isMyRoute
          ? "bg-[#FFE600] border-[#2D3277] text-[#2D3277] ring-2 ring-yellow-400/40"
          : "bg-blue-600 border-white text-white"
      )}>
        <span>📦</span>
        <span>{shortFormatted}</span>
        {isParada2 && (
          <span className="ml-1 text-[8px] bg-[#2D3277] text-yellow-300 px-1 py-0.2 rounded font-black uppercase">
            Parada 2
          </span>
        )}
      </div>
      <div className={cn(
        "w-2 h-2 rotate-45 -mt-1 border-r border-b",
        isMyRoute ? "bg-[#FFE600] border-[#2D3277]" : "bg-blue-600 border-white"
      )} />
    </div>
  );
  return L.divIcon({
    html: iconHtml,
    className: 'order-pin-icon',
    iconSize: [isParada2 ? 94 : 70, 30],
    iconAnchor: [isParada2 ? 47 : 35, 30],
  });
};

const createDriverIcon = (color: string, isBusy: boolean = false, isSOS: boolean = false) => {
  const iconHtml = renderToStaticMarkup(
    <div className="relative">
      {isSOS && (
        <div className="absolute -inset-6 bg-red-500/30 rounded-full animate-ping" />
      )}
      <div 
        className={cn(
          "w-11 h-11 rounded-full border-[3px] border-white shadow-2xl flex items-center justify-center transition-all duration-500", 
          isSOS ? "bg-red-600 animate-pulse scale-110" : isBusy ? "bg-orange-500" : "bg-slate-900"
        )} 
      >
        {isSOS ? (
          <AlertTriangle className="w-6 h-6 text-white fill-current animate-bounce" />
        ) : (
          <Truck className="w-5 h-5 text-white" />
        )}
      </div>
      {(isBusy || isSOS) && (
        <div className={cn(
          "absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-md",
          isSOS ? "bg-red-500" : "bg-orange-400"
        )}>
          <div className="w-2 h-2 bg-white rounded-full animate-ping" />
        </div>
      )}
      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-r border-b border-slate-200" />
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: 'custom-driver-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 44],
  });
};

function MapController({ 
  center, 
  heading, 
  isNavigating, 
  centerTrigger 
}: { 
  center: [number, number], 
  heading: number, 
  isNavigating: boolean, 
  centerTrigger: number 
}) {
  const map = useMap();

  useEffect(() => {
    if (isNavigating) {
      map.setView(center, 18, { animate: true });
    } else if (centerTrigger > 0) {
      map.setView(center, 16, { animate: true });
    }
  }, [center, isNavigating, map, centerTrigger]);

  return null;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
}

interface InteractiveMapProps {
  center: [number, number];
  destination?: [number, number] | null;
  alerts?: any[] | null;
  activeOrders?: any[] | null;
  availableOrders?: any[] | null;
  previewOrder?: any | null;
  onSelectPreviewOrder?: (order: any) => void;
  hasActiveOrder?: boolean;
  isOrderPickedUp?: boolean;
  fleet?: any[] | null;
  heading?: number;
  zoom?: number;
  isNavigating?: boolean;
  centerTrigger?: number;
  currentUserId?: string;
  driverVehicle?: string;
  onSelectOrder?: (order: any) => void;
  onTakeOrder?: (orderId: string) => void;
}

export default function InteractiveMap({ 
  center, 
  destination, 
  alerts,
  activeOrders,
  availableOrders,
  previewOrder,
  onSelectPreviewOrder,
  hasActiveOrder = false,
  isOrderPickedUp = false,
  fleet,
  heading = 0, 
  zoom = 14,
  isNavigating = false,
  centerTrigger = 0,
  currentUserId,
  driverVehicle = "Motorcycle",
  onSelectOrder,
  onTakeOrder,
}: InteractiveMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const lastFetchedCoords = useRef<{center: [number, number], dest: [number, number]} | null>(null);
  const [routes, setRoutes] = useState<{ main: [number, number][], alternatives: [number, number][][] }>({
    main: [],
    alternatives: []
  });

  const formatMoney = (val: number) => "$" + (Number(val) || 0).toLocaleString("es-AR");

  useEffect(() => {
    setIsMounted(true);
    fixLeafletIcons();
  }, []);

  useEffect(() => {
    if (!center || !destination || typeof destination[0] !== 'number' || typeof destination[1] !== 'number') {
      setRoutes({ main: [], alternatives: [] });
      lastFetchedCoords.current = null;
      return;
    }

    const shouldFetch = !lastFetchedCoords.current || 
                        getDistance(destination[0], destination[1], lastFetchedCoords.current.dest[0], lastFetchedCoords.current.dest[1]) > 5 ||
                        getDistance(center[0], center[1], lastFetchedCoords.current.center[0], lastFetchedCoords.current.center[1]) > 10;

    if (shouldFetch) {
      const url = `https://router.project-osrm.org/route/v1/driving/${center[1]},${center[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson&alternatives=true`;
      
      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (data.routes && data.routes.length > 0) {
            const mainCoords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
            const altCoords = data.routes.slice(1).map((route: any) => 
              route.geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number])
            );
            setRoutes({ main: mainCoords, alternatives: altCoords });
            lastFetchedCoords.current = { center, dest: destination };
          }
        })
        .catch(err => console.error("OSRM Error:", err));
    }
  }, [center, destination]);

  if (!isMounted) {
    return (
      <div className="h-full w-full bg-slate-200 animate-pulse flex items-center justify-center">
        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Cargando Monitor de Flota Biz...</p>
      </div>
    );
  }

  // Detectar Modo en Viaje: repartidor tiene un pedido activo asignado
  const isInTripMode = Boolean((hasActiveOrder || (activeOrders && activeOrders.length > 0)));
  const currentActiveOrder = activeOrders && activeOrders.length > 0 ? activeOrders[0] : null;

  // En Modo En Viaje: Coordenadas de la Parada 1 (Tienda) y Parada 2 (Cliente)
  const tripStoreCoords: [number, number] = currentActiveOrder?.storeCoords?.lat && currentActiveOrder?.storeCoords?.lng
    ? [currentActiveOrder.storeCoords.lat, currentActiveOrder.storeCoords.lng]
    : [STORE_DEFAULT_DERQUI.coords.lat, STORE_DEFAULT_DERQUI.coords.lng];
  const tripStoreName = currentActiveOrder?.branch || STORE_DEFAULT_DERQUI.name;
  const tripStoreAddress = STORE_DEFAULT_DERQUI.address;

  const tripDestCoords: [number, number] | null = currentActiveOrder?.destinationCoords?.lat && currentActiveOrder?.destinationCoords?.lng
    ? [currentActiveOrder.destinationCoords.lat, currentActiveOrder.destinationCoords.lng]
    : null;

  // En Modo Exploración: Conexión entre Negocio de origen y entrega al tocar un paquete azul
  const previewStoreCoords: [number, number] = previewOrder?.storeCoords?.lat && previewOrder?.storeCoords?.lng
    ? [previewOrder.storeCoords.lat, previewOrder.storeCoords.lng]
    : [STORE_DEFAULT_DERQUI.coords.lat, STORE_DEFAULT_DERQUI.coords.lng];

  const previewDestCoords: [number, number] | null = previewOrder?.destinationCoords?.lat && previewOrder?.destinationCoords?.lng
    ? [previewOrder.destinationCoords.lat, previewOrder.destinationCoords.lng]
    : null;

  // Tiendas para Modo Exploración
  const storesMap = new Map<string, { name: string; address: string; coords: [number, number]; count: number }>();
  if (!isInTripMode) {
    storesMap.set("maciel-derqui", {
      name: STORE_DEFAULT_DERQUI.name,
      address: STORE_DEFAULT_DERQUI.address,
      coords: [STORE_DEFAULT_DERQUI.coords.lat, STORE_DEFAULT_DERQUI.coords.lng],
      count: (availableOrders?.length || 0),
    });

    (availableOrders || []).forEach((o) => {
      if (o?.storeCoords?.lat && o?.storeCoords?.lng) {
        const key = `${o.storeCoords.lat},${o.storeCoords.lng}`;
        const existing = storesMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          storesMap.set(key, {
            name: o.branch || STORE_DEFAULT_DERQUI.name,
            address: o.branch || STORE_DEFAULT_DERQUI.address,
            coords: [o.storeCoords.lat, o.storeCoords.lng],
            count: 1,
          });
        }
      }
    });
  }

  // Flota simulada solo para Modo Exploración
  const effectiveFleet = (!isInTripMode && fleet && fleet.length > 0)
    ? fleet
    : !isInTripMode
    ? [
        {
          id: "fleet-1",
          firstName: "Lucas",
          lastName: "M.",
          vehicleType: "Motorcycle",
          currentLatitude: center[0] + 0.0035,
          currentLongitude: center[1] + 0.0028,
          isBusy: false,
        },
        {
          id: "fleet-2",
          firstName: "Marcos",
          lastName: "B.",
          vehicleType: "Bicycle",
          currentLatitude: center[0] - 0.0032,
          currentLongitude: center[1] + 0.0045,
          isBusy: true,
        },
      ]
    : [];

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'policia': return '#2563eb';
      case 'accidente': return '#dc2626';
      case 'trafico': return '#d97706';
      case 'obras': return '#059669';
      case 'sos': return '#ef4444';
      default: return '#64748b';
    }
  }

  return (
    <div className="h-full w-full relative overflow-hidden bg-slate-100">
      <div 
        className={cn(
          "h-full w-full",
          isNavigating 
            ? "scale-[1.4] transition-transform duration-150 ease-out" 
            : "transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
        )}
        style={{ 
          transform: isNavigating ? `rotate(${-heading}deg)` : 'none',
          transformOrigin: 'center center'
        }}
      >
        <MapContainer 
          center={center} 
          zoom={zoom} 
          zoomControl={false}
          scrollWheelZoom={true}
          className="h-full w-full z-0"
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {routes.alternatives.map((altPath, idx) => (
            <Polyline key={`alt-${idx}`} positions={altPath} color="#94a3b8" weight={5} opacity={0.3} lineCap="round" />
          ))}

          {routes.main.length > 0 && (
            <Polyline positions={routes.main} color="#2563eb" weight={9} opacity={0.9} lineCap="round" />
          )}

          {alerts?.map((alert) => {
            if (typeof alert.latitude !== 'number' || typeof alert.longitude !== 'number') return null;
            const baseColor = getAlertColor(alert.type);
            return (
              <div key={alert.id}>
                <Circle center={[alert.latitude, alert.longitude]} radius={200} pathOptions={{ fillColor: baseColor, fillOpacity: 0.05, color: 'transparent', weight: 0 }} />
                <Circle center={[alert.latitude, alert.longitude]} radius={60} pathOptions={{ fillColor: baseColor, fillOpacity: 0.3, color: baseColor, weight: 2, opacity: 0.4 }}>
                  <Popup className="alert-popup">
                    <div className="p-2 min-w-[140px]">
                      <p className="font-black text-[10px] uppercase tracking-widest mb-1" style={{ color: baseColor }}>{alert.label}</p>
                      <p className="text-xs font-bold text-slate-800 leading-tight">{alert.description || 'Incidencia detectada'}</p>
                    </div>
                  </Popup>
                </Circle>
              </div>
            );
          })}

          {/* ─── MODO EN VIAJE: Solo Repartidor (moto amarilla), Parada 1 (Tienda) y Parada 2 (Cliente) ─── */}
          {isInTripMode && currentActiveOrder && (
            <>
              {/* Parada 1: Retiro en Comercio */}
              <Marker
                position={tripStoreCoords}
                icon={createStoreBasketIcon(1, true)}
                zIndexOffset={2600}
              >
                <Popup>
                  <div className="p-1 min-w-[170px] space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🏪</span>
                      <span className="font-black text-[10px] text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Parada 1: Retiro
                      </span>
                    </div>
                    <p className="font-extrabold text-xs text-slate-900">{tripStoreName}</p>
                    <p className="text-[10px] text-slate-500">{tripStoreAddress}</p>
                    <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500">Estado:</span>
                      <span className={cn(
                        "font-black px-1.5 py-0.2 rounded",
                        isOrderPickedUp ? "text-emerald-700 bg-emerald-50" : "text-amber-800 bg-amber-50"
                      )}>
                        {isOrderPickedUp ? "✅ Ya retirado" : "⏳ Retirar en mostrador"}
                      </span>
                    </div>
                  </div>
                </Popup>
              </Marker>

              {/* Parada 2: Entrega en domicilio del cliente */}
              {tripDestCoords && (
                <Marker
                  position={tripDestCoords}
                  icon={createOrderPinIcon(currentActiveOrder.id, true, true)}
                  zIndexOffset={2800}
                >
                  <Popup>
                    <div className="p-1 min-w-[170px] space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-yellow-100 text-yellow-900 border border-yellow-300">
                          Parada 2: Entrega
                        </span>
                        <span className="font-mono text-[10px] font-bold text-slate-500">
                          {formatShortOrderCode(currentActiveOrder.id)}
                        </span>
                      </div>
                      <p className="font-black text-xs text-slate-900">
                        {currentActiveOrder.customerName || currentActiveOrder.clientName || 'Cliente'}
                      </p>
                      <p className="text-[10px] text-slate-600 line-clamp-2">📍 {currentActiveOrder.deliveryAddress}</p>
                      <div className="flex items-center justify-between text-xs font-black text-slate-900 pt-1 border-t border-slate-100">
                        <span className="text-[10px] text-slate-500 font-semibold">Ganancia:</span>
                        <span className="text-emerald-600 font-black">+{formatMoney(currentActiveOrder.driverEarnings || 1600)}</span>
                      </div>
                      {onSelectOrder && (
                        <button
                          type="button"
                          onClick={() => onSelectOrder(currentActiveOrder)}
                          className="w-full mt-1.5 py-1 px-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-[#2D3277] font-black text-[10px] shadow-xs active:scale-95 transition-all"
                        >
                          Ver detalles / Chat
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )}
            </>
          )}

          {/* ─── MODO EXPLORACIÓN (Sin pedido activo): Paquetes disponibles en azul + Línea punteada de origen ─── */}
          {!isInTripMode && (
            <>
              {/* Línea punteada celeste conectando Negocio con Destino del pedido seleccionado */}
              {previewDestCoords && (
                <Polyline
                  positions={[previewStoreCoords, previewDestCoords]}
                  pathOptions={{
                    color: '#0284c7',
                    dashArray: '8, 8',
                    weight: 4,
                    opacity: 0.9,
                  }}
                />
              )}

              {/* 1. Tiendas / Comercios en Exploración */}
              {Array.from(storesMap.values()).map((store, idx) => (
                <Marker
                  key={`store-${idx}`}
                  position={store.coords}
                  icon={createStoreBasketIcon(store.count, false)}
                  zIndexOffset={1500}
                >
                  <Popup>
                    <div className="p-1 min-w-[150px]">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-base">🧺</span>
                        <span className="font-black text-xs text-emerald-950 uppercase tracking-tight">Comercio / Retiro</span>
                      </div>
                      <p className="font-extrabold text-xs text-slate-900">{store.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{store.address}</p>
                      <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9.5px] font-black">
                        <span>📦 {store.count} pedido{store.count === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* 2. Paquetes Disponibles en Azul */}
              {(availableOrders || []).map((order) => {
                if (!order?.destinationCoords?.lat || !order?.destinationCoords?.lng) return null;
                const pos: [number, number] = [order.destinationCoords.lat, order.destinationCoords.lng];
                const shortTicket = formatShortOrderCode(order.id);
                const isSelectedPreview = previewOrder?.id === order.id;

                return (
                  <Marker
                    key={`order-pin-${order.id}`}
                    position={pos}
                    icon={createOrderPinIcon(order.id, false, false)}
                    zIndexOffset={isSelectedPreview ? 2500 : 1800}
                    eventHandlers={{
                      click: () => onSelectPreviewOrder?.(order),
                    }}
                  >
                    <Popup>
                      <div className="p-1 min-w-[170px] space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                            ✨ Disponible
                          </span>
                          <span className="font-mono text-[10px] font-bold text-slate-500">{shortTicket}</span>
                        </div>
                        <p className="font-black text-xs text-slate-900">{order.customerName || order.clientName || 'Cliente'}</p>
                        <p className="text-[10px] text-slate-600 line-clamp-2">📍 {order.deliveryAddress}</p>
                        <div className="flex items-center justify-between text-xs font-black text-slate-900 pt-1 border-t border-slate-100">
                          <span className="text-[10px] text-slate-500 font-semibold">Ganancia:</span>
                          <span className="text-emerald-600 font-black">+{formatMoney(order.driverEarnings || 1600)}</span>
                        </div>
                        {hasActiveOrder ? (
                          <div className="w-full mt-1.5 py-1 px-2 rounded-lg bg-slate-100 text-slate-500 text-[9.5px] font-bold text-center border border-slate-200">
                            Completá tu entrega actual para tomar otro pedido
                          </div>
                        ) : onTakeOrder ? (
                          <button
                            type="button"
                            onClick={() => onTakeOrder(order.id)}
                            className="w-full mt-1.5 py-1 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] shadow-xs active:scale-95 transition-all"
                          >
                            Aceptar y llevar 🛵
                          </button>
                        ) : null}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* 3. Flota en Exploración */}
              {effectiveFleet.map((driver) => {
                if (typeof driver.currentLatitude !== 'number' || typeof driver.currentLongitude !== 'number') return null;
                if (driver.id === currentUserId) return null;
                const vehicle = driver.vehicleType || "Motorcycle";
                return (
                  <Marker
                    key={`fleet-${driver.id}`}
                    position={[driver.currentLatitude, driver.currentLongitude]}
                    icon={createFleetDriverIcon(vehicle, Boolean(driver.isBusy))}
                    zIndexOffset={800}
                  >
                    <Popup>
                      <div className="p-1 min-w-[120px]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-base">{getVehicleEmoji(vehicle)}</span>
                          <span className={cn(
                            "font-black text-[9px] uppercase px-1.5 py-0.5 rounded-full inline-block",
                            driver.isBusy ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                          )}>
                            {driver.isBusy ? "En viaje" : "En línea"}
                          </span>
                        </div>
                        <p className="font-black text-xs text-slate-900">{driver.firstName} {driver.lastName || ''}</p>
                        <p className="text-[9.5px] text-slate-500">{vehicle === "Bicycle" ? "Bicicleta" : vehicle === "Car" ? "Automóvil" : "Motocicleta"}</p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </>
          )}

          {!isInTripMode && destination && typeof destination[0] === 'number' && typeof destination[1] === 'number' && (
            <Marker position={destination}>
              <Popup>
                <div className="p-1">
                  <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest">DESTINO</p>
                  <p className="font-bold text-xs text-slate-900">Punto de Entrega</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* ─── 4. Marcador del propio usuario/repartidor con su vehículo real ─── */}
          {!isNavigating && center && (
            <Marker
              position={center}
              icon={createSelfDriverIcon(driverVehicle, heading)}
              zIndexOffset={3000}
            >
              <Popup>
                <div className="p-1 min-w-[130px]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-lg">{getVehicleEmoji(driverVehicle)}</span>
                    <span className="font-black text-[9px] uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                      Tu posición activa
                    </span>
                  </div>
                  <p className="font-black text-xs text-slate-900">
                    {driverVehicle === "Bicycle" ? "Bicicleta" : driverVehicle === "Car" ? "Automóvil" : "Motocicleta"}
                  </p>
                  <p className="text-[10px] text-slate-500">Rumbo: {Math.round(heading)}°</p>
                </div>
              </Popup>
            </Marker>
          )}

          <MapController center={center} heading={heading} isNavigating={isNavigating} centerTrigger={centerTrigger} />
          {!isNavigating && <ZoomControl position="bottomright" />}
        </MapContainer>
      </div>

      {isNavigating && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none">
          <div className="relative flex items-center justify-center scale-150">
            <div className="w-12 h-12 bg-blue-600 rounded-full shadow-[0_0_35px_rgba(37,99,235,0.7)] border-4 border-white flex items-center justify-center">
              <NavIcon className="w-7 h-7 text-white fill-current -rotate-45" />
            </div>
            <div className="absolute w-24 h-24 bg-blue-400/20 rounded-full animate-ping" />
          </div>
        </div>
      )}
    </div>
  );
}
