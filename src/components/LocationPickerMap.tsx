'use client';

import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, MapPin, LocateFixed } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_DELIVERY_RADIUS_METERS = 1000;

/**
 * CONFIGURACIÓN DE RADIO GPS:
 * - En PRODUCCIÓN REAL: ENFORCE_GPS_RADIUS = true para forzar que el cliente elija
 *   un punto dentro de 1 km de su GPS real, previniendo compras maliciosas o falsas.
 * - En MODO PRUEBA (Actual): ENFORCE_GPS_RADIUS = false para permitir pruebas fluidas
 *   desde cualquier PC o dispositivo que no cuente con GPS de hardware de precisión.
 */
export const ENFORCE_GPS_RADIUS = false;

function distanceMeters(first: [number, number], second: [number, number]) {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = ((second[0] - first[0]) * Math.PI) / 180;
  const longitudeDelta = ((second[1] - first[1]) * Math.PI) / 180;
  const firstLatitude = (first[0] * Math.PI) / 180;
  const secondLatitude = (second[0] * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function isWithinDeliveryRadius(
  position: [number, number],
  gpsPosition: [number, number]
) {
  return distanceMeters(position, gpsPosition) <= MAX_DELIVERY_RADIUS_METERS;
}

const fixLeafletIcons = () => {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
};

export interface LocationPickerSelection {
  lat: number;
  lng: number;
  address: string;
  road?: string;
  houseNumber?: string;
  neighborhood: string;
  city: string;
  isResolving: boolean;
}

interface LocationPickerMapProps {
  onSelectionChange: (selection: LocationPickerSelection | null) => void;
  initialCenter?: [number, number];
  className?: string;
}

function MapInteraction({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapUpdater({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 16, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

export default function LocationPickerMap({
  onSelectionChange,
  initialCenter,
  className,
}: LocationPickerMapProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(null);
  const [gpsPosition, setGpsPosition] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [locationDetails, setLocationDetails] = useState<{
    address: string;
    neighborhood: string;
    city: string;
    road?: string;
    houseNumber?: string;
  } | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const hasRequestedLocation = useRef(false);

  useEffect(() => {
    fixLeafletIcons();
  }, []);

  useEffect(() => {
    if (!markerPosition) return;

    const controller = new AbortController();
    setLocationDetails(null);
    setIsGeocoding(true);
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${markerPosition[0]}&lon=${markerPosition[1]}`,
      { signal: controller.signal }
    )
      .then(res => res.json())
      .then(data => {
        if (data?.address) {
          const address = data.address;
          const neighborhood =
            address.suburb || address.neighbourhood || address.residential || "Barrio";
          const city = address.city || address.town || address.village || address.state || "Ciudad";
          const street = [address.road, address.house_number].filter(Boolean).join(" ");
          setLocationDetails({
            address: [street, neighborhood, city].filter(Boolean).join(", ") || data.display_name,
            road: address.road || "",
            houseNumber: address.house_number || "",
            neighborhood,
            city,
          });
        }
      })
      .catch(err => {
        if (err.name !== "AbortError") console.error("Geocoding error:", err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsGeocoding(false);
      });

    return () => controller.abort();
  }, [markerPosition]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    if (ENFORCE_GPS_RADIUS && !gpsPosition) {
      setLocationError('Activá tu ubicación GPS para elegir una dirección dentro del radio de 1 km.');
      return;
    }

    setIsSearching(true);
    setLocationError(null);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&addressdetails=1`);
      if (!response.ok) {
        throw new Error(`El servicio respondió ${response.status}`);
      }
      const data = await response.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lon) ||
          Math.abs(lat) > 90 ||
          Math.abs(lon) > 180
        ) {
          setLocationError('No pudimos determinar la ubicación de esa dirección.');
          return;
        }
        const newPos: [number, number] = [lat, lon];
        if (ENFORCE_GPS_RADIUS && gpsPosition && !isWithinDeliveryRadius(newPos, gpsPosition)) {
          setLocationError('Esa dirección está fuera del radio permitido de 1 km desde tu GPS.');
          return;
        }
        setLocationDetails(null);
        setIsGeocoding(true);
        setMarkerPosition(newPos);
        setMapCenter(newPos);
      } else {
        setLocationError('No encontramos esa dirección. Revisá el texto e intentá nuevamente.');
      }
    } catch (error) {
      console.error("Search error:", error);
      setLocationError('No pudimos buscar esa dirección. Intentá nuevamente.');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!markerPosition) {
      onSelectionChange(null);
      return;
    }

    onSelectionChange({
      lat: markerPosition[0],
      lng: markerPosition[1],
      address: locationDetails?.address || "",
      road: locationDetails?.road || "",
      houseNumber: locationDetails?.houseNumber || "",
      neighborhood: locationDetails?.neighborhood || "",
      city: locationDetails?.city || "",
      isResolving: isGeocoding,
    });
  }, [isGeocoding, locationDetails, markerPosition, onSelectionChange]);

  const handleManualSelect = useCallback((lat: number, lng: number) => {
    const position: [number, number] = [lat, lng];

    if (ENFORCE_GPS_RADIUS) {
      if (!gpsPosition) {
        setLocationError('Activá tu ubicación GPS para elegir una dirección dentro del radio de 1 km.');
        return;
      }
      if (!isWithinDeliveryRadius(position, gpsPosition)) {
        setLocationError('Ese punto está fuera del radio permitido de 1 km desde tu GPS.');
        return;
      }
    }

    setLocationError(null);
    setLocationDetails(null);
    setIsGeocoding(true);
    setMarkerPosition(position);
  }, [gpsPosition]);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Tu navegador no permite obtener la ubicación GPS necesaria para limitar el radio.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position: [number, number] = [coords.latitude, coords.longitude];
        setGpsPosition(position);
        setMarkerPosition(null);
        setLocationDetails(null);
        setMapCenter(position);
        setIsLocating(false);
      },
      (error) => {
        console.error("Error obteniendo ubicación actual:", error);
        setGpsPosition(null);
        setMarkerPosition(null);
        setLocationDetails(null);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'Permití el acceso a tu ubicación GPS para seleccionar un domicilio dentro de 1 km.'
            : 'No pudimos obtener tu GPS. Revisá la señal e intentá nuevamente.'
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, []);

  useEffect(() => {
    if (hasRequestedLocation.current) return;
    hasRequestedLocation.current = true;
    handleUseCurrentLocation();
  }, [handleUseCurrentLocation]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={initialCenter || [-34.486522, -58.833579]}
          zoom={15}
          scrollWheelZoom={true}
          className="h-full w-full"
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {gpsPosition && (
            <Circle
              center={gpsPosition}
              radius={MAX_DELIVERY_RADIUS_METERS}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#3b82f6',
                fillOpacity: 0.12,
                weight: 2,
              }}
            />
          )}
          {markerPosition && <Marker position={markerPosition} />}
          <MapInteraction onSelect={handleManualSelect} />
          <MapUpdater center={mapCenter} />
        </MapContainer>
      </div>

      <button
        type="button"
        onClick={handleUseCurrentLocation}
        disabled={isLocating}
        aria-label="Usar mi ubicación actual"
        className="absolute right-4 top-20 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition-colors hover:bg-slate-50 disabled:opacity-60"
      >
        {isLocating ? (
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        ) : (
          <LocateFixed className="h-5 w-5 text-blue-600" />
        )}
      </button>

      {locationError && (
        <p
          role="status"
          className="absolute right-4 top-32 z-20 max-w-64 rounded-xl bg-white px-3 py-2 text-xs font-medium text-red-600 shadow-lg"
        >
          {locationError}
        </p>
      )}

      <div className="absolute left-3 right-3 top-3 z-20 flex gap-2 rounded-2xl border border-slate-100 bg-white p-2 shadow-lg">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar calle, barrio o ciudad..."
            aria-label="Buscar calle, barrio o ciudad"
            className="h-11 rounded-xl border-none bg-slate-50 pl-10 text-sm font-medium focus-visible:ring-1 focus-visible:ring-blue-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button
          type="button"
          onClick={handleSearch}
          disabled={isSearching}
          className="h-11 rounded-xl bg-blue-600 px-4 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-blue-700 active:scale-95"
        >
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
        </Button>
      </div>

      {!markerPosition && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-10 -translate-x-1/2">
          <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white bg-white/95 px-4 py-2 shadow-lg backdrop-blur-md">
            <MapPin className="h-3.5 w-3.5 text-blue-600" />
            <p className="text-center text-[10px] font-bold text-slate-600">
              {gpsPosition
                ? 'Elegí un punto dentro del círculo de 1 km'
                : isLocating
                ? 'Obteniendo tu ubicación GPS...'
                : 'Necesitamos tu GPS para habilitar el radio de 1 km'}
            </p>
          </div>
        </div>
      )}
      </div>
  );
}
