import { NextRequest, NextResponse } from "next/server";
import { queryDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("empresaId") || "";
  const empresaId = Number(raw);
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(empresaId) || empresaId > 2147483647) {
    return NextResponse.json({ error: "El comercio no es válido." }, { status: 400 });
  }
  try {
    const resenas = await queryDb<{ estrellas: number; comentario: string; created_at: string }>(
      `SELECT r.estrellas, r.comentario, r.created_at FROM public.repartofacil_resenas r
       JOIN public.empresas e ON e.id = r.empresa_id AND e.activo = 1
       WHERE r.empresa_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
      [empresaId]
    );
    return NextResponse.json({ resenas });
  } catch (error) {
    console.error("[Reseñas] No se pudieron consultar:", error);
    return NextResponse.json({ error: "No se pudieron cargar las reseñas." }, { status: 503 });
  }
}
