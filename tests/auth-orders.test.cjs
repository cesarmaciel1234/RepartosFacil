const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const next = { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };

function load(file, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console, process: { env: {} }, AbortController, AbortSignal, setTimeout, clearTimeout,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Dependencia inesperada: ${name}`);
      return dependencies[name];
    },
    ...globals,
  });
  return exports;
}

function request(token, body = {}, params = "") {
  return {
    headers: new Headers(token ? { Authorization: `Bearer ${token}` } : {}),
    json: async () => body,
    nextUrl: { searchParams: new URLSearchParams(params) },
  };
}

function setup(queryDb = async () => []) {
  const users = {
    buyer: { id: "buyer-1", role: "Client", isAnonymous: false, displayName: "Comprador" },
    driver: { id: "driver-1", role: "Driver", isAnonymous: false, displayName: "Repartidor" },
    anonymous: { id: "anon-1", role: "Driver", isAnonymous: true },
  };
  const auth = load("src/lib/orderAuth.ts", { "next/server": next }, {
    fetch: async (_url, options) => {
      const token = options.headers.Authorization.slice(7);
      return users[token]
        ? { ok: true, status: 200, json: async () => users[token] }
        : { ok: false, status: 401 };
    },
  });
  const validation = load("src/lib/validateOrder.ts", {
    "@/modulos/tienda/motor/tarifaUberService": {
      calcularTarifaEnvio: () => ({ driverEarnings: 1600, distanceKm: 1, estimatedMinutes: 20 }),
    },
  });
  const catalog = {
    products: [{ id: "p1", name: "Producto", unit: "kg", companyId: "frigorifico-maciel", price: 100, stockKg: 4 }],
    empresas: [{ id: "frigorifico-maciel", empresa_id: 1, slug: "maciel", name: "Maciel", deliveryFee: 50 }],
  };
  const api = load("src/app/api/orders/route.ts", {
    "next/server": next,
    "@/lib/db": { queryDb },
    "@/lib/custodio": { ejecutarAuditoriaCustodio: async () => {}, isCustodioAutomaticEnabled: () => false },
    "@/lib/orderAuth": auth,
    "@/lib/validateOrder": validation,
    "@/app/api/cobrofacil/[...path]/route": { GET: async (_req, context) => {
      const { path } = await context.params;
      if (catalog.available === false) return { ok: false, json: async () => ({ error: "No disponible" }) };
      return { ok: true, json: async () => ({ source: "crm-libro-local (PostgreSQL Render)", ...catalog, path }) };
    } },
  });
  return { api, auth, catalog };
}

test("el acceso tolera el arranque lento y reporta errores del backend", async () => {
  let timeoutMs;
  let expire;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const api = load("src/app/api/auth/[...path]/route.ts", { "next/server": next }, {
    setTimeout: (callback, ms) => { expire = callback; timeoutMs = ms; return 1; },
    clearTimeout: () => {},
    console: { error() {} },
    fetch: async (_url, options) => {
      if (options.method === "GET") {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => reject(new Error("timeout")));
          markStarted();
        });
      }
      return { status: 401, json: async () => ({ detail: "Incorrect email or password" }) };
    },
  });
  const params = { params: Promise.resolve({ path: ["login"] }) };
  const req = { headers: new Headers(), text: async () => "{}" };
  const result = await api.POST(req, params);
  assert.equal(timeoutMs, 60_000);
  assert.equal(result.status, 401);
  const waiting = api.GET(req, params);
  await started;
  expire();
  assert.equal((await waiting).status, 503);
});

test("una sesión de comprador que no se puede guardar no se confirma", () => {
  const service = load("src/modulos/repartidor/motor/driverService.ts", {}, {
    window: {},
    localStorage: { setItem() { throw new Error("almacenamiento no disponible"); } },
    console: { warn() {} },
  });
  assert.throws(
    () => service.saveClientProfile({ id: "buyer", role: "Client" }, "token"),
    /No se pudo guardar la sesión/
  );
});

const validOrder = {
  id: "order-1", companyId: "frigorifico-maciel", deliveryType: "delivery", deliveryAddress: "Prueba",
  items: [{ id: "p1", price: 100, quantity: 2 }], subtotal: 200, deliveryFee: 50, total: 250,
};

test("pedidos rechaza sesiones ausentes, inválidas y anónimas antes de consultar la base", async () => {
  let queries = 0;
  const { api } = setup(async () => { queries++; return []; });
  for (const token of [null, "invalid", "anonymous"]) {
    for (const method of ["GET", "POST", "PATCH"]) {
      const result = await api[method](request(token, { id: "order-1", status: "Assigned" }));
      assert.ok([401, 403].includes(result.status));
    }
  }
  assert.equal(queries, 0);
});

test("roles y datos de identidad no pueden intercambiarse entre comprador y repartidor", async () => {
  let queries = 0;
  const { api } = setup(async () => { queries++; return []; });
  assert.equal((await api.POST(request("driver"))).status, 403);
  assert.equal((await api.POST(request("buyer", { clientId: "other" }))).status, 403);
  assert.equal((await api.PATCH(request("buyer", { id: "order", status: "Assigned" }))).status, 403);
  assert.equal((await api.PATCH(request("driver", { id: "order", status: "Assigned", driverId: "other" }))).status, 403);
  assert.equal((await api.PATCH(request("driver", { id: "order", status: "cancelled_by_client" }))).status, 403);
  assert.equal((await api.PATCH(request("driver", { id: "order", status: "ready" }))).status, 403);
  assert.equal(queries, 0);
});

test("un pedido nuevo pertenece a la sesión y no sobrescribe un ID existente", async () => {
  let insert;
  const { api } = setup(async (sql, values) => {
    if (sql.includes("INSERT INTO repartofacil_pedidos")) {
      insert = { sql, values };
      return [];
    }
    return [];
  });
  const result = await api.POST(request("buyer", {
    ...validOrder,
    status: "Delivered", driverId: "driver-1", ticketId: "ticket", empresaId: 2, driverEarnings: 99999,
  }));
  assert.equal(result.status, 409);
  assert.equal(insert.values[1], "buyer-1");
  assert.equal(insert.values[2], "buyer-1");
  assert.equal(insert.values[8], "pending_store");
  assert.equal(insert.values[9], 1);
  assert.equal(insert.values[11], null);
  assert.equal(insert.values[16], 250);
  assert.equal(insert.values[17], 1600);
  assert.equal(insert.values[22], null);
  assert.match(insert.sql, /ON CONFLICT \(id\) DO NOTHING/);
});

test("el servidor rechaza importes, stock o comercios manipulados", async () => {
  let inserted = 0;
  const { api, catalog } = setup(async () => { inserted++; return []; });
  for (const changes of [
    { total: 1 },
    { deliveryFee: 0 },
    { items: [{ id: "p1", price: 1, quantity: 2 }] },
    { items: [{ id: "p1", price: 100, quantity: 5 }] },
    { items: [{ id: "p1", price: 100, quantity: 2 }, { id: "p1", price: 100, quantity: 2 }] },
    { companyId: "otro-comercio" },
  ]) {
    assert.equal((await api.POST(request("buyer", { ...validOrder, ...changes }))).status, 409);
  }
  catalog.products[0].stockKg = 0;
  assert.equal((await api.POST(request("buyer", validOrder))).status, 409);
  catalog.available = false;
  assert.equal((await api.POST(request("buyer", validOrder))).status, 503);
  assert.equal(inserted, 0);
});

test("el acceso alternativo antiguo a pedidos queda bloqueado", async () => {
  const legacy = load("src/app/api/db/[...path]/route.ts", { "next/server": next });
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
    const result = await legacy[method](request(), { params: Promise.resolve({ path: ["orders", "order-1"] }) });
    assert.equal(result.status, 410);
  }
});

test("la mensajería rechaza a quien no pertenece al pedido y usa la identidad del servidor", async () => {
  const { auth } = setup();
  let inserted;
  const chat = load("src/app/api/chat/[orderId]/route.ts", {
    "next/server": next,
    "@/lib/orderAuth": auth,
    "@/lib/db": { queryDb: async (sql, values) => {
      if (sql.includes("LEFT JOIN")) return values[1] === "buyer-1" ? [{ id: null }] : [];
      if (sql.includes("INSERT INTO")) {
        if (values[6] !== "buyer-1") return [];
        inserted = values;
        return [{ id: values[0], order_id: values[1], author_role: values[2], author_name: values[3], content: values[4], timestamp_str: values[5] }];
      }
      return [];
    } },
  });
  const params = { params: Promise.resolve({ orderId: "order-1" }) };
  assert.equal((await chat.GET(request("driver"), params)).status, 404);
  assert.equal((await chat.POST(request("driver", { content: "Prueba" }), params)).status, 404);
  assert.equal((await chat.GET(request("buyer"), params)).body.messages.length, 0);
  const sent = await chat.POST(request("buyer", {
    id: "message-1", authorRole: "driver", authorName: "Suplantado", content: "Prueba",
  }), params);
  assert.equal(sent.status, 201);
  assert.equal(inserted[2], "client");
  assert.equal(inserted[3], "Comprador");
  assert.equal(inserted[6], "buyer-1");
});

test("los mensajes nuevos y la lectura pertenecen al comprador autenticado", async () => {
  const { auth } = setup();
  const queries = [];
  const queryDb = async (sql, values) => {
    queries.push({ sql, values });
    if (sql.includes("COUNT(*)")) return [{ order_id: "order-1", unread: 2 }];
    return [{ id: "m1", order_id: "order-1", author_role: "store", author_name: "Comercio", content: "Hola", timestamp_str: "12:00" }];
  };
  const unread = load("src/app/api/chat/unread/route.ts", {
    "next/server": next, "@/lib/orderAuth": auth, "@/lib/db": { queryDb },
  });
  assert.equal((await unread.GET(request("driver"))).status, 403);
  const result = await unread.GET(request("buyer"));
  assert.equal(result.body.total, 2);
  assert.equal(queries[0].values[0], "buyer-1");
  assert.match(queries[0].sql, /author_role.*<> 'client'/);
  const chat = load("src/app/api/chat/[orderId]/route.ts", {
    "next/server": next, "@/lib/orderAuth": auth, "@/lib/db": { queryDb },
  });
  const params = { params: Promise.resolve({ orderId: "order-1" }) };
  const read = await chat.GET(request("buyer", {}, "read=1"), params);
  assert.equal(read.body.messages[0].authorRole, "company");
  assert.match(queries[1].sql, /INSERT INTO repartofacil_chat_lecturas/);
  assert.equal(queries[1].values[1], "buyer-1");
  await chat.GET(request("driver", {}, "read=1"), params);
  assert.doesNotMatch(queries[2].sql, /INSERT INTO repartofacil_chat_lecturas/);
  assert.match(queries[2].sql, /p\.repartidor_id = \$2.*assigned.*ready/);
});

test("las conversaciones anteriores usan un cursor propio del comprador", async () => {
  let executed;
  const { api } = setup(async (sql, values) => { executed = { sql, values }; return []; });
  assert.equal((await api.GET(request("driver", {}, "view=client_conversations&before=otro"))).status, 400);
  assert.equal((await api.GET(request("buyer", {}, "before=otro"))).status, 400);
  assert.equal((await api.GET(request("buyer", {}, "view=client_conversations&before=order-50"))).status, 200);
  assert.equal(executed.values[0], "buyer-1");
  assert.equal(executed.values[1], "order-50");
  assert.match(executed.sql, /WHERE previous\.id = \$2 AND \(previous\.cliente_id = \$1 OR previous\.cliente_usuario_id = \$1\)/);
  assert.match(executed.sql, /MAX\(m\.created_at\)/);
});

test("lecturas y separación del repartidor en PostgreSQL aislado", {
  skip: !process.env.RF_PGLITE_MODULE,
}, async () => {
  const { PGlite } = require(process.env.RF_PGLITE_MODULE);
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE repartofacil_pedidos (
        id text PRIMARY KEY, cliente_id text, cliente_usuario_id text, repartidor_id text,
        estado text, created_at timestamptz, updated_at timestamptz, items jsonb
      );
      CREATE TABLE repartofacil_chat_mensajes (
        id text PRIMARY KEY, order_id text, author_role text, author_name text,
        content text, timestamp_str text, created_at timestamptz
      );
    `);
    await db.exec(fs.readFileSync(path.join(process.cwd(), "scripts/repartofacil-chat-lecturas.sql"), "utf8"));
    await db.exec(`
      INSERT INTO repartofacil_pedidos VALUES ('order-1', 'buyer-1', 'buyer-1', 'driver-1',
        'Assigned', '2026-01-01 10:00:00+00', NOW(), '[]');
      INSERT INTO repartofacil_chat_mensajes VALUES
        ('a', 'order-1', 'store', 'Comercio', 'Primero', '10:00', '2026-01-01 10:01:00+00'),
        ('b', 'order-1', 'client', 'Comprador', 'Respuesta', '10:00', '2026-01-01 10:01:00+00');
    `);
    const queryDb = async (sql, values) => (await db.query(sql, values)).rows;
    const { auth } = setup(queryDb);
    const deps = { "next/server": next, "@/lib/orderAuth": auth, "@/lib/db": { queryDb } };
    const unread = load("src/app/api/chat/unread/route.ts", deps);
    const chat = load("src/app/api/chat/[orderId]/route.ts", deps);
    const params = { params: Promise.resolve({ orderId: "order-1" }) };
    assert.equal((await unread.GET(request("buyer"))).body.total, 1);
    assert.equal((await chat.GET(request("driver"), params)).body.messages.length, 2);
    assert.equal((await chat.GET(request("buyer", {}, "read=1"), params)).body.messages.length, 2);
    assert.equal((await unread.GET(request("buyer"))).body.total, 0);
    await db.exec(`INSERT INTO repartofacil_chat_mensajes VALUES
      ('0', 'order-1', 'driver', 'Repartidor', 'Nuevo', '10:00', '2026-01-01 09:59:00+00')`);
    assert.equal((await unread.GET(request("buyer"))).body.total, 1);
    await db.exec("UPDATE repartofacil_pedidos SET estado = 'Delivered' WHERE id = 'order-1'");
    assert.equal((await chat.GET(request("driver"), params)).status, 404);
    assert.equal((await chat.POST(request("driver", { content: "No permitido" }), params)).status, 404);
    assert.equal((await chat.GET(request("buyer", {}, "read=1"), params)).body.messages.length, 3);
    assert.equal((await unread.GET(request("buyer"))).body.total, 0);

    await db.exec(`INSERT INTO repartofacil_pedidos
      SELECT 'other-' || g, 'buyer-1', 'buyer-1', NULL, 'Delivered',
        '2025-01-01 00:00:00+00'::timestamptz, NOW(), '[]'::jsonb
      FROM generate_series(1, 51) g`);
    const { api } = setup(queryDb);
    const first = await api.GET(request("buyer", {}, "view=client_conversations"));
    assert.equal(first.status, 200);
    assert.equal(first.body.length, 50);
    const lastId = first.body[49].id;
    const second = await api.GET(request("buyer", {}, `view=client_conversations&before=${lastId}`));
    assert.equal(second.status, 200);
    assert.equal(second.body.length, 2);
    assert.equal(new Set([...first.body, ...second.body].map((order) => order.id)).size, 52);
  } finally {
    await db.close();
  }
});

