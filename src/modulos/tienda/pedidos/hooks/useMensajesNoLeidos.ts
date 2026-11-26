"use client";

import { useEffect, useRef, useState } from "react";
import { authHeaders } from "@/lib/clientAuth";
import { playNotificationSound, triggerVibration, setBrowserAppBadge } from "@/lib/browserIntegration";

export function useMensajesNoLeidos(role: "Client" | "Driver" = "Client") {
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [error, setError] = useState(false);
  const prevTotalRef = useRef<number>(0);

  useEffect(() => {
    let active = true;
    let sequence = 0;
    const refresh = async () => {
      const request = ++sequence;
      const headers = authHeaders(role);
      if (!headers.Authorization) {
        setUnread({});
        setError(false);
        setBrowserAppBadge(0);
        return;
      }
      try {
        const response = await fetch("/api/chat/unread", { headers, cache: "no-store" });
        if (!response.ok) throw new Error(`El servidor respondió ${response.status}`);
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !Array.isArray((data as { conversations?: unknown }).conversations)) {
          throw new Error("Respuesta de mensajes nuevos inválida.");
        }
        const entries = (data as { conversations: unknown[] }).conversations;
        const counts: Record<string, number> = {};
        for (const entry of entries) {
          if (!entry || typeof entry !== "object") throw new Error("Contador de mensajes inválido.");
          const row = entry as { order_id?: unknown; unread?: unknown };
          if (typeof row.order_id !== "string" || typeof row.unread !== "number" ||
              !Number.isSafeInteger(row.unread) || row.unread < 0) {
            throw new Error("Contador de mensajes inválido.");
          }
          counts[row.order_id] = row.unread;
        }
        if (active && request === sequence && authHeaders(role).Authorization === headers.Authorization) {
          const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
          if (total > prevTotalRef.current && prevTotalRef.current >= 0) {
            playNotificationSound();
            triggerVibration([120, 60, 120]);
          }
          prevTotalRef.current = total;
          setBrowserAppBadge(total);
          setUnread(counts);
          setError(false);
        }
      } catch (cause) {
        if (active && request === sequence) {
          console.warn("No se pudieron actualizar los mensajes nuevos:", cause);
          setUnread({});
          setError(true);
        }
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 4000);
    const handleChatRead = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (detail && typeof detail.orderId === "string") {
        setUnread((prev) => {
          if (!prev[detail.orderId]) return prev;
          const next = { ...prev };
          delete next[detail.orderId];
          const total = Object.values(next).reduce((sum, count) => sum + count, 0);
          setBrowserAppBadge(total);
          return next;
        });
      }
      void refresh();
    };
    window.addEventListener("rf-chat-read", handleChatRead);
    const refreshIdentity = () => {
      setUnread({});
      setError(false);
      void refresh();
    };
    window.addEventListener("repartofacil-client-auth", refreshIdentity);
    window.addEventListener("repartofacil-auth", refreshIdentity);
    window.addEventListener("storage", refreshIdentity);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("rf-chat-read", handleChatRead);
      window.removeEventListener("repartofacil-client-auth", refreshIdentity);
      window.removeEventListener("repartofacil-auth", refreshIdentity);
      window.removeEventListener("storage", refreshIdentity);
    };
  }, [role]);

  return { unread, unreadError: error, unreadTotal: Object.values(unread).reduce((sum, count) => sum + count, 0) };
}
