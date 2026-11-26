const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadModule(relativePath, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    console,
    process: { env: {} },
    ...globals,
  });
  return exports;
}

function storage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: (index) => Array.from(values.keys())[index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

const profile = { id: "driver-1", uid: "user-1", firstName: "Prueba", role: "Driver" };
const order = {
  id: "ORDER-TEST",
  status: "Assigned",
  driverId: "driver-1",
  clientName: "Cliente",
  deliveryAddress: "Prueba",
  items: [],
  total: 1000,
  driverEarnings: 200,
  paymentMethod: "cash",
  createdAt: "2026-01-01T00:00:00Z",
};

function setupQueue(fetch) {
  const localStorage = storage();
  const window = { dispatchEvent() {} };
  class Event { constructor(type) { this.type = type; } }
  class CustomEvent extends Event {}
  const globals = { localStorage, window, Event, CustomEvent };
  const wallet = loadModule("src/modulos/repartidor/motor/walletService.ts", {}, globals);
  const queue = loadModule("src/modulos/repartidor/motor/driverPendingActions.ts", {
    "./driverService": { ORDERS_STORAGE_KEY: "rf_orders_history", loadDriverProfile: () => profile },
    "./walletService": wallet,
    "@/lib/clientAuth": { authHeaders: () => ({ Authorization: "Bearer test-token" }) },
  }, {
    ...globals,
    navigator: { locks: { request: async (_name, _options, callback) => callback({}) } },
    fetch,
  });
  localStorage.setItem("rf_orders_history", JSON.stringify([order]));
  return { localStorage, queue, wallet };
}

test("una entrega sin conexión queda pendiente y se acredita solo una vez al reintentar", async () => {
  let connected = false;
  let protocol;
  const { localStorage, queue, wallet } = setupQueue(async (_url, options) => {
    protocol = JSON.parse(options.body).driverProtocol;
    if (!connected) throw new Error("offline");
    return { ok: true, status: 200, json: async () => ({
      ...order, status: "Delivered", driverSettlement: { earning: 200, cashCollected: 1000 },
    }) };
  });
  queue.queueDriverAction("deliver", order, profile);
  assert.equal((await queue.syncPendingDriverActions(profile.id)).length, 0);
  assert.equal(queue.loadPendingDriverActions(profile.id).length, 1);
  assert.equal(wallet.loadDriverWallet().balance, 0);

  connected = true;
  const results = await queue.syncPendingDriverActions(profile.id);
  assert.equal(protocol, 2);
  assert.equal(results[0].status, "confirmed");
  assert.equal(queue.loadPendingDriverActions(profile.id).length, 0);
  assert.equal(wallet.loadDriverWallet().balance, 200);
  assert.equal(wallet.loadDriverWallet().cashInHand, 1000);
  assert.equal(JSON.parse(localStorage.getItem("rf_orders_history"))[0].status, "Delivered");

  queue.queueDriverAction("deliver", order, profile);
  await queue.syncPendingDriverActions(profile.id);
  assert.equal(wallet.loadDriverWallet().balance, 200);
  assert.equal(wallet.loadDriverWallet().transactions.length, 1);
});

test("una asignación rechazada no queda confirmada ni acredita dinero", async () => {
  const otherOrder = { ...order, driverId: "driver-2" };
  const { localStorage, queue, wallet } = setupQueue(async () => ({
    ok: false,
    status: 409,
    json: async () => ({ error: "El pedido ya no está disponible.", order: otherOrder }),
  }));
  queue.queueDriverAction("assign", order, profile);
  const results = await queue.syncPendingDriverActions(profile.id);
  assert.equal(results[0].status, "rejected");
  assert.equal(queue.loadPendingDriverActions(profile.id).length, 0);
  assert.equal(JSON.parse(localStorage.getItem("rf_orders_history"))[0].driverId, "driver-2");
  assert.equal(wallet.loadDriverWallet().balance, 0);
});

test("un fallo temporal del servidor conserva la acción pendiente", async () => {
  const { queue } = setupQueue(async () => ({ ok: false, status: 503 }));
  queue.queueDriverAction("assign", order, profile);
  assert.equal((await queue.syncPendingDriverActions(profile.id)).length, 0);
  assert.equal(queue.loadPendingDriverActions(profile.id).length, 1);
});

test("una entrega confirmada sin liquidación válida no se acredita ni se borra de la cola", async () => {
  const { queue, wallet } = setupQueue(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ...order, status: "Delivered", driverSettlement: { earning: null, cashCollected: 1000 } }),
  }));
  queue.queueDriverAction("deliver", order, profile);
  await assert.rejects(queue.syncPendingDriverActions(profile.id), /ganancia válida/);
  assert.equal(queue.loadPendingDriverActions(profile.id).length, 1);
  assert.equal(wallet.loadDriverWallet().balance, 0);
});

