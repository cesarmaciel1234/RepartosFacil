import { NextRequest, NextResponse } from "next/server";
import { queryDb } from "@/lib/db";
import { authenticateOrderUser } from "@/lib/orderAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOrderUser(request, ["Client", "Driver"]);
    if (auth.response) return auth.response;

    const isDriver = auth.user.role === "Driver";
    const rows = await queryDb<{ order_id: string; unread: number }>(
      `SELECT p.id AS order_id, COUNT(*)::integer AS unread
       FROM repartofacil_pedidos p
       JOIN repartofacil_chat_mensajes m ON m.order_id = p.id
       LEFT JOIN repartofacil_chat_lecturas l ON l.mensaje_id = m.id AND l.usuario_id = $1
       WHERE (
         ($2 = true AND (p.repartidor_id = $1 OR p.repartidor_usuario_id = $1) AND LOWER(COALESCE(m.author_role, '')) <> 'driver')
         OR
         ($2 = false AND (p.cliente_id = $1 OR p.cliente_usuario_id = $1) AND LOWER(COALESCE(m.author_role, '')) <> 'client')
       )
       AND l.mensaje_id IS NULL
       GROUP BY p.id`,
      [auth.user.id, isDriver]
    );
    return NextResponse.json({ conversations: rows, total: rows.reduce((sum, row) => sum + row.unread, 0) });
  } catch (error) {
    console.error("[Chat unread] No se pudieron consultar mensajes nuevos:", error);
    return NextResponse.json({ error: "No se pudieron consultar los mensajes nuevos." }, { status: 500 });
  }
}