test("el proxy reenvía cambios de perfil con la sesión y no inventa éxitos", async () => {
  const requests = [];
  const proxy = load("src/app/api/db/[...path]/route.ts", { "next/server": next }, {
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith("/offline")) throw new Error("offline");
      return { status: 403, json: async () => ({ error: "No autorizado" }) };
    },
  });
  const req = { headers: new Headers({ Authorization: "Bearer buyer" }), text: async () => "{}" };
  const profile = { params: Promise.resolve({ path: ["clients", "buyer-1"] }) };
  assert.equal((await proxy.PATCH(req, profile)).status, 403);
  assert.equal(requests[0].options.headers.Authorization, "Bearer buyer");
  assert.equal(requests[0].options.method, "PATCH");
  assert.equal((await proxy.POST(req, { params: Promise.resolve({ path: ["offline"] }) })).status, 503);
  assert.equal(requests.length, 2);
});

test("custodio no permite operar con el rol o repartidor de otra cuenta", async () => {
  const { auth } = setup();
  let queries = 0;
  const custodio = load("src/app/api/orders/custodio/route.ts", {
    "next/server": next,
    "@/lib/orderAuth": auth,
    "@/lib/db": { queryDb: async () => { queries++; return []; } },
    "@/lib/custodio": { ejecutarAuditoriaCustodio: async () => { throw new Error("No debe auditar"); }, isCustodioAutomaticEnabled: () => false },
  });
  assert.equal((await custodio.POST(request(null, { action: "ping" }))).status, 401);
  assert.equal((await custodio.POST(request("buyer", { action: "ping" }))).status, 403);
  assert.equal((await custodio.POST(request("driver", { action: "ping", driverId: "other" }))).status, 403);
  assert.equal((await custodio.POST(request("driver", { action: "force_release", orderId: "order-1" }))).status, 403);
  assert.equal((await custodio.GET(request("driver"))).status, 503);
  assert.equal((await custodio.POST(request("driver", { action: "driver_disconnected" }))).status, 503);
  assert.equal((await custodio.POST(request("buyer", { action: "retry_order", orderId: "other-order" }))).status, 404);
  assert.equal(queries, 1);
});

test("consultar pedidos no ejecuta la auditoría mientras está pausada", async () => {
  const { auth } = setup();
  let audits = 0;
  const api = load("src/app/api/orders/route.ts", {
    "next/server": next,
    "@/lib/orderAuth": auth,
    "@/lib/db": { queryDb: async () => [] },
    "@/lib/custodio": { isCustodioAutomaticEnabled: () => false, ejecutarAuditoriaCustodio: async () => { audits++; } },
    "@/lib/validateOrder": {},
    "@/app/api/cobrofacil/[...path]/route": {},
  });
  assert.equal((await api.GET(request("driver"))).status, 200);
  assert.equal(audits, 0);
});
