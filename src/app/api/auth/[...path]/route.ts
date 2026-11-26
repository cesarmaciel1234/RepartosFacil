import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";
const AUTH_TIMEOUT_MS = 60_000;
const GATEWAY_STATUSES = new Set([502, 503, 504]);

type AuthInit = {
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
  retryNetwork: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readBackendJson(response: Response) {
  const text = await response.text();
  const trimmed = text.trim();
  const contentType = response.headers.get("content-type") || "";
  const looksJson = contentType.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!looksJson) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function forwardAuth(path: string, init: AuthInit) {
  const url = `${BACKEND_URL}/api/auth/${path}`;
  const deadline = Date.now() + AUTH_TIMEOUT_MS;
  let attempts = 0;

  while (true) {
    const remaining = deadline - Date.now();
    if (remaining <= 500) break;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.min(25_000, remaining));
    try {
      const response = await fetch(url, {
        method: init.method,
        headers: init.headers,
        body: init.body,
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await readBackendJson(response);
      if (data !== null) {
        return NextResponse.json(data, { status: response.status });
      }

      const isGateway = GATEWAY_STATUSES.has(response.status);
      console.warn(`[Auth Proxy] ${init.method} ${path}: backend respondió HTTP ${response.status} (despertando instancia Render...)`);
      if (!isGateway || deadline - Date.now() <= 1500) break;
      attempts += 1;
      await sleep(Math.min(3000, deadline - Date.now() - 500));
    } catch (error) {
      const name = error instanceof Error ? error.name : "UnknownError";
      console.warn(`[Auth Proxy] ${init.method} ${path}: conexión en espera (${name}), backend de Render despertando... Intento #${attempts + 1}`);
      const canRetry = init.retryNetwork && deadline - Date.now() > 2000;
      if (!canRetry) break;
      attempts += 1;
      await sleep(Math.min(3000, deadline - Date.now() - 500));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return NextResponse.json(
    { detail: "Servicio de autenticación no disponible. El servidor está despertando, reintentá en unos segundos." },
    { status: 503 }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const authHeader = request.headers.get("authorization");
  if (authHeader) headers.Authorization = authHeader;
  const body = await request.text();
  return forwardAuth(path.join("/"), { method: "POST", headers, body, retryNetwork: true });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const headers: Record<string, string> = {};
  const authHeader = request.headers.get("authorization");
  if (authHeader) headers.Authorization = authHeader;
  return forwardAuth(path.join("/"), { method: "GET", headers, retryNetwork: true });
}
