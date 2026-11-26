/**
 * MOTOR DE TELEMETRÍA Y ORIENTACIÓN FUSIONADA (Sensor Fusion & Smoothing Engine)
 * RepartoFácil - Módulo Repartidor
 * 
 * Combina:
 * 1. Rumbo GPS (Bearing de traslación): Fiable a > 4 km/h (inmune a imanes/vibraciones).
 * 2. Brújula digital del dispositivo (Magnetómetro): Orientación de la "cabeza del teléfono" en parado.
 * 3. Promedio y suavizado circular (Circular EMA): Evita saltos bruscos en 0°/360° y elimina el jitter.
 */

import { GPSCoords } from "./tipos";

/** Umbral mínimo de velocidad en m/s (~4 km/h) para confiar en el rumbo GPS de traslación */
export const SPEED_GPS_THRESHOLD_MPS = 1.1; 

/** Distancia mínima en metros entre lecturas para calcular un nuevo rumbo geodésico */
export const MIN_DISTANCE_METERS_FOR_BEARING = 3.0;

/** Factor de suavizado exponencial (0.05 = muy lento/suave, 0.3 = rápido, 0.15 = estándar industria) */
export const HEADING_SMOOTHING_FACTOR = 0.15;

/**
 * Normaliza cualquier ángulo al rango estándar [0, 360).
 */
export function normalizeAngle(degrees: number): number {
  const mod = degrees % 360;
  return mod < 0 ? mod + 360 : mod;
}

/**
 * Calcula la diferencia angular más corta entre dos rumbos en el rango [-180, 180].
 * Resuelve el salto crítico de 359° a 1° para no hacer un giro de 358°.
 */
export function shortestAngularDifference(target: number, current: number): number {
  return ((target - current + 540) % 360) - 180;
}

/**
 * Interpola suavemente entre el ángulo actual y el objetivo usando Exponential Moving Average (EMA).
 */
export function smoothAngle(current: number, target: number, factor: number = HEADING_SMOOTHING_FACTOR): number {
  const diff = shortestAngularDifference(target, current);
  return normalizeAngle(current + diff * factor);
}

/**
 * Promedio circular vectorial para una ventana de ángulos (buffer de brújula o GPS).
 * Emplea descomposición vectorial trigonométrica para promediar correctamente sin error de salto 0°/360°.
 */
export function circularAverage(angles: number[]): number {
  if (angles.length === 0) return 0;
  if (angles.length === 1) return normalizeAngle(angles[0]);

  let sumSin = 0;
  let sumCos = 0;

  for (const angle of angles) {
    const rad = (angle * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  }

  const avgRad = Math.atan2(sumSin / angles.length, sumCos / angles.length);
  return normalizeAngle((avgRad * 180) / Math.PI);
}

/**
 * Calcula la distancia geodésica en metros entre dos coordenadas (Fórmula de Haversine).
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radio medio de la Tierra en metros
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calcula el rumbo geodésico inicial (Forward Azimuth / Bearing) desde el punto A hacia el punto B.
 * Devuelve un ángulo en grados [0, 360) donde 0° = Norte, 90° = Este.
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return normalizeAngle((theta * 180) / Math.PI);
}

/**
 * Extrae el rumbo magnético/verdadero (cabeza del teléfono) desde un evento DeviceOrientationEvent.
 * Compatible con iOS (webkitCompassHeading) y Android (alpha con corrección de signo).
 */
export function extractCompassHeading(event: DeviceOrientationEvent): number | null {
  // 1. iOS Safari: provee webkitCompassHeading directo respecto al Norte magnético/verdadero
  const anyEvent = event as unknown as { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
  if (typeof anyEvent.webkitCompassHeading === "number" && !isNaN(anyEvent.webkitCompassHeading)) {
    return normalizeAngle(anyEvent.webkitCompassHeading);
  }

  // 2. Android Chrome y navegadores estándar con soporte absolute
  if (event.alpha !== null && typeof event.alpha === "number" && !isNaN(event.alpha)) {
    // Si la orientación está disponible, en Android el alpha gira en sentido antihorario.
    // El rumbo de brújula horario estándar es (360 - alpha).
    return normalizeAngle(360 - event.alpha);
  }

  return null;
}
