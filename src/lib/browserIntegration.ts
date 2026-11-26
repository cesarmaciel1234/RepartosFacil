"use client";

import { useEffect } from "react";

/**
 * Emite un sonido sintetizado agradable de notificación mediante Web Audio API.
 * Funciona 100% offline y sin necesidad de descargar archivos de audio externos.
 */
export function playNotificationSound() {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Tono bitonal ascendente moderno (Re5 a La5)
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  } catch {
    // Silenciado o bloqueado por política de interacción del navegador
  }
}

/**
 * Emite una vibración háptica en dispositivos móviles compatibles.
 */
export function triggerVibration(pattern: number[] = [120, 60, 120]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignorar si no está soportado
    }
  }
}

/**
 * Actualiza el contador numérico en el ícono de la aplicación PWA instalada (App Badging API).
 */
export function setBrowserAppBadge(count: number) {
  if (typeof navigator !== "undefined") {
    try {
      const nav = navigator as unknown as {
        setAppBadge?: (cnt: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
      };
      if (count > 0 && typeof nav.setAppBadge === "function") {
        nav.setAppBadge(count).catch(() => {});
      } else if (typeof nav.clearAppBadge === "function") {
        nav.clearAppBadge().catch(() => {});
      }
    } catch {
      // Ignorar
    }
  }
}

/**
 * Solicita permisos de notificación nativa del navegador al usuario.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    try {
      const res = await Notification.requestPermission();
      return res === "granted";
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Envía una notificación nativa del sistema operativo con vibración y sonido.
 */
export function sendBrowserNotification(title: string, body: string, icon = "/icon-192.png") {
  triggerVibration([140, 70, 140]);
  playNotificationSound();

  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.showNotification(title, {
              body,
              icon,
              badge: "/icon-192.png",
              tag: "rf-notification",
            });
          })
          .catch(() => {
            new Notification(title, { body, icon });
          });
      } else {
        new Notification(title, { body, icon });
      }
    } catch {
      // Fallback
    }
  }
}

/**
 * Hook para mantener la pantalla encendida durante repartos o navegación activa (Screen WakeLock API).
 */
export function useScreenWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let wakeLockSentinel: { release: () => Promise<void> } | null = null;
    const requestLock = async () => {
      try {
        const nav = navigator as unknown as {
          wakeLock: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
        };
        wakeLockSentinel = await nav.wakeLock.request("screen");
      } catch {
        // Puede fallar si la batería es baja o la ventana no está visible
      }
    };

    void requestLock();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void requestLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, [enabled]);
}
