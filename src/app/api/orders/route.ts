import { NextRequest, NextResponse } from "next/server";
import { queryDb } from "@/lib/db";
import { ejecutarAuditoriaCustodio, isCustodioAutomaticEnabled } from "@/lib/custodio";
import { authenticateOrderUser } from "@/lib/orderAuth";
import { validateOrder } from "@/lib/validateOrder";
import { GET as readCatalog } from "@/app/api/cobrofacil/[...path]/route";

export const dynamic = "force-dynamic";

function normalizePaymentMethod(value: unknown): "cash" | "transfer" | "card" | "web" {
  switch (String(value || "").toLowerCase()) {
    case "cash":
    case "efectivo":
      return "cash";
    case "transfer":
    case "transferencia":
      return "transfer";
    case "card":
    case "tarjeta":
      return "card";
    default:
      return "web";
  }
}

function mapDbRowToOrder(row: any) {
  let items = [];
  try {
    items = typeof row.items === "string" ? JSON.parse(row.items) : row.items || [];
  } catch {
    items = [];
  }

  return {
    id: row.id,
    ticketId: row.ticket_id || null,
    clientId: row.cliente_id || null,
    clientUserId: row.cliente_usuario_id || null,
    empresaId: row.empresa_id || 1,
    empresaSlug: row.empresa_slug || "maciel",
    clientName: row.cliente_nombre || "Cliente",
    customerName: row.cliente_nombre || "Cliente",
    customerPhone: row.cliente_telefono || "+54 9 341 555-1234",
    deliveryAddress: row.direccion_entrega || "Tucumán 2130, Rosario",
    deliveryType: row.tipo_entrega || "delivery",
    paymentMethod: normalizePaymentMethod(row.metodo_pago),
    status: row.estado || "Pending",
    driverId: row.repartidor_id || null,
    driverName: row.repartidor_nombre || null,
    driverUserId: row.repartidor_usuario_id || null,
    items,
    subtotal: Number(row.subtotal) || 0,
    deliveryFee: Number(row.costo_envio) || 0,
    total: Number(row.total) || 0,
    driverEarnings: row.ganancia_repartidor == null ? null : Number(row.ganancia_repartidor),
    distanceKm: Number(row.distancia_km) || 1.8,
    distanceToStoreKm: 0.8,
    distanceToDeliveryKm: Number(row.distancia_km) || 1.8,
    estimatedMinutes: Number(row.minutos_estimados) || 20,
    branch: row.sucursal_origen || "Frigorífico Maciel (Alfaro 1964, Presidente Derqui)",
    storeCoords: { lat: -34.486522, lng: -58.833579 },
    destinationCoords: (row.delivery_lat != null && row.delivery_lng != null)
      ? { lat: Number(row.delivery_lat), lng: Number(row.delivery_lng) }
      : { lat: -34.4895, lng: -58.8315 },
    deliveryCoordinates: (row.delivery_lat != null && row.delivery_lng != null)
      ? { lat: Number(row.delivery_lat), lng: Number(row.delivery_lng) }
      : null,
    notes: row.notas || "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

function mapDriverActionResult(row: any, isDelivery: boolean) {
  const order = mapDbRowToOrder(row);
  if (!isDelivery) return order;
  return {
    ...order,
    driverSettlement: {
      earning: row.ganancia_repartidor == null ? null : Number(row.ganancia_repartidor),
      cashCollected: normalizePaymentMethod(row.metodo_pago) === "cash"
        ? row.total == null ? null : Number(row.total)
        : 0,
    },
  };
}

// GET /api/orders: Obtener pedidos con filtrado estricto por cliente, empresa o chofer
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOrderUser(request, ["Client", "Driver"]);
    if (auth.response) return auth.response;
    // Custodio Intermediario del Sistema: audita desconexiones e inmovilidad de choferes asignados
    if (isCustodioAutomaticEnabled()) {
      await ejecutarAuditoriaCustodio().catch((error) => console.error("[Custodio] Error en auditoría:", error));
    }

    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get("status");
    const clienteId = searchParams.get("cliente_id") || searchParams.get("clientId");
    const empresaIdParam = searchParams.get("empresa_id") || searchParams.get("companyId");
    const driverIdParam = searchParams.get("repartidor_id") || searchParams.get("driverId");
    const viewParam = searchParams.get("view"); // 'driver_active' | 'driver_available' | 'driver_history'
    const before = searchParams.get("before");

    if (before && (auth.user.role !== "Client" || viewParam !== "client_conversations" || before.length > 200)) {
      return NextResponse.json({ error: "Paginación no válida." }, { status: 400 });
    }

    let query = "SELECT * FROM repartofacil_pedidos WHERE ";
    const values: any[] = [auth.user.id];
    let idx = 2;
    if (auth.user.role === "Client") {
      query += "(cliente_id = $1 OR cliente_usuario_id = $1)";
    } else {
      query += "(repartidor_id = $1 OR ((repartidor_id IS NULL OR repartidor_id = '') AND LOWER(TRIM(estado)) IN ('ready', 'confirmed', 'accepted', 'embalado') AND LOWER(COALESCE(tipo_entrega, 'delivery')) = 'delivery'))";
    }

    // 1. Aislamiento por Cliente: cada comprador ve ÚNICAMENTE sus pedidos
    if (clienteId) {
      query += ` AND (cliente_id = $${idx} OR cliente_usuario_id = $${idx})`;
      values.push(clienteId);
      idx++;
    }

    // 2. Aislamiento por Empresa: cada comercio ve ÚNICAMENTE sus ventas
    if (empresaIdParam) {
      if (empresaIdParam === "2" || empresaIdParam === "empresa-prueba" || empresaIdParam === "prueba") {
        query += ` AND (empresa_id = 2 OR empresa_slug = 'prueba')`;
      } else if (empresaIdParam === "1" || empresaIdParam === "frigorifico-maciel" || empresaIdParam === "maciel") {
        query += ` AND (empresa_id = 1 OR empresa_slug = 'maciel' OR empresa_id IS NULL)`;
      } else {
        query += ` AND (empresa_id = $${idx} OR empresa_slug = $${idx})`;
        values.push(isNaN(Number(empresaIdParam)) ? empresaIdParam : Number(empresaIdParam));
        idx++;
      }
    }

    // 3. Aislamiento por Repartidor
    if (viewParam === "driver_active" && driverIdParam) {
      query += ` AND repartidor_id = $${idx} AND LOWER(estado) IN ('assigned', 'picked up', 'in transit', 'accepted', 'ready', 'embalado')`;
      values.push(driverIdParam);
      idx++;
    } else if (viewParam === "driver_history" && driverIdParam) {
      query += ` AND repartidor_id = $${idx} AND estado = 'Delivered'`;
      values.push(driverIdParam);
      idx++;
    } else if (viewParam === "driver_available") {
      query += ` AND (repartidor_id IS NULL OR repartidor_id = '') AND LOWER(estado) IN ('ready', 'confirmed', 'pending', 'accepted', 'embalado') AND LOWER(COALESCE(tipo_entrega, 'delivery')) = 'delivery'`;
    } else if (driverIdParam && !viewParam) {
      query += ` AND repartidor_id = $${idx}`;
      values.push(driverIdParam);
      idx++;
    }

    if (statusParam) {
      query += ` AND estado = $${idx}`;
      values.push(statusParam);
      idx++;
    }

    const conversationView = auth.user.role === "Client" && viewParam === "client_conversations";
    const activity = (alias: string) =>
      `GREATEST(${alias}.created_at, COALESCE((SELECT MAX(m.created_at) FROM repartofacil_chat_mensajes m WHERE m.order_id = ${alias}.id), ${alias}.created_at))`;
    if (before) {
      query += ` AND (${activity("repartofacil_pedidos")}, id) < (
        SELECT ${activity("previous")}, previous.id FROM repartofacil_pedidos previous
        WHERE previous.id = $${idx} AND (previous.cliente_id = $1 OR previous.cliente_usuario_id = $1)
      )`;
      values.push(before);
    }
    query += conversationView
      ? ` ORDER BY ${activity("repartofacil_pedidos")} DESC, id DESC LIMIT 50`
      : " ORDER BY created_at DESC, id DESC LIMIT 50";

    const rows = await queryDb(query, values);
    const orders = rows.map(mapDbRowToOrder);
    return NextResponse.json(orders);
  } catch (err: any) {
    console.error("[Orders API GET Error]:", err.message);
    return NextResponse.json(
      { error: "No se pudieron obtener pedidos de la base de datos", detail: err.message },
      { status: 500 }
    );
  }
}

