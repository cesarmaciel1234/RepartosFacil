import { NextResponse } from "next/server";
import { queryDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export async function GET() {
  const result: Record<string, any> = {
    timestamp: new Date().toISOString(),
    postgres: "pending",
    backend: "pending",
  };

  // 1. Despertar / calentar conexión a PostgreSQL (si está configurada)
  if (process.env.DATABASE_URL) {
    try {
      await queryDb("SELECT 1 AS alive");
      result.postgres = "connected";
    } catch (err: any) {
      result.postgres = `error: ${err?.message || err}`;
    }
  } else {
    result.postgres = "skipped_no_env";
  }

  // 2. Enviar señal HTTP a Render para despertar el backend de FastAPI
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(`${BACKEND_URL}/health`, {
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    result.backend = res.ok ? "awake" : `status_${res.status}`;
  } catch (err: any) {
    result.backend = `waking_up_or_error: ${err?.name || err?.message}`;
  }

  return NextResponse.json(result);
}
