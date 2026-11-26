"use client";

import { useEffect, useRef } from "react";

/**
 * Sistema nativo de auto-despertar y mantenimiento activo (Heartbeat).
 * 
 * 1. Al cargar la página: Dispara un ping inmediato a /api/wake para despertar
 *    la base de datos y el backend de Render de forma nativa.
 * 2. Mientras la página esté abierta: Envía un pulso (heartbeat) cada 4 minutos
 *    para evitar que Render entre en reposo por inactividad (Render duerme a los 15 min).
 * 3. Al reanudar la pestaña: Si el usuario vuelve tras dejar la pestaña inactiva,
 *    comprueba el tiempo transcurrido y renueva la señal de inmediato.
 * 
 * No requiere servicios externos (como cron-job o uptimerobot) y queda 100%
 * estructurado y compatible para cuando migres a un VPS definitivo.
 */
export function BackendWakeup() {
  const lastPingRef = useRef<number>(Date.now());

  useEffect(() => {
    const sendWakeSignal = async () => {
      try {
        lastPingRef.current = Date.now();
        await fetch("/api/wake", {
          cache: "no-store",
          headers: { "x-ping-source": "native-web-heartbeat" },
        });
      } catch {
        // Silencioso: no interrumpe la navegación del usuario
      }
    };

    // 1. Ping inmediato apenas se abre la página web
    sendWakeSignal();

    // 2. Heartbeat nativo periódico cada 4 minutos
    const intervalId = setInterval(sendWakeSignal, 4 * 60 * 1000);

    // 3. Si el usuario vuelve a la pestaña tras más de 3 minutos, refrescar la señal
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastPingRef.current;
        if (elapsed > 3 * 60 * 1000) {
          sendWakeSignal();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
