import { NextRequest, NextResponse } from "next/server";
import { queryDb } from "@/lib/db";
import { authenticateOrderUser } from "@/lib/orderAuth";

export const dynamic = "force-dynamic";

import { ejecutarAuditoriaCustodio, isCustodioAutomaticEnabled } from "@/lib/custodio";


// GET /api/orders/custodio: Auditoría periódica disparada por polling o cron
export async function GET(request: NextRequest) {
  const auth = await authenticateOrderUser(request, ["Client", "Driver"]);
  if (auth.response) return auth.response;
  if (!isCustodioAutomaticEnabled()) {
    return NextResponse.json({ error: "La auditoría automática de Custodio está pausada." }, { status: 503 });
  }
  try {
    const resultado = await ejecutarAuditoriaCustodio();
    return NextResponse.json({ success: true, ...resultado });
  } catch (error) {
    console.error("[Custodio] Error en auditoría:", error);
    return NextResponse.json({ error: "No se pudo ejecutar la auditoría." }, { status: 500 });
  }
}

// POST /api/orders/custodio: Pings de telemetría, desconexión forzada o liberación manual
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateOrderUser(request, ["Client", "Driver"]);
    if (auth.response) return auth.response;
    const body = await request.json();
    const { action, orderId, lat, lng, reason } = body;
    const driverId = auth.user.id;
    const driverAction = action === "ping" || action === "driver_disconnected";
    const clientAction = action === "force_release" || action === "retry_order";
    if ((driverAction && auth.user.role !== "Driver") ||
        (clientAction && auth.user.role !== "Client")) {
      return NextResponse.json({ error: "La cuenta no puede realizar esta acción." }, { status: 403 });
    }
    if (driverAction && body.driverId !== undefined && body.driverId !== driverId) {
      return NextResponse.json({ error: "El repartidor no coincide con la sesión." }, { status: 403 });
    }
    if (action === "driver_disconnected" && !isCustodioAutomaticEnabled()) {
      return NextResponse.json({ error: "La liberación automática de pedidos está pausada." }, { status: 503 });
    }

    // 1. Ping GPS de telemetría del repartidor activo
    if (action === "ping" && driverId) {
      await queryDb(
        `UPDATE repartofacil_pedidos 
         SET driver_last_ping = NOW(),
             driver_lat = COALESCE($1, driver_lat),
             driver_lng = COALESCE($2, driver_lng),
             custodio_advertencia_at = NULL,
             custodio_estado = 'normal'
         WHERE repartidor_id = $3
           AND LOWER(TRIM(estado)) IN ('assigned', 'picked up', 'in transit', 'ready', 'embalado')`,
        [lat, lng, driverId]
      );
      return NextResponse.json({ success: true, action: "ping_recorded" });
    }

    // 2. La desconexión inicia el plazo de espera; no libera pedidos inmediatamente.
    if (action === "driver_disconnected" && driverId) {
      const pedidosChofer = await queryDb(
        `UPDATE repartofacil_pedidos
         SET driver_last_ping = NOW(), custodio_advertencia_at = NULL, custodio_estado = 'normal'
         WHERE repartidor_id = $1
           AND LOWER(TRIM(estado)) IN ('assigned', 'ready', 'embalado')
         RETURNING id`,
        [driverId]
      );
      return NextResponse.json({ success: true, action: "disconnection_recorded", count: pedidosChofer.length });
    }

    // 3. Liberación manual forzada desde Cobro Fácil o Cliente ("Chofer no responde / No se mueve")
    if (action === "force_release" && orderId) {
      const rows = await queryDb(
        `SELECT id, estado, repartidor_id, repartidor_nombre FROM repartofacil_pedidos
         WHERE id = $1 AND (cliente_id = $2 OR cliente_usuario_id = $2)
           AND repartidor_id IS NOT NULL AND repartidor_id <> ''
           AND LOWER(TRIM(estado)) IN ('assigned', 'picked up', 'in transit', 'ready', 'embalado')`,
        [orderId, auth.user.id]
      );
      if (rows.length === 0) {
        return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
      }

      const p = rows[0];
      const choferPrevio = p.repartidor_nombre || "el chofer";
      const nuevoEstado = p.estado === "ready" || p.estado === "Ready" ? "ready" : "confirmed";

      const released = await queryDb(
        `UPDATE repartofacil_pedidos 
         SET repartidor_id = NULL,
             repartidor_nombre = NULL,
             estado = $1,
             custodio_estado = 'reingresado',
             custodio_advertencia_at = NULL,
             updated_at = NOW()
         WHERE id = $2 AND (cliente_id = $3 OR cliente_usuario_id = $3)
           AND repartidor_id = $4
           AND LOWER(TRIM(estado)) IN ('assigned', 'picked up', 'in transit', 'ready', 'embalado')
         RETURNING id`,
        [nuevoEstado, orderId, auth.user.id, p.repartidor_id]
      );
      if (released.length === 0) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

      const msgId = `msg-custodio-${Date.now()}`;
      const horaStr = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
      const motivo = reason || "inactividad o falta de respuesta del chofer";
      const content = `🚨 [Custodio del Sistema]: Pedido reincorporado a la bandeja por ${motivo}. El repartidor anterior (${choferPrevio}) fue desasociado. Buscando nuevo repartidor disponible...`;

      await queryDb(
        `INSERT INTO repartofacil_chat_mensajes 
         (id, order_id, author_role, author_name, content, timestamp_str, created_at)
         VALUES ($1, $2, 'system', 'Sistema Reparto Fácil (Custodio)', $3, $4, NOW())`,
        [msgId, orderId, content, horaStr]
      ).catch(() => {});

      return NextResponse.json({ success: true, action: "force_released", orderId });
    }

    // 4. Retomar pedido cancelado/expirado por timeout
    if (action === "retry_order" && orderId) {
      const retried = await queryDb(
        `UPDATE repartofacil_pedidos 
         SET estado = 'pending_store',
             custodio_estado = 'reintentado',
             custodio_advertencia_at = NULL,
             repartidor_id = NULL,
             repartidor_nombre = NULL,
             created_at = NOW(),
             updated_at = NOW()
         WHERE id = $1 AND (cliente_id = $2 OR cliente_usuario_id = $2)
           AND LOWER(TRIM(estado)) IN ('cancelled', 'cancelled_by_client', 'cancelled_timeout')
         RETURNING id`,
        [orderId, auth.user.id]
      );
      if (retried.length === 0) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

      const msgId = `msg-retry-${Date.now()}`;
      const horaStr = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
      const content = `🔄 [Cliente]: El cliente ha retomado el pedido #${orderId}. Esperando confirmación y preparación por parte de la empresa...`;

      await queryDb(
        `INSERT INTO repartofacil_chat_mensajes 
         (id, order_id, author_role, author_name, content, timestamp_str, created_at)
         VALUES ($1, $2, 'client', 'Cliente Web', $3, $4, NOW())`,
        [msgId, orderId, content, horaStr]
      ).catch(() => {});

      return NextResponse.json({ success: true, action: "order_retried", orderId });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
