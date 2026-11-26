import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

function rejectLegacyOrders() {
  return NextResponse.json({ error: "Usá la API protegida de pedidos." }, { status: 410 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");

  if (path[0] === "orders") return rejectLegacyOrders();

  const search = request.nextUrl.search;
  const url = `${BACKEND_URL}/api/db/${pathStr}${search}`;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const authHeader = request.headers.get("authorization");
    if (authHeader) headers["Authorization"] = authHeader;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(url, { headers, cache: "no-store", signal: controller.signal })
      .finally(() => clearTimeout(timeoutId));

    if (!res.ok) {
      return NextResponse.json(path.length % 2 === 1 ? [] : null, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[DB Proxy] No se pudo consultar el documento:", error);
    return NextResponse.json({ error: "No se pudo consultar el documento." }, { status: 503 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");

  if (path[0] === "orders") return rejectLegacyOrders();

  const url = `${BACKEND_URL}/api/db/${pathStr}`;
  try {
    const body = await request.text();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const authHeader = request.headers.get("authorization");
    if (authHeader) headers["Authorization"] = authHeader;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[DB Proxy] No se pudo crear el documento:", error);
    return NextResponse.json({ error: "No se pudo crear el documento." }, { status: 503 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  if (path[0] === "orders") return rejectLegacyOrders();
  return forwardMutation(request, path.join("/"), "PATCH");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  if (path[0] === "orders") return rejectLegacyOrders();
  return forwardMutation(request, path.join("/"), "DELETE");
}

async function forwardMutation(request: NextRequest, path: string, method: "PATCH" | "DELETE") {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const authorization = request.headers.get("authorization");
    if (authorization) headers.Authorization = authorization;
    const response = await fetch(`${BACKEND_URL}/api/db/${path}`, {
      method,
      headers,
      body: method === "PATCH" ? await request.text() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[DB Proxy] No se pudo actualizar el documento:", error);
    return NextResponse.json({ error: "No se pudo actualizar el documento." }, { status: 503 });
  }
}
