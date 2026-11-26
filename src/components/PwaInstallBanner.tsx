"use client";

import React, { useState, useEffect } from "react";
import { Download, X, Share2, PlusSquare, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    // 1. Detectar si ya corre instalada como PWA Standalone
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();

    // 2. Comprobar si el usuario la descartó recientemente (recuerda por 3 días)
    const dismissedUntil = localStorage.getItem("rf_pwa_dismissed_until");
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      setIsDismissed(true);
      return;
    } else {
      setIsDismissed(false);
    }

    // 3. Detectar si es iOS (Safari)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 4. Capturar evento de instalación nativa de Chrome / Android
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setIsDismissed(true);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    // No volver a mostrar por 3 días
    localStorage.setItem(
      "rf_pwa_dismissed_until",
      (Date.now() + 3 * 24 * 60 * 60 * 1000).toString()
    );
  };

  // Si ya está instalada o descartada o no hay prompt (en desktop), no mostramos
  if (isStandalone || isDismissed) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <aside 
      aria-label="Instalación de la aplicación"
      className="fixed bottom-4 left-4 right-4 z-[9999] max-w-md mx-auto animate-slide-up"
    >
      <div className="bg-slate-900/95 backdrop-blur-xl border border-blue-500/30 text-white rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 p-0.5 flex-shrink-0 shadow-md">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-white">
                Instalar Reparto Fácil
              </h4>
              <p className="text-[11px] text-slate-300 font-medium leading-tight mt-0.5">
                Acceso directo en tu pantalla de inicio, mapa GPS fluido y pantalla completa.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Cerrar aviso de instalación"
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {showIOSGuide ? (
          <div className="bg-slate-800/80 rounded-xl p-3 text-[11px] text-slate-300 space-y-2 border border-slate-700">
            <p className="font-bold text-white flex items-center gap-1.5">
              <span>Para instalar en iPhone:</span>
            </p>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center font-bold text-[10px]">1</span>
              <span>Toca el botón Compartir en Safari</span>
              <Share2 className="w-3.5 h-3.5 text-blue-400 inline" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center font-bold text-[10px]">2</span>
              <span>Baja y selecciona</span>
              <span className="font-bold text-white flex items-center gap-1">
                "Agregar a Inicio" <PlusSquare className="w-3.5 h-3.5 text-emerald-400" />
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleInstallClick}
              className="flex-1 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              {isIOS ? "Ver cómo instalar" : "Instalar Aplicación"}
            </button>
            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-white text-xs font-semibold py-2 px-3 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Ahora no
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
