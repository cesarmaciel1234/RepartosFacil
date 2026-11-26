"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      // 1. Purgar proactivamente cualquier caché vieja anterior a v5.10
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            if (key !== "repartofacil-v5.10") {
              console.log("[PWA] Purgando caché obsoleta:", key);
              caches.delete(key);
            }
          });
        });
      }

      // 2. Registrar y forzar actualización del Service Worker
      if ("serviceWorker" in navigator) {
        const isLocalhost =
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1" ||
          window.location.hostname.endsWith(".local");

        if (process.env.NODE_ENV === "production" || isLocalhost) {
          navigator.serviceWorker
            .register("/sw.js")
            .then((registration) => {
              // Forzar chequeo de actualización contra el servidor
              registration.update().catch(() => {});

              registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                if (installingWorker) {
                  installingWorker.onstatechange = () => {
                    if (
                      installingWorker.state === "installed" &&
                      navigator.serviceWorker.controller
                    ) {
                      console.log("[PWA] Nueva versión detectada. Activando...");
                      if (registration.waiting) {
                        registration.waiting.postMessage({ type: "SKIP_WAITING" });
                      }
                      window.location.reload();
                    }
                  };
                }
              };
            })
            .catch((error) => {
              console.warn("[PWA] Error registrando Service Worker:", error);
            });

          let refreshing = false;
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (!refreshing) {
              refreshing = true;
              window.location.reload();
            }
          });
        }
      }
    }
  }, []);

  return null;
}