// POST /api/orders: Crear nuevo pedido real desde la tienda con asignación de IDs únicos de cliente y empresa
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateOrderUser(request, ["Client"]);
    if (auth.response) return auth.response;
    const data = await request.json();
    const orderId = data.id || `RF-${Math.floor(1000 + Math.random() * 9000)}`;

    const clienteId = auth.user.id;
    const clienteUsuarioId = auth.user.id;
    if ((data.clientId && data.clientId !== clienteId) ||
        (data.clientUserId && data.clientUserId !== clienteUsuarioId)) {
      return NextResponse.json({ error: "El comprador no coincide con la sesión. Volvé a iniciar sesión." }, { status: 403 });
    }

    const [productResponse, companyResponse] = await Promise.all([
      readCatalog(request, { params: Promise.resolve({ path: ["products"] }) }),
      readCatalog(request, { params: Promise.resolve({ path: ["companies"] }) }),
    ]);
    const [productData, companyData] = await Promise.all([productResponse.json(), companyResponse.json()]);
    if (!productResponse.ok || !companyResponse.ok ||
        productData.source !== "crm-libro-local (PostgreSQL Render)" ||
        companyData.source !== "crm-libro-local (PostgreSQL Render)" ||
        !Array.isArray(productData.products) || !Array.isArray(companyData.empresas)) {
      return NextResponse.json({ error: "No se pudo validar el catálogo actualizado. Intentá nuevamente." }, { status: 503 });
    }
    let verified: ReturnType<typeof validateOrder>;
    try {
      verified = validateOrder(data, productData.products, companyData.empresas);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "El pedido no es válido." }, { status: 409 });
    }

    const destLat = data.deliveryLat ?? data.destinationCoords?.lat ?? data.deliveryCoordinates?.lat ?? null;
    const destLng = data.deliveryLng ?? data.destinationCoords?.lng ?? data.deliveryCoordinates?.lng ?? null;

    const sucursalId = (verified.company as any).sucursal_id != null
      ? Number((verified.company as any).sucursal_id)
      : (data.sucursalId != null ? Number(data.sucursalId) : (data.sucursal_id != null ? Number(data.sucursal_id) : 1));

    const insertQuery = `
      INSERT INTO repartofacil_pedidos (
        id, cliente_id, cliente_usuario_id, cliente_nombre, cliente_telefono, direccion_entrega, tipo_entrega,
        metodo_pago, estado, empresa_id, empresa_slug, repartidor_id, repartidor_nombre, items,
        subtotal, costo_envio, total, ganancia_repartidor, distancia_km,
        minutos_estimados, sucursal_origen, notas, ticket_id, delivery_lat, delivery_lng, sucursal_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
      RETURNING *;
    `;

    const values = [
      orderId,
      clienteId,
      clienteUsuarioId,
      data.customerName || data.clientName || "Cliente Web",
      data.customerPhone || "+54 9 341 555-1234",
      data.deliveryAddress || "Tucumán 2130, Rosario",
      data.deliveryType,
      normalizePaymentMethod(data.paymentMethod || data.metodo_pago),
      "pending_store",
      Number(verified.company.empresa_id),
      verified.company.slug,
      null,
      null,
      JSON.stringify(verified.items),
      verified.subtotal,
      verified.deliveryFee,
      verified.total,
      verified.tarifa.driverEarnings,
      verified.tarifa.distanceKm,
      verified.tarifa.estimatedMinutes,
      data.branch || verified.company.name,
      data.notes || "",
      null,
      destLat != null && !isNaN(Number(destLat)) ? Number(destLat) : null,
      destLng != null && !isNaN(Number(destLng)) ? Number(destLng) : null,
      sucursalId,
    ];

    const result = await queryDb(insertQuery, values);
    if (result.length === 0) {
      return NextResponse.json({ error: "El identificador del pedido ya existe. Intentá nuevamente." }, { status: 409 });
    }
    const created = mapDbRowToOrder(result[0]);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    console.error("[Orders API POST Error]:", err.message);
    return NextResponse.json(
      { error: "Error al guardar el pedido en PostgreSQL", detail: err.message },
      { status: 500 }
    );
  }
}

