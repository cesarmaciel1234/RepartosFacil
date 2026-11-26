"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { GPSCoords, HeadingSource, TelemetryState } from "./tipos";
import { doc, updateDoc } from "@/firebase/local-firestore";
import { useFirestore } from "@/firebase";
import {
  SPEED_GPS_THRESHOLD_MPS,
  MIN_DISTANCE_METERS_FOR_BEARING,
  HEADING_SMOOTHING_FACTOR,
  calculateDistanceMeters,
  calculateBearing,
  extractCompassHeading,
  smoothAngle,
  circularAverage,
  shortestAngularDifference,
} from "./telemetryEngine";

/**
 * Hook de Telemetría GPS y Orientación Fusionada
 * 
 * Fusiona:
 * - GPS de alta precisión (latitud, longitud, velocidad y rumbo geodésico).
 * - Brújula digital del dispositivo (magnetómetro / "cabeza del teléfono").
 * - Filtro de suavizado exponencial circular (EMA) para eliminar temblores de la aguja.
 */
export function useDriverGps(driverId?: string | null): TelemetryState {
  const firestore = useFirestore();

  // Estados públicos reactivos
  const [coords, setCoords] = useState<GPSCoords | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [rawHeading, setRawHeading] = useState<number>(0);
  const [speed, setSpeed] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [source, setSource] = useState<HeadingSource>("initial");
  const [isMoving, setIsMoving] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Referencias para el motor de segundo plano sin causar re-renders innecesarios
  const targetHeadingRef = useRef<number>(0);
  const currentHeadingRef = useRef<number>(0);
  const lastCoordsRef = useRef<GPSCoords | null>(null);
  const compassBufferRef = useRef<number[]>([]);
  const lastSourceRef = useRef<HeadingSource>("initial");
  const isMovingRef = useRef<boolean>(false);

  // ─── 1. Listener de la Brújula Digital ("Cabeza del Teléfono") ───
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const compassAngle = extractCompassHeading(e);
      if (compassAngle === null) return;

      // Mantener un buffer de los últimos 5 ticks para amortiguar ruido mecánico
      const buffer = compassBufferRef.current;
      buffer.push(compassAngle);
      if (buffer.length > 5) buffer.shift();

      // Si el repartidor está detenido o a muy baja velocidad, la brújula gobierna
      if (!isMovingRef.current) {
        const averagedCompass = circularAverage(buffer);
        targetHeadingRef.current = averagedCompass;
        setRawHeading(averagedCompass);
        if (lastSourceRef.current !== "compass") {
          lastSourceRef.current = "compass";
          setSource("compass");
        }
      }
    };

    // Preferir deviceorientationabsolute en Android para Norte absoluto, fallback a standard
    const hasAbsoluteEvent = "ondeviceorientationabsolute" in window;
    const eventName = hasAbsoluteEvent ? "deviceorientationabsolute" : "deviceorientation";

    window.addEventListener(eventName, handleOrientation as EventListener, true);
    return () => {
      window.removeEventListener(eventName, handleOrientation as EventListener, true);
    };
  }, []);

  // ─── 2. Listener de Posicionamiento GPS de Alta Precisión ───
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsError("Geolocalización no soportada por el navegador");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newCoords: GPSCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCoords(newCoords);
        setAccuracy(pos.coords.accuracy ?? null);

        const currentSpeedMps = pos.coords.speed;
        setSpeed(currentSpeedMps);

        // Determinamos si está en movimiento según el umbral calibrado (~4 km/h)
        const currentlyMoving =
          currentSpeedMps !== null &&
          !isNaN(currentSpeedMps) &&
          currentSpeedMps > SPEED_GPS_THRESHOLD_MPS;

        isMovingRef.current = currentlyMoving;
        setIsMoving(currentlyMoving);

        // LÓGICA DE DECISIÓN DE RUMBO:
        if (currentlyMoving) {
          // A) Si el GPS provee heading nativo confiable
          if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
            targetHeadingRef.current = pos.coords.heading;
            setRawHeading(pos.coords.heading);
            lastSourceRef.current = "gps";
            setSource("gps");
          } 
          // B) Si el GPS nativo no da heading pero nos hemos desplazado más de 3 metros
          else if (lastCoordsRef.current) {
            const distanceMoved = calculateDistanceMeters(
              lastCoordsRef.current.lat,
              lastCoordsRef.current.lng,
              newCoords.lat,
              newCoords.lng
            );

            if (distanceMoved >= MIN_DISTANCE_METERS_FOR_BEARING) {
              const computedBearing = calculateBearing(
                lastCoordsRef.current.lat,
                lastCoordsRef.current.lng,
                newCoords.lat,
                newCoords.lng
              );
              targetHeadingRef.current = computedBearing;
              setRawHeading(computedBearing);
              lastSourceRef.current = "gps";
              setSource("gps");
            }
          }
        } else {
          // Repartidor detenido: si no hay brújula activa aún, mantenemos último rumbo conocido
          if (compassBufferRef.current.length === 0 && lastSourceRef.current === "gps") {
            lastSourceRef.current = "bearing_history";
            setSource("bearing_history");
          }
        }

        lastCoordsRef.current = newCoords;

        // Sincronización en la nube con Firestore para monitoreo de flota
        if (driverId && firestore) {
          try {
            updateDoc(doc(firestore, "driverProfiles", driverId), {
              currentLatitude: newCoords.lat,
              currentLongitude: newCoords.lng,
              currentHeading: targetHeadingRef.current,
              currentSpeed: currentSpeedMps ?? 0,
              lastLocationUpdate: new Date().toISOString(),
            });
          } catch {
            // Silencioso para evitar romper ciclo de telemetría local
          }
        }
      },
      (err) => {
        console.warn("Aviso Telemetría GPS:", err.message);
        setGpsError(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1500,
        timeout: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [driverId, firestore]);

  // ─── 3. Motor de Suavizado Continuo (Animation Frame Loop) ───
  // Aplica el filtro EMA para que la flecha y el mapa roten con suavidad de 60fps
  useEffect(() => {
    let animationFrameId: number;

    const tick = () => {
      const current = currentHeadingRef.current;
      const target = targetHeadingRef.current;
      const diff = Math.abs(shortestAngularDifference(target, current));

      // Solo actualizamos si hay una diferencia perceptible (> 0.2°)
      if (diff > 0.2) {
        const next = smoothAngle(current, target, HEADING_SMOOTHING_FACTOR);
        currentHeadingRef.current = next;
        setHeading(Math.round(next * 10) / 10);
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // ─── 4. Solicitud de Permisos para iOS (DeviceOrientation Safari) ───
  const requestCompassPermission = useCallback(async (): Promise<boolean> => {
    if (
      typeof window !== "undefined" &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission === "function"
    ) {
      try {
        const permission = await (
          DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }
        ).requestPermission();
        return permission === "granted";
      } catch (e) {
        console.warn("Error al solicitar permisos de orientación:", e);
        return false;
      }
    }
    return true;
  }, []);

  return {
    coords,
    heading,
    rawHeading,
    speed,
    accuracy,
    source,
    isMoving,
    gpsError,
    requestCompassPermission,
  };
}