test("la API admite una sola asignación y el reintento del mismo repartidor", async () => {
  const row = {
    id: "ORDER-TEST", estado: "ready", repartidor_id: null,
    cliente_nombre: "Cliente", items: [], total: 1000,
    ganancia_repartidor: 200, metodo_pago: "cash",
  };
  let messages = 0;
  const queryDb = async (sql, values) => {
    if (sql.startsWith("UPDATE repartofacil_pedidos SET")) {
      const guarded = sql.includes("(repartidor_id IS NULL OR repartidor_id = '')");
      if (guarded && row.repartidor_id) return [];
      row.estado = values[0];
      row.repartidor_id = values[1];
      return [{ ...row }];
    }
    if (sql.startsWith("SELECT * FROM repartofacil_pedidos")) return [{ ...row }];
    if (sql.includes("INSERT INTO repartofacil_chat_mensajes")) { messages++; return []; }
    throw new Error(`Unexpected query: ${sql}`);
  };
  const api = loadModule("src/app/api/orders/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    "@/lib/db": { queryDb },
    "@/lib/custodio": { ejecutarAuditoriaCustodio: async () => {}, isCustodioAutomaticEnabled: () => false },
    "@/lib/validateOrder": {},
    "@/app/api/cobrofacil/[...path]/route": {},
    "@/lib/orderAuth": { authenticateOrderUser: async (req) => {
      const { driverId } = await req.json();
      return driverId ? { user: { id: driverId, role: "Driver", displayName: "Prueba" } }
        : { response: { status: 401 } };
    } },
  });
  const request = (driverId) => ({ json: async () => ({ id: row.id, status: "Assigned", driverId }) });
  const [first, second] = await Promise.all([api.PATCH(request("driver-1")), api.PATCH(request("driver-2"))]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 409);
  assert.equal(row.repartidor_id, "driver-1");
  assert.equal((await api.PATCH(request("driver-1"))).status, 200);
  assert.equal(messages, 1);
  const missingDriver = await api.PATCH({ json: async () => ({ id: row.id, status: "Delivered" }) });
  assert.equal(missingDriver.status, 401);
});

test("la API rechaza la entrega de otro repartidor y acepta un reintento sin duplicar eventos", async () => {
  const row = {
    id: "ORDER-TEST", estado: "Assigned", repartidor_id: "driver-1",
    cliente_nombre: "Cliente", items: [], total: 1000,
    ganancia_repartidor: 0, metodo_pago: "cash",
  };
  let messages = 0;
  const queryDb = async (sql, values) => {
    if (sql.startsWith("UPDATE repartofacil_pedidos SET")) {
      const guarded = sql.includes("AND repartidor_id =");
      const requestedDriver = values[values.length - 1];
      if (guarded && (row.repartidor_id !== requestedDriver || row.estado === "Delivered")) return [];
      row.estado = "Delivered";
      return [{ ...row }];
    }
    if (sql.startsWith("SELECT * FROM repartofacil_pedidos")) return [{ ...row }];
    if (sql.includes("INSERT INTO repartofacil_chat_mensajes")) { messages++; return []; }
    throw new Error(`Unexpected query: ${sql}`);
  };
  const api = loadModule("src/app/api/orders/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    "@/lib/db": { queryDb },
    "@/lib/custodio": { ejecutarAuditoriaCustodio: async () => {}, isCustodioAutomaticEnabled: () => false },
    "@/lib/validateOrder": {},
    "@/app/api/cobrofacil/[...path]/route": {},
    "@/lib/orderAuth": { authenticateOrderUser: async (req) => {
      const { driverId } = await req.json();
      return { user: { id: driverId, role: "Driver", displayName: "Prueba" } };
    } },
  });
  const request = (driverId) => ({ json: async () => ({ id: row.id, status: "Delivered", driverId }) });
  assert.equal((await api.PATCH(request("driver-2"))).status, 409);
  const delivered = await api.PATCH(request("driver-1"));
  assert.equal(delivered.status, 200);
  assert.equal(delivered.body.driverSettlement.earning, 0);
  assert.equal((await api.PATCH(request("driver-1"))).status, 200);
  assert.equal(messages, 1);
});
