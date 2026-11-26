const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, dependencies, globals) {
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console, AbortController, ...globals,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Dependencia inesperada: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

test("la bandeja del repartidor solo muestra chats autorizados y ordena por fecha real", async () => {
  const responses = {
    "pedido-1": { messages: [{ authorRole: "client", authorName: "Cliente", content: "Hola", timestamp: "10:00", createdAt: "2026-01-02T10:00:00Z" }] },
    "pedido-2": { messages: [{ authorRole: "driver", authorName: "Repartidor", content: "Voy", timestamp: "09:00", createdAt: "2026-01-03T09:00:00Z" }] },
  };
  const api = load("src/modulos/repartidor/motor/useDriverChatSummaries.ts", {
    react: {}, "@/lib/clientAuth": {},
  }, {
    fetch: async (url, options) => {
      assert.equal(options.headers.Authorization, "Bearer driver");
      const id = decodeURIComponent(url.split("/").pop());
      if (id === "entregado") return { status: 404 };
      if (id === "fallo") return { status: 503, ok: false };
      return { status: 200, ok: true, json: async () => ({ success: true, ...responses[id] }) };
    },
  });
  const orders = ["pedido-1", "entregado", "pedido-2"].map((id) => ({ id }));
  const summaries = await api.loadDriverChatSummaries(orders, "Bearer driver", new AbortController().signal);
  assert.deepEqual(Array.from(summaries, (summary) => summary.order.id), ["pedido-2", "pedido-1"]);
  assert.equal(summaries[0].lastSender, "Tú");
  await assert.rejects(api.loadDriverChatSummaries([{ id: "fallo" }], "Bearer driver", new AbortController().signal),
    /No se pudieron actualizar/);
});

test("una sesión nueva no recibe resúmenes pendientes de otra y no cancela consultas lentas", async () => {
  const states = [];
  const effects = [];
  const listeners = new Map();
  const requests = [];
  let interval;
  let index = 0;
  let authorization = "Bearer first";
  const api = load("src/modulos/repartidor/motor/useDriverChatSummaries.ts", {
    react: {
      useState(initial) {
        const current = index++;
        states[current] = initial;
        return [initial, (value) => { states[current] = value; }];
      },
      useEffect(effect) { effects.push(effect); },
    },
    "@/lib/clientAuth": { authHeaders: () => ({ Authorization: authorization }) },
  }, {
    window: {
      setInterval(callback) { interval = callback; return 1; },
      clearInterval() {},
      addEventListener(name, callback) { listeners.set(name, callback); },
      removeEventListener() {},
    },
    fetch: (_url, options) => new Promise((resolve) => requests.push({ resolve, signal: options.signal })),
  });
  api.useDriverChatSummaries(true, [{ id: "pedido-1" }]);
  const cleanup = effects[0]();
  interval();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].signal.aborted, false);
  authorization = "Bearer second";
  listeners.get("repartofacil-driver-auth")();
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(requests.length, 2);
  requests[1].resolve({ status: 404 });
  requests[0].resolve({ status: 200, ok: true, json: async () => ({
    success: true, messages: [{ authorRole: "client", content: "Privado", timestamp: "10:00" }],
  }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(states[0].length, 0);
  cleanup();
});

test("el chat del repartidor no lee ni guarda caché compartida y se cierra al cambiar de sesión", async () => {
  const states = [];
  const effects = [];
  const listeners = new Map();
  let index = 0;
  let authorization = "Bearer first";
  let resolveFetch;
  let closed = false;
  const react = {
    __esModule: true, default: {},
    useState(initial) {
      const current = index++;
      states[current] = initial;
      return [initial, (value) => { states[current] = typeof value === "function" ? value(states[current]) : value; }];
    },
    useRef(initial) { index++; return { current: initial }; },
    useEffect(effect) { effects.push(effect); },
  };
  const stub = new Proxy({}, { get: (_, name) => name });
  const component = load("src/modulos/repartidor/ui/OrderChatSheet.tsx", {
    react,
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" },
    "@/components/ui/sheet": stub, "@/components/ui/button": stub, "@/components/ui/input": stub,
    "@/components/ui/badge": stub, "lucide-react": stub,
    "../motor/driverService": { loadDriverProfile: () => ({}), loadClientProfile: () => null },
    "@/components/ModalTicketDigital": stub, "./OrderChatMessageList": stub,
    "@/lib/clientAuth": { authHeaders: () => ({ Authorization: authorization }) },
  }, {
    localStorage: {
      getItem() { throw new Error("No debe leer caché del repartidor"); },
      setItem() { throw new Error("No debe guardar caché del repartidor"); },
    },
    document: { visibilityState: "visible" },
    window: {
      addEventListener(name, callback) { listeners.set(name, callback); },
      removeEventListener() {},
    },
    setInterval: () => 1,
    clearInterval() {},
    fetch: () => new Promise((resolve) => { resolveFetch = resolve; }),
  });
  component.OrderChatSheet({
    isOpen: true, onOpenChange: (open) => { closed = !open; },
    activeOrder: { id: "pedido-1" }, viewerRole: "driver",
  });
  const cleanup = effects[0]();
  authorization = "Bearer second";
  listeners.get("repartofacil-driver-auth")();
  resolveFetch({ ok: true, json: async () => ({ success: true, messages: [{ content: "Privado" }] }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(closed, true);
  assert.equal(states[0].length, 0);
  cleanup();
});
