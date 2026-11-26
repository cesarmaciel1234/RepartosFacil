import { randomUUID } from "node:crypto";
import { queryDb } from "@/lib/db";

export function isCustodioAutomaticEnabled() {
  return process.env.RF_CUSTODIO_AUTOMATIC_ENABLED === "1";
}

export async function ejecutarAuditoriaCustodio() {
  const hora = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const activos = await queryDb<{ total: number }>(
    `SELECT COUNT(*)::integer AS total FROM repartofacil_pedidos
     WHERE repartidor_id IS NOT NULL AND repartidor_id <> ''
       AND LOWER(TRIM(estado)) IN ('assigned', 'picked up', 'in transit', 'ready', 'embalado')`
  );
  const liberados = await queryDb(
    `WITH liberados AS (
       UPDATE repartofacil_pedidos
       SET repartidor_id = NULL,
           repartidor_usuario_id = NULL,
           repartidor_nombre = NULL,
           estado = CASE WHEN LOWER(TRIM(estado)) IN ('ready', 'embalado') THEN 'ready' ELSE 'confirmed' END,
           custodio_estado = 'reingresado',
           custodio_advertencia_at = NULL,
           driver_last_ping = NULL,
           updated_at = NOW()
       WHERE repartidor_id IS NOT NULL AND repartidor_id <> ''
         AND LOWER(TRIM(estado)) IN ('assigned', 'ready', 'embalado')
         AND driver_last_ping <= NOW() - INTERVAL '30 minutes'
         AND custodio_estado = 'advertencia_desconexion_30m_v1'
         AND custodio_advertencia_at >= driver_last_ping
         AND custodio_advertencia_at <= NOW() - INTERVAL '20 minutes'
       RETURNING id
     )
     INSERT INTO repartofacil_chat_mensajes
       (id, order_id, author_role, author_name, content, timestamp_str, created_at)
     SELECT $1 || '-' || id, id, 'system', 'Sistema Reparto Fácil (Custodio)',
       'El pedido volvió a la bandeja después de 30 minutos sin conexión del repartidor y una advertencia previa.',
       $2, NOW()
     FROM liberados RETURNING order_id`,
    [`msg-custodio-${randomUUID()}`, hora]
  );

  const advertencias = await queryDb(
    `WITH advertidos AS (
       UPDATE repartofacil_pedidos
       SET custodio_advertencia_at = NOW(),
           custodio_estado = 'advertencia_desconexion_30m_v1',
           updated_at = NOW()
       WHERE repartidor_id IS NOT NULL AND repartidor_id <> ''
         AND LOWER(TRIM(estado)) IN ('assigned', 'ready', 'embalado')
         AND driver_last_ping <= NOW() - INTERVAL '10 minutes'
         AND custodio_estado IS DISTINCT FROM 'advertencia_desconexion_30m_v1'
       RETURNING id
     )
     INSERT INTO repartofacil_chat_mensajes
       (id, order_id, author_role, author_name, content, timestamp_str, created_at)
     SELECT $1 || '-' || id, id, 'system', 'Sistema Reparto Fácil (Custodio)',
       'El repartidor lleva al menos 10 minutos sin conexión. Si no vuelve a conectarse, el pedido podrá liberarse después de 30 minutos y al menos 20 minutos desde este aviso.',
       $2, NOW()
     FROM advertidos RETURNING order_id`,
    [`msg-custodio-${randomUUID()}`, hora]
  );

  const cancelados = await queryDb(
    `WITH cancelados AS (
       UPDATE repartofacil_pedidos
       SET estado = 'cancelled_timeout',
           custodio_estado = 'timeout_sin_respuesta',
           updated_at = NOW()
       WHERE estado IN ('pending_store', 'pending', 'Pending')
         AND created_at < NOW() - INTERVAL '60 minutes'
       RETURNING id
     )
     INSERT INTO repartofacil_chat_mensajes
       (id, order_id, author_role, author_name, content, timestamp_str, created_at)
     SELECT $1 || '-' || id, id, 'system', 'Sistema Reparto Fácil (Custodio)',
       'El comercio no aceptó el pedido en una hora y se canceló automáticamente. Podés retomarlo o elegir otra tienda.',
       $2, NOW()
     FROM cancelados RETURNING order_id`,
    [`msg-timeout-${randomUUID()}`, hora]
  );

  return { total: activos[0].total, advertencias: advertencias.length, liberados: liberados.length, canceladosTimeout: cancelados.length };
}
