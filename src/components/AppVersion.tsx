"use client";

import { useEffect, useState } from "react";
import { APP_RELEASE, APP_VERSION } from "@/lib/appVersion";

export function AppVersion({ dark = false }: { dark?: boolean }) {
  const [availableRelease, setAvailableRelease] = useState<string | null | undefined>();

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.warn("Se agotó el tiempo para comprobar la versión.");
      setAvailableRelease(null);
      controller.abort();
    }, 10_000);
    fetch("/api/version", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !("release" in data) || typeof data.release !== "string") {
          throw new Error("Respuesta de versión inválida");
        }
        setAvailableRelease(data.release);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.warn("No se pudo comprobar la versión:", error);
          setAvailableRelease(null);
        }
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const status = availableRelease === undefined
    ? "Comprobando actualización..."
    : availableRelease === null
    ? "No se pudo comprobar la actualización"
    : availableRelease === APP_RELEASE
      ? "Actualizada"
      : `Hay otra versión disponible (${availableRelease})`;

  return (
    <p role="status" className={`text-center text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
      Versión instalada v{APP_VERSION} · {status}
    </p>
  );
}