// PATCH /api/orders: Tomar pedido (Assigned), Retirar pedido (Picked Up), Embalar (embalado) o Entregar pedido (Delivered)
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateOrderUser(request, ["Client", "Driver"]);
    if (auth.response) return auth.response;
    const data = await request.json();
    const { id, status } = data;
    const driverId = auth.user.id;
    const driverUserId = auth.user.id;
    const driverName = auth.user.displayName || "Repartidor";

    if (!id) {
      return NextResponse.json({ error: "id de pedido requerido" }, { status: 400 });
    }

    const isAssignment = status === "Assigned";
    const isPickup = status === "Picked Up" || status === "in_transit" || status === "picked_up";
    const isDelivery = status === "Delivered";
    const isPacked = status === "embalado" || status === "ready";
    const driverAction = isAssignment || isPickup || isDelivery;
    const isCancellation = status === "cancelled_by_client";

    if ((!driverAction && !isCancellation && !isPacked) ||
        (driverAction && auth.user.role !== "Driver") ||
        (isCancellation && auth.user.role !== "Client")) {
      return NextResponse.json({ error: "La cuenta no puede realizar esta acción." }, { status: 403 });
    }
    if (driverAction && data.driverId !== undefined && data.driverId !== driverId) {
      return NextResponse.json({ error: "El repartidor no coincide con la sesión." }, { status: 403 });
    }

    let updateQuery = "UPDATE repartofacil_pedidos SET updated_at = NOW()";
    const values: any[] = [];
    let idx = 1;

    if (status) {
      updateQuery += `, estado = $${idx++}`;
      values.push(status);
      if (status === "Assigned" || isPickup) {
        updateQuery += `, driver_last_ping = NOW(), custodio_estado = 'normal', custodio_advertencia_at = NULL`;
      }
    }
    if (driverAction) {
      updateQuery += `, repartidor_id = $${idx++}`;
      values.push(driverId);
    }
    if (driverAction) {
      updateQuery += `, repartidor_usuario_id = $${idx++}`;
      values.push(driverUserId);
    }
    if (driverAction) {
      updateQuery += `, repartidor_nombre = $${idx++}`;
      values.push(driverName);
    }
    if (isPacked && data.recargo_espera && Number(data.recargo_espera) > 0) {
      updateQuery += `, ganancia_repartidor = COALESCE(ganancia_repartidor, 0) + $${idx++}`;
      values.push(Number(data.recargo_espera));
    }
    updateQuery += ` WHERE id = $${idx++}`;
    values.push(id);
    if (isAssignment) {
      updateQuery += " AND (repartidor_id IS NULL OR repartidor_id = '') AND LOWER(TRIM(estado)) IN ('confirmed', 'ready', 'accepted', 'embalado', 'pending', 'pending_store')";
    } else if (isPickup) {
      updateQuery += ` AND repartidor_id = $${idx++} AND LOWER(TRIM(estado)) IN ('assigned', 'ready', 'accepted', 'embalado')`;
      values.push(driverId);
    } else if (isDelivery) {
      updateQuery += ` AND repartidor_id = $${idx++} AND LOWER(TRIM(estado)) IN ('assigned', 'picked up', 'in transit', 'ready', 'embalado')`;
      values.push(driverId);
    } else if (isPacked) {
      updateQuery += ` AND LOWER(TRIM(estado)) NOT IN ('delivered', 'cancelled', 'cancelled_by_client', 'rejected')`;
    } else {
      updateQuery += ` AND (cliente_id = $${idx} OR cliente_usuario_id = $${idx}) AND LOWER(TRIM(estado)) NOT IN ('delivered', 'cancelled', 'cancelled_by_client', 'rejected')`;
      values.push(auth.user.id);
    }
    updateQuery += " RETURNING *;";

    const rows = await queryDb(updateQuery, values);
    if (rows.length === 0) {
      if (driverAction) {
        const existing = await queryDb(
          "SELECT * FROM repartofacil_pedidos WHERE id = $1 LIMIT 1",
          [id]
        );
        if (existing.length === 0) {
          return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
        }
        const existingStatus = String(existing[0].estado || "").trim().toLowerCase();
        const alreadyApplied = existing[0].repartidor_id === driverId && (
          isAssignment
            ? ["assigned", "picked up", "in transit", "ready", "embalado", "delivered"].includes(existingStatus)
            : isPickup
            ? ["picked up", "in transit", "delivered"].includes(existingStatus)
            : existingStatus === "delivered"
        );
        if (alreadyApplied) {
          return NextResponse.json(mapDriverActionResult(existing[0], isDelivery));
        }
        return NextResponse.json(
          {
            error: isAssignment ? "El pedido ya no está disponible." : "La acción no se puede confirmar para este repartidor.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "No se puede cancelar este pedido." }, { status: 409 });
    }

    // Registrar el evento correspondiente en el chat tripartito
    const horaStr = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    if (status === "Assigned") {
      const msgId = `msg-driver-${Date.now()}`;
      const txt = `Repartidor ${driverName || "Lucas Motomensajero"}: ¡Hola! He tomado tu pedido #${id} y voy hacia la sucursal a retirarlo 🛵💨`;
      await queryDb(
        "INSERT INTO repartofacil_chat_mensajes (id, order_id, author_role, author_name, content, timestamp_str, created_at, author_id) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)",
        [msgId, id, "driver", driverName || "Lucas Motomensajero", txt, horaStr, driverId || null]
      ).catch(() => {});
    } else if (isPickup) {
      const msgId = `msg-driver-pickup-${Date.now()}`;
      const txt = `Repartidor ${driverName || "Lucas Motomensajero"}: Ya retiré el pedido #${id} del local y voy en camino a tu domicilio 🛵📦💨`;
      await queryDb(
        "INSERT INTO repartofacil_chat_mensajes (id, order_id, author_role, author_name, content, timestamp_str, created_at, author_id) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)",
        [msgId, id, "driver", driverName || "Lucas Motomensajero", txt, horaStr, driverId || null]
      ).catch(() => {});
    } else if (isPacked) {
      const msgId = `msg-store-pack-${Date.now()}`;
      const recargo = Number(data.recargo_espera || 0);
      const txt = recargo > 0
        ? `Comercio: Pedido #${id} embalado y listo para retirar 📦✨ (Demora en mostrador: se acreditó +$${recargo.toLocaleString('es-AR')} extra por espera al repartidor ⏱️)`
        : `Comercio: Pedido #${id} embalado y listo para ser retirado por el repartidor 📦✨`;
      await queryDb(
        "INSERT INTO repartofacil_chat_mensajes (id, order_id, author_role, author_name, content, timestamp_str, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())",
        [msgId, id, "store", "Comercio", txt, horaStr]
      ).catch(() => {});
    } else if (status === "Delivered") {
      const msgId = `msg-driver-${Date.now()}`;
      const txt = `Repartidor ${driverName || "Lucas Motomensajero"}: Pedido #${id} entregado con éxito en destino. ¡Muchas gracias por tu compra! 📦✅`;
      await queryDb(
        "INSERT INTO repartofacil_chat_mensajes (id, order_id, author_role, author_name, content, timestamp_str, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())",
        [msgId, id, "driver", driverName || "Lucas Motomensajero", txt, horaStr]
      ).catch(() => {});
    } else if (status === "cancelled_by_client" || status === "cancelled" || status === "Cancelled") {
      const msgId = `msg-client-cancel-${Date.now()}`;
      const txt = `✕ El cliente canceló el pedido #${id}.`;
      await queryDb(
        "INSERT INTO repartofacil_chat_mensajes (id, order_id, author_role, author_name, content, timestamp_str, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())",
        [msgId, id, "client", rows[0]?.cliente_nombre || "Cliente", txt, horaStr]
      ).catch(() => {});
    }

    const updated = mapDriverActionResult(rows[0], isDelivery);
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("[Orders API PATCH Error]:", err.message);
    return NextResponse.json(
      { error: "Error al actualizar el pedido en PostgreSQL", detail: err.message },
      { status: 500 }
    );
  }
}
