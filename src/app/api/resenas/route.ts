import { NextRequest, NextResponse } from "next/server";
import { queryDb } from "@/lib/db";
import { authenticateOrderUser } from "@/lib/orderAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateOrderUser(request, ["Client"]);
  if (auth.response) return auth.response;
  const pedidoId = request.nextUrl.searchParams.get("pedidoId");
  if (!pedidoId || pedidoId.length > 200) {
    return NextResponse.json({ error: "El pedido no es válido." }, { status: 400 });
  }
  try {
    const rows = await queryDb<{ estrellas: number; comentario: string }>(
      `SELECT r.estrellas, r.comentario FROM public.repartofacil_resenas r
       JOIN public.repartofacil_pedidos p ON p.id = r.pedido_id
       WHERE r.pedido_id = $1 AND (p.cliente_id = $2 OR p.cliente_usuario_id = $2)`,
      [pedidoId, auth.user.id]
    );
    return NextResponse.json({ resena: rows[0] || null });
  } catch (error) {
    console.error("[Reseñas] No se pudo consultar:", error);
    return NextResponse.json({ error: "No se pudo consultar la reseña." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateOrderUser(request, ["Client"]);
  if (auth.response) return auth.response;

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "La reseña no es válida." }, { status: 400 });
  }
  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "La reseña no es válida." }, { status: 400 });
  }
  const { pedidoId, estrellas, comentario } = data as Record<string, unknown>;
  if (typeof pedidoId !== "string" || !pedidoId.trim() || pedidoId.length > 200 ||
      typeof estrellas !== "number" || !Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5 ||
      typeof comentario !== "string" || comentario.length > 500) {
    return NextResponse.json({ error: "Indicá entre 1 y 5 estrellas y un comentario de hasta 500 caracteres." }, { status: 400 });
  }
  try {
    const inserted = await queryDb<{ pedido_id: string }>(
      `INSERT INTO public.repartofacil_resenas (pedido_id, empresa_id, cliente_usuario_id, estrellas, comentario)
       SELECT id, empresa_id, $2, $3, $4 FROM public.repartofacil_pedidos
       WHERE id = $1 AND (cliente_id = $2 OR cliente_usuario_id = $2)
         AND LOWER(TRIM(estado)) = 'delivered' AND empresa_id IS NOT NULL
       ON CONFLICT (pedido_id) DO NOTHING RETURNING pedido_id`,
      [pedidoId, auth.user.id, estrellas, comentario.trim()]
    );
    if (!inserted.length) {
      return NextResponse.json({ error: "El pedido no admite una reseña o ya fue calificado." }, { status: 409 });
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[Reseñas] No se pudo guardar:", error);
    return NextResponse.json({ error: "No se pudo guardar la reseña. Intentá nuevamente." }, { status: 503 });
  }
}
