import { NextRequest, NextResponse } from "next/server";
import { queryDb } from "@/lib/db";
import { authenticateOrderUser, type OrderUser } from "@/lib/orderAuth";

export const dynamic = "force-dynamic";

function accessCondition(user: OrderUser, parameter: string): string {
  return user.role === "Client"
    ? `(p.cliente_id = ${parameter} OR p.cliente_usuario_id = ${parameter})`
    : `(p.repartidor_id = ${parameter} AND LOWER(TRIM(p.estado)) IN ('assigned', 'picked up', 'in transit', 'ready', 'embalado'))`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  try {
    const auth = await authenticateOrderUser(request, ["Client", "Driver"]);
    if (auth.response) return auth.response;
    const markRead = request.nextUrl?.searchParams.get("read") === "1";

    if (markRead) {
      await queryDb(
        `WITH visible_messages AS MATERIALIZED (
           SELECT m.id, m.author_role FROM repartofacil_pedidos p
           JOIN repartofacil_chat_mensajes m ON m.order_id = p.id
           WHERE p.id = $1 AND ${accessCondition(auth.user, "$2")}
         )
         INSERT INTO repartofacil_chat_lecturas (usuario_id, mensaje_id)
         SELECT $2, id FROM visible_messages 
         WHERE (
           ($3 = 'Driver' AND LOWER(COALESCE(author_role, '')) <> 'driver')
           OR ($3 = 'Client' AND LOWER(COALESCE(author_role, '')) <> 'client')
           OR ($3 NOT IN ('Driver', 'Client'))
         )
         ON CONFLICT (usuario_id, mensaje_id) DO NOTHING`,
        [orderId, auth.user.id, auth.user.role]
      ).catch(() => {});
    }

    const rows = await queryDb(
      `SELECT m.id, m.order_id, m.author_role, m.author_name, m.content, m.timestamp_str, m.created_at,
              EXISTS (
                SELECT 1 FROM repartofacil_chat_lecturas l
                WHERE l.mensaje_id = m.id AND l.usuario_id <> $2
              ) AS is_read
       FROM repartofacil_pedidos p
       JOIN repartofacil_chat_mensajes m ON m.order_id = p.id
       WHERE p.id = $1 AND ${accessCondition(auth.user, "$2")}
       ORDER BY m.created_at ASC, m.id ASC`,
      [orderId, auth.user.id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Conversación no disponible." }, { status: 404 });

    const messages = rows.filter((r: any) => r.id !== null).map((r: any) => ({
      id: r.id,
      orderId: r.order_id,
      authorRole: r.author_role === "store" ? "company" : r.author_role,
      authorName: r.author_name,
      content: r.content,
      timestamp: r.timestamp_str,
      createdAt: r.created_at,
      isRead: Boolean(r.is_read),
    }));

    return NextResponse.json({ success: true, orderId, messages });
  } catch (err: any) {
    console.warn(`[Chat API GET Error for ${orderId}]:`, err.message);
    return NextResponse.json({ error: "No se pudieron cargar los mensajes." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  try {
    const auth = await authenticateOrderUser(request, ["Client", "Driver"]);
    if (auth.response) return auth.response;
    const body = await request.json();
    const id = body.id || `msg-${Date.now()}`;
    const authorRole = auth.user.role === "Driver" ? "driver" : "client";
    const authorName = auth.user.displayName || (authorRole === "driver" ? "Repartidor" : "Cliente");
    const content = typeof body.content === "string" ? body.content : "";
    const timestampStr = body.timestamp || new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    if (!content.trim()) {
      return NextResponse.json({ error: "Contenido requerido" }, { status: 400 });
    }

    const insertQuery = `
      INSERT INTO repartofacil_chat_mensajes (id, order_id, author_role, author_name, content, timestamp_str, created_at)
      SELECT $1, p.id, $3, $4, $5, $6, NOW() FROM repartofacil_pedidos p
      WHERE p.id = $2 AND ${accessCondition(auth.user, "$7")}
      FOR SHARE OF p
      RETURNING *;
    `;

    const rows = await queryDb(insertQuery, [id, orderId, authorRole, authorName, content, timestampStr, auth.user.id]);
    if (rows.length === 0) return NextResponse.json({ error: "Conversación no disponible." }, { status: 404 });

    // Si el repartidor responde en el chat, el Custodio limpia cualquier advertencia de inactividad
    if (authorRole === "driver") {
      await queryDb(
        "UPDATE repartofacil_pedidos SET driver_last_ping = NOW(), custodio_advertencia_at = NULL, custodio_estado = 'normal', updated_at = NOW() WHERE id = $1 AND repartidor_id = $2",
        [orderId, auth.user.id]
      ).catch((error) => console.warn("[Chat API] No se pudo actualizar el ping:", error));
    }

    return NextResponse.json({
      success: true,
      message: {
        id: rows[0].id,
        orderId: rows[0].order_id,
        authorRole: rows[0].author_role,
        authorName: rows[0].author_name,
        content: rows[0].content,
        timestamp: rows[0].timestamp_str,
      },
    }, { status: 201 });
  } catch (err: any) {
    console.warn(`[Chat API POST Error for ${orderId}]:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
