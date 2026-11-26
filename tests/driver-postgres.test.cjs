const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { randomBytes } = require("node:crypto");
const { Pool } = require("pg");
const ts = require("typescript");
const dotenv = require("dotenv");

test("asignación concurrente y entrega idempotente en PostgreSQL", {
  skip: process.env.RF_RUN_POSTGRES_TEST !== "1",
}, async () => {
  const envFile = process.env.RF_DATABASE_ENV_FILE;
  assert.ok(envFile, "Indicá RF_DATABASE_ENV_FILE para la base autorizada.");
  const env = {};
  const loaded = dotenv.config({ path: envFile, processEnv: env, quiet: true });
  assert.ok(!loaded.error && env.DATABASE_URL, "No se pudo leer DATABASE_URL.");

  const connectionString = env.DATABASE_URL;
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("render.com") || connectionString.includes("dpg-")
      ? { rejectUnauthorized: false } : undefined,
    max: 5,
    connectionTimeoutMillis: 10000,
  });
  const schema = `rf_test_${randomBytes(12).toString("hex")}`;
  const quotedSchema = `"${schema}"`;
  let created = false;

  const safeQuery = async (client, sql, values) => {
    try {
      return await client.query(sql, values);
    } catch (error) {
      throw new Error(`Falló una consulta de prueba: ${error.code || "error de conexión"}`);
    }
  };
  const queryDb = async (sql, values) => {
    const client = await pool.connect();
    try {
      await safeQuery(client, `SET search_path TO ${quotedSchema}`);
      return (await safeQuery(client, sql, values)).rows;
    } finally {
      client.release();
    }
  };

  try {
    const admin = await pool.connect();
    try {
      await safeQuery(admin, `CREATE SCHEMA ${quotedSchema}`);
      created = true;
      await safeQuery(admin, `CREATE TABLE ${quotedSchema}.repartofacil_pedidos (
        id text PRIMARY KEY, estado text, repartidor_id text, repartidor_usuario_id text,
        repartidor_nombre text, updated_at timestamptz, driver_last_ping timestamptz,
        driver_lat numeric, driver_lng numeric,
        custodio_estado text, custodio_advertencia_at timestamptz, ticket_id text,
        created_at timestamptz, cliente_nombre text, cliente_id text, cliente_usuario_id text, direccion_entrega text,
        items jsonb, total numeric, ganancia_repartidor numeric, metodo_pago text
      )`);
      await safeQuery(admin, `CREATE TABLE ${quotedSchema}.repartofacil_chat_mensajes (
        id text PRIMARY KEY, order_id text, author_role text, author_name text,
        content text, timestamp_str text, created_at timestamptz, author_id text
      )`);
      await safeQuery(admin, `CREATE TABLE ${quotedSchema}.repartofacil_chat_lecturas (
        usuario_id text NOT NULL, mensaje_id text NOT NULL, PRIMARY KEY (usuario_id, mensaje_id)
      )`);
      await safeQuery(admin, `INSERT INTO ${quotedSchema}.repartofacil_pedidos
        (id, estado, cliente_nombre, direccion_entrega, items, total, ganancia_repartidor, metodo_pago, created_at)
        VALUES ('TEST-ISOLATED', 'ready', 'Cliente ficticio', 'Dirección ficticia', '[]', 1000, 0, 'cash', NOW())`);
    } finally {
      admin.release();
    }

    const source = fs.readFileSync(path.join(process.cwd(), "src/app/api/orders/route.ts"), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const exports = {};
    vm.runInNewContext(compiled, {
      exports, console, process: { env: { RF_DRIVER_ACTIONS_LEGACY_COMPAT: "1" } },
      require(name) {
        if (name === "next/server") {
          return { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };
        }
        if (name === "@/lib/db") return { queryDb };
        if (name === "@/lib/custodio") return { ejecutarAuditoriaCustodio: async () => {}, isCustodioAutomaticEnabled: () => false };
        if (name === "@/lib/validateOrder") return {};
        if (name === "@/app/api/cobrofacil/[...path]/route") return {};
        if (name === "@/lib/orderAuth") return { authenticateOrderUser: async (req) => {
          if (req.user) return { user: req.user };
          const { driverId } = await req.json();
          return driverId ? { user: { id: driverId, role: "Driver", displayName: "Prueba" } }
            : { response: { status: 401 } };
        } };
        throw new Error(`Dependencia inesperada: ${name}`);
      },
    });
    const request = (status, driverId, driverProtocol = 2, id = "TEST-ISOLATED") => ({
      json: async () => ({ id, status, driverId, driverProtocol }),
    });
    const results = await Promise.all([
      exports.PATCH(request("Assigned", "test-driver-1")),
      exports.PATCH(request("Assigned", "test-driver-2")),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    const winner = results.find((result) => result.status === 200).body.driverId;
    const loser = winner === "test-driver-1" ? "test-driver-2" : "test-driver-1";
    assert.equal((await exports.PATCH(request("Assigned", winner))).status, 200);
    assert.equal((await exports.PATCH(request("Delivered", loser))).status, 409);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const delivered = await exports.PATCH(request("Delivered", winner));
    assert.equal(delivered.status, 200);
    assert.equal(delivered.body.driverSettlement.earning, 0);
    assert.equal((await exports.PATCH(request("Delivered", winner))).status, 200);
    assert.equal((await exports.PATCH(request("Delivered"))).status, 401);
    const events = await queryDb("SELECT COUNT(*)::integer AS count FROM repartofacil_chat_mensajes");
    assert.equal(events[0].count, 2);
    await queryDb(`INSERT INTO repartofacil_pedidos
      (id, estado, cliente_nombre, direccion_entrega, items, total, ganancia_repartidor, metodo_pago, created_at)
      VALUES ('TEST-LEGACY', 'Assigned', 'Cliente ficticio', 'Dirección ficticia', '[]', 1000, 100, 'cash', NOW())`);
    const legacy = { json: async () => ({ id: "TEST-LEGACY", status: "Delivered" }) };
    assert.equal((await exports.PATCH(legacy)).status, 401);

    await queryDb(`INSERT INTO repartofacil_pedidos
      (id, estado, cliente_id, repartidor_id, cliente_nombre, direccion_entrega, items, total, created_at)
      VALUES
      ('TEST-OWN', 'Assigned', 'buyer-1', 'test-driver-1', 'Cliente ficticio', 'Prueba', '[]', 100, NOW()),
      ('TEST-OTHER', 'Assigned', 'buyer-2', 'test-driver-2', 'Otro ficticio', 'Prueba', '[]', 100, NOW()),
      ('TEST-AVAILABLE', 'ready', 'buyer-2', NULL, 'Otro ficticio', 'Prueba', '[]', 100, NOW())`);
    const getRequest = (id, role) => ({
      user: { id, role, displayName: "Prueba" },
      nextUrl: { searchParams: new URLSearchParams() },
    });
    const buyerOrders = await exports.GET(getRequest("buyer-1", "Client"));
    assert.deepEqual(Array.from(buyerOrders.body, (order) => order.id), ["TEST-OWN"]);
    const driverOrders = await exports.GET(getRequest("test-driver-1", "Driver"));
    const driverIds = Array.from(driverOrders.body, (order) => order.id);
    assert.ok(driverIds.includes("TEST-OWN"));
    assert.ok(driverIds.includes("TEST-AVAILABLE"));
    assert.ok(!driverIds.includes("TEST-OTHER"));
    const cancel = (orderId) => ({
      user: { id: "buyer-1", role: "Client", displayName: "Prueba" },
      json: async () => ({ id: orderId, status: "cancelled_by_client" }),
    });
    assert.equal((await exports.PATCH(cancel("TEST-OTHER"))).status, 409);
    assert.equal((await exports.PATCH(cancel("TEST-OWN"))).status, 200);

    const chatSource = fs.readFileSync(path.join(process.cwd(), "src/app/api/chat/[orderId]/route.ts"), "utf8");
    const chatExports = {};
    let notifyChatInsert;
    const chatQueryDb = (sql, values) => {
      if (sql.includes("INSERT INTO repartofacil_chat_mensajes") && notifyChatInsert) notifyChatInsert();
      return queryDb(sql, values);
    };
    vm.runInNewContext(ts.transpileModule(chatSource, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText, {
      exports: chatExports, console,
      require(name) {
        if (name === "next/server") return { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };
        if (name === "@/lib/db") return { queryDb: chatQueryDb };
        if (name === "@/lib/orderAuth") return { authenticateOrderUser: async (req) => ({ user: req.user }) };
        throw new Error(`Dependencia inesperada: ${name}`);
      },
    });
    const chatParams = { params: Promise.resolve({ orderId: "TEST-OTHER" }) };
    const chatRequest = (id, role, content) => ({
      user: { id, role, displayName: "Prueba" },
      json: async () => ({ id: "test-message", content }),
    });
    assert.equal((await chatExports.GET(chatRequest("buyer-2", "Client"), chatParams)).body.messages.length, 0);
    assert.equal((await chatExports.GET(chatRequest("buyer-1", "Client"), chatParams)).status, 404);
    assert.equal((await chatExports.POST(chatRequest("buyer-1", "Client", "Prueba"), chatParams)).status, 404);
    assert.equal((await chatExports.POST(chatRequest("buyer-2", "Client", "Prueba"), chatParams)).status, 201);
    assert.equal((await chatExports.GET(chatRequest("test-driver-2", "Driver"), chatParams)).body.messages.length, 1);
    const unreadExports = {};
    const unreadSource = fs.readFileSync(path.join(process.cwd(), "src/app/api/chat/unread/route.ts"), "utf8");
    vm.runInNewContext(ts.transpileModule(unreadSource, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText, {
      exports: unreadExports, console,
      require(name) {
        if (name === "next/server") return { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };
        if (name === "@/lib/db") return { queryDb };
        if (name === "@/lib/orderAuth") return { authenticateOrderUser: async (req) => ({ user: req.user }) };
        throw new Error(`Dependencia inesperada: ${name}`);
      },
    });
    await queryDb(`INSERT INTO repartofacil_chat_mensajes
      (id, order_id, author_role, author_name, content, timestamp_str, created_at)
      VALUES ('store-message', 'TEST-OTHER', 'store', 'Comercio', 'Hola', '12:00', NOW())`);
    const buyer = chatRequest("buyer-2", "Client");
    assert.equal((await unreadExports.GET(buyer)).body.total, 1);
    buyer.nextUrl = { searchParams: new URLSearchParams("read=1") };
    assert.equal((await chatExports.GET(buyer, chatParams)).body.messages.length, 2);
    assert.equal((await unreadExports.GET(buyer)).body.total, 0);
    await queryDb(`INSERT INTO repartofacil_chat_mensajes
      (id, order_id, author_role, author_name, content, timestamp_str, created_at)
      VALUES ('store-message-2', 'TEST-OTHER', 'store', 'Comercio', 'Otro', '12:01', NOW())`);
    assert.equal((await unreadExports.GET(buyer)).body.total, 1);
    const deliveryConnection = await pool.connect();
    let pendingMessage;
    try {
      await safeQuery(deliveryConnection, `SET search_path TO ${quotedSchema}`);
      await safeQuery(deliveryConnection, "BEGIN");
      await safeQuery(deliveryConnection, "UPDATE repartofacil_pedidos SET estado = 'Delivered' WHERE id = $1", ["TEST-OTHER"]);
      const insertStarted = new Promise((resolve) => { notifyChatInsert = resolve; });
      pendingMessage = chatExports.POST({
        ...chatRequest("test-driver-2", "Driver", "Mensaje concurrente"),
        json: async () => ({ id: "concurrent-message", content: "Mensaje concurrente" }),
      }, chatParams);
      await insertStarted;
      const completedEarly = await Promise.race([
        pendingMessage.then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), 500)),
      ]);
      assert.equal(completedEarly, false, "El mensaje debe esperar al bloqueo de la entrega.");
      await safeQuery(deliveryConnection, "COMMIT");
    } finally {
      await deliveryConnection.query("ROLLBACK");
      deliveryConnection.release();
      if (pendingMessage) await pendingMessage;
    }
    assert.equal((await pendingMessage).status, 404);
    assert.equal((await queryDb("SELECT COUNT(*)::integer AS count FROM repartofacil_chat_mensajes WHERE id = $1", ["concurrent-message"]))[0].count, 0);
    assert.equal((await chatExports.GET(chatRequest("test-driver-2", "Driver"), chatParams)).status, 404);
    assert.equal((await chatExports.POST(chatRequest("test-driver-2", "Driver", "Hola"), chatParams)).status, 404);
    assert.equal((await chatExports.GET(buyer, chatParams)).status, 200);
    await queryDb("UPDATE repartofacil_pedidos SET repartidor_id = $1 WHERE id = $2", ["test-driver-3", "TEST-OTHER"]);
    assert.equal((await chatExports.GET(chatRequest("test-driver-2", "Driver"), chatParams)).status, 404);

    await queryDb(`INSERT INTO repartofacil_pedidos
      (id, estado, repartidor_id, repartidor_usuario_id, driver_last_ping, custodio_estado, custodio_advertencia_at, created_at)
      VALUES
      ('CUSTODIO-FRESH', 'Assigned', 'custodio-driver', 'custodio-driver', NOW() - INTERVAL '9 minutes', 'normal', NULL, NOW()),
      ('CUSTODIO-WARN', 'Assigned', 'custodio-driver', 'custodio-driver', NOW() - INTERVAL '11 minutes', 'normal', NULL, NOW()),
      ('CUSTODIO-OLD', 'ready', 'custodio-driver', 'custodio-driver', NOW() - INTERVAL '31 minutes', 'advertencia', NOW() - INTERVAL '29 minutes', NOW()),
      ('CUSTODIO-TRANSIT', 'in transit', 'custodio-driver', 'custodio-driver', NOW() - INTERVAL '50 minutes', 'normal', NULL, NOW()),
      ('CUSTODIO-NO-PING', 'Assigned', 'custodio-driver', 'custodio-driver', NULL, 'normal', NULL, NOW()),
      ('CUSTODIO-TIMEOUT', 'pending_store', NULL, NULL, NULL, NULL, NULL, NOW() - INTERVAL '61 minutes'),
      ('CUSTODIO-CONFIRMED', 'confirmed', NULL, NULL, NULL, NULL, NULL, NOW() - INTERVAL '61 minutes')`);

    const custodioSource = fs.readFileSync(path.join(process.cwd(), "src/lib/custodio.ts"), "utf8");
    const custodioExports = {};
    vm.runInNewContext(ts.transpileModule(custodioSource, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText, {
      exports: custodioExports, process: { env: {} }, Date,
      require(name) {
        if (name === "@/lib/db") return { queryDb };
        if (name === "node:crypto") return require("node:crypto");
        throw new Error(`Dependencia inesperada: ${name}`);
      },
    });
    const firstAudit = await custodioExports.ejecutarAuditoriaCustodio();
    assert.equal(firstAudit.liberados, 0);
    assert.equal(firstAudit.advertencias, 2);
    assert.equal(firstAudit.canceladosTimeout, 1);
    const warningStates = await queryDb(`SELECT id, estado, repartidor_id, custodio_estado
      FROM repartofacil_pedidos WHERE id LIKE 'CUSTODIO-%' ORDER BY id`);
    const find = (rows, id) => rows.find((row) => row.id === id);
    assert.equal(find(warningStates, "CUSTODIO-FRESH").custodio_estado, "normal");
    assert.equal(find(warningStates, "CUSTODIO-OLD").custodio_estado, "advertencia_desconexion_30m_v1");
    assert.equal(find(warningStates, "CUSTODIO-TRANSIT").custodio_estado, "normal");
    assert.equal(find(warningStates, "CUSTODIO-NO-PING").custodio_estado, "normal");
    assert.equal(find(warningStates, "CUSTODIO-TIMEOUT").estado, "cancelled_timeout");
    assert.equal(find(warningStates, "CUSTODIO-CONFIRMED").estado, "confirmed");

    await queryDb(`UPDATE repartofacil_pedidos SET custodio_advertencia_at = NOW() - INTERVAL '21 minutes'
      WHERE id IN ('CUSTODIO-WARN', 'CUSTODIO-OLD')`);
    const concurrentAudits = await Promise.all([
      custodioExports.ejecutarAuditoriaCustodio(),
      custodioExports.ejecutarAuditoriaCustodio(),
    ]);
    assert.equal(concurrentAudits.reduce((sum, result) => sum + result.liberados, 0), 1);
    const afterRelease = await queryDb(`SELECT id, estado, repartidor_id, repartidor_usuario_id
      FROM repartofacil_pedidos WHERE id IN ('CUSTODIO-WARN', 'CUSTODIO-OLD', 'CUSTODIO-TRANSIT')`);
    assert.equal(find(afterRelease, "CUSTODIO-OLD").repartidor_id, null);
    assert.equal(find(afterRelease, "CUSTODIO-OLD").repartidor_usuario_id, null);
    assert.equal(find(afterRelease, "CUSTODIO-OLD").estado, "ready");
    assert.equal(find(afterRelease, "CUSTODIO-WARN").repartidor_id, "custodio-driver");
    assert.equal(find(afterRelease, "CUSTODIO-TRANSIT").repartidor_id, "custodio-driver");
    const releaseMessages = await queryDb(`SELECT COUNT(*)::integer AS count FROM repartofacil_chat_mensajes
      WHERE order_id = 'CUSTODIO-OLD' AND content LIKE 'El pedido volvió%'`);
    assert.equal(releaseMessages[0].count, 1);

    const routeSource = fs.readFileSync(path.join(process.cwd(), "src/app/api/orders/custodio/route.ts"), "utf8");
    const custodioRoute = {};
    vm.runInNewContext(ts.transpileModule(routeSource, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText, {
      exports: custodioRoute, console,
      require(name) {
        if (name === "next/server") return { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };
        if (name === "@/lib/db") return { queryDb };
        if (name === "@/lib/orderAuth") return { authenticateOrderUser: async (req) => ({ user: req.user }) };
        if (name === "@/lib/custodio") return { ...custodioExports, isCustodioAutomaticEnabled: () => true };
        throw new Error(`Dependencia inesperada: ${name}`);
      },
    });
    const driverRequest = (action) => ({
      user: { id: "custodio-driver", role: "Driver", displayName: "Prueba" },
      json: async () => ({ action }),
    });
    const disconnected = await custodioRoute.POST(driverRequest("driver_disconnected"));
    assert.equal(disconnected.body.action, "disconnection_recorded");
    const afterDisconnect = await queryDb(`SELECT repartidor_id, custodio_estado, driver_last_ping > NOW() - INTERVAL '1 minute' AS fresh
      FROM repartofacil_pedidos WHERE id = 'CUSTODIO-WARN'`);
    assert.equal(afterDisconnect[0].repartidor_id, "custodio-driver");
    assert.equal(afterDisconnect[0].custodio_estado, "normal");
    assert.equal(afterDisconnect[0].fresh, true);

    await queryDb(`UPDATE repartofacil_pedidos
      SET driver_last_ping = NOW() - INTERVAL '31 minutes',
          custodio_advertencia_at = NOW() - INTERVAL '21 minutes',
          custodio_estado = 'advertencia_desconexion_30m_v1'
      WHERE id = 'CUSTODIO-WARN'`);
    assert.equal((await custodioRoute.POST(driverRequest("ping"))).body.action, "ping_recorded");
    const afterPing = await queryDb(`SELECT custodio_estado, custodio_advertencia_at,
      driver_last_ping > NOW() - INTERVAL '1 minute' AS fresh
      FROM repartofacil_pedidos WHERE id = 'CUSTODIO-WARN'`);
    assert.equal(afterPing[0].custodio_estado, "normal");
    assert.equal(afterPing[0].custodio_advertencia_at, null);
    assert.equal(afterPing[0].fresh, true);
    assert.equal((await custodioExports.ejecutarAuditoriaCustodio()).liberados, 0);
  } finally {
    if (created) {
      const admin = await pool.connect();
      try {
        const objects = await safeQuery(admin, `
          SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relkind IN ('r', 'p')`, [schema]);
        const allowed = new Set(["repartofacil_pedidos", "repartofacil_chat_mensajes", "repartofacil_chat_lecturas"]);
        if (objects.rows.some((row) => !allowed.has(row.relname))) {
          throw new Error(`Se conservó el esquema de prueba ${schema} por contener tablas inesperadas.`);
        }
        await safeQuery(admin, `DROP SCHEMA ${quotedSchema} CASCADE`);
      } catch (error) {
        console.error(`No se pudo limpiar el esquema de prueba ${schema}.`);
        throw error;
      } finally {
        admin.release();
        await pool.end();
      }
    } else {
      await pool.end();
    }
  }
});
