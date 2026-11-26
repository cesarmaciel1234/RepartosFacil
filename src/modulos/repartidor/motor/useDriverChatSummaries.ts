"use client";

import { useEffect, useState } from "react";
import { authHeaders } from "@/lib/clientAuth";
import type { DriverOrder } from "./tipos";

export interface ChatConversationSummary {
  order: DriverOrder;
  lastMessage: string;
  lastSender: string;
  lastTime: string;
  timestampMs: number;
}

export async function loadDriverChatSummaries(
  orders: DriverOrder[],
  authorization: string,
  signal: AbortSignal
): Promise<ChatConversationSummary[]> {
  const summaries = await Promise.all(orders.map(async (order) => {
    const response = await fetch(`/api/chat/${encodeURIComponent(order.id)}`, {
      headers: { Authorization: authorization },
      cache: "no-store",
      signal,
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("No se pudieron actualizar las conversaciones.");
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("success" in data) || data.success !== true ||
        !("messages" in data) || !Array.isArray(data.messages)) {
      throw new Error("La respuesta de conversaciones no es válida.");
    }
    const raw: unknown = data.messages[data.messages.length - 1];
    let latest: { content: string; authorRole: string; timestamp: string; authorName?: string; createdAt?: string } | undefined;
    if (raw !== undefined) {
      if (!raw || typeof raw !== "object") throw new Error("La respuesta de conversaciones no es válida.");
      const message = raw as Record<string, unknown>;
      if (typeof message.content !== "string" || typeof message.authorRole !== "string" ||
          typeof message.timestamp !== "string" ||
          (message.authorName != null && typeof message.authorName !== "string") ||
          (message.createdAt != null && typeof message.createdAt !== "string")) {
        throw new Error("La respuesta de conversaciones no es válida.");
      }
      latest = {
        content: message.content,
        authorRole: message.authorRole,
        timestamp: message.timestamp,
        authorName: typeof message.authorName === "string" ? message.authorName : undefined,
        createdAt: typeof message.createdAt === "string" ? message.createdAt : undefined,
      };
    }
    const time = latest?.createdAt || order.updatedAt || order.createdAt;
    const timestampMs = time ? Date.parse(time) : 0;
    return {
      order,
      lastMessage: latest?.content || "Tocá para abrir el chat del pedido.",
      lastSender: latest?.authorRole === "driver" ? "Tú"
        : latest?.authorRole === "client" ? "Cliente"
        : latest?.authorName || "Sistema",
      lastTime: latest?.timestamp || "Reciente",
      timestampMs: Number.isFinite(timestampMs) ? timestampMs : 0,
    };
  }));
  return summaries.filter((summary): summary is ChatConversationSummary => summary !== null)
    .sort((a, b) => b.timestampMs - a.timestampMs);
}

export function useDriverChatSummaries(isOpen: boolean, orders: DriverOrder[]) {
  const [summaries, setSummaries] = useState<ChatConversationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSummaries([]);
      setError(null);
      return;
    }
    let active = true;
    let sequence = 0;
    let controller: AbortController | null = null;
    const refresh = async (replace = false) => {
      if (controller && !replace) return;
      const request = ++sequence;
      controller?.abort();
      controller = new AbortController();
      const currentController = controller;
      const signal = currentController.signal;
      const authorization = authHeaders("Driver").Authorization;
      if (!orders.length) {
        setSummaries([]);
        setError(null);
        controller = null;
        return;
      }
      if (!authorization) {
        setSummaries([]);
        setError("Iniciá sesión para consultar tus conversaciones.");
        controller = null;
        return;
      }
      try {
        const result = await loadDriverChatSummaries(orders, authorization, signal);
        if (active && request === sequence && authHeaders("Driver").Authorization === authorization) {
          setSummaries(result);
          setError(null);
        }
      } catch (cause) {
        if (active && request === sequence && !signal.aborted) {
          currentController.abort();
          console.warn("No se pudieron actualizar las conversaciones del repartidor:", cause);
          setSummaries([]);
          setError(cause instanceof Error ? cause.message : "No se pudieron actualizar las conversaciones.");
        }
      } finally {
        if (request === sequence) controller = null;
      }
    };
    const identityChanged = () => {
      setSummaries([]);
      setError(null);
      void refresh(true);
    };
    setSummaries([]);
    setError(null);
    void refresh();
    const interval = window.setInterval(() => void refresh(), 3000);
    window.addEventListener("repartofacil-driver-auth", identityChanged);
    window.addEventListener("storage", identityChanged);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("repartofacil-driver-auth", identityChanged);
      window.removeEventListener("storage", identityChanged);
    };
  }, [isOpen, orders]);

  return { summaries, error };
}
