const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

test("las conversaciones se abren y vuelven a la lista dentro de la misma ventana", async () => {
  const states = [];
  const effects = [];
  let hook = 0;
  let requests = 0;
  let focused = false;
  const orders = [
    { id: "pedido-1", clientId: "comprador", status: "Delivered", branch: "Comercio uno" },
    { id: "pedido-2", clientId: "comprador", status: "Assigned", branch: "Comercio dos" },
  ];
  const react = {
    __esModule: true, default: {},
    useState(initial) {
      const index = hook++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef(initial) {
      const index = hook++;
      if (!(index in states)) states[index] = { current: initial };
      return states[index];
    },
    useEffect(effect) { effects.push(effect); },
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const ui = new Proxy({}, { get: (_, name) => name });
  const source = fs.readFileSync("src/modulos/tienda/ui/MensajesClienteSheet.tsx", "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console, AbortController,
    requestAnimationFrame: (callback) => callback(),
    window: { addEventListener() {}, removeEventListener() {} },
    fetch: async () => {
      requests++;
      return { ok: true, json: async () => orders };
    },
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
      if (name === "lucide-react" || name === "@/components/ui/dialog" || name === "@/components/ui/button") return ui;
      if (name === "@/lib/clientAuth") return { authHeaders: () => ({ Authorization: "Bearer prueba" }) };
      if (name === "../pedidos/cachePedidosCliente") return { filterClientOrders: (data) => data };
      if (name === "../../repartidor/motor/driverService") return { getOrCreateActiveClientIdentity: () => ({ clientId: "comprador" }) };
      if (name === "../../repartidor/ui/OrderChatSheet") return { OrderChatSheet: "OrderChatSheet" };
      throw new Error(`Dependencia inesperada: ${name}`);
    },
  });
  const render = () => {
    hook = 0;
    return exports.MensajesClienteSheet({ isOpen: true, onOpenChange() {}, unread: {}, unreadError: false });
  };
  render();
  const cleanups = effects.splice(0).map((effect) => effect()).filter(Boolean);
  await new Promise((resolve) => setImmediate(resolve));
  let tree = render();
  const first = nodes(tree).find((node) => node.type === "button" && node.props.children?.[1]?.props?.children?.[0]?.props?.children === "Comercio uno");
  assert.ok(first);
  first.props.onClick({ currentTarget: { isConnected: true, focus: () => { focused = true; } } });
  tree = render();
  let chat = nodes(tree).find((node) => node.type === "OrderChatSheet");
  assert.ok(chat);
  assert.equal(chat.props.embedded, true);
  assert.equal(chat.props.activeOrder.id, "pedido-1");
  assert.equal(chat.props.backButtonLabel, "Volver a mensajes");
  assert.ok(nodes(tree).some((node) => node.props?.hidden === true));
  chat.props.onBackToOrdersHub();
  tree = render();
  assert.equal(focused, true);
  assert.equal(nodes(tree).some((node) => node.type === "OrderChatSheet"), false);
  const second = nodes(tree).find((node) => node.type === "button" && node.props.children?.[1]?.props?.children?.[0]?.props?.children === "Comercio dos");
  assert.ok(second);
  second.props.onClick({ currentTarget: { isConnected: true, focus() {} } });
  chat = nodes(render()).find((node) => node.type === "OrderChatSheet");
  assert.equal(chat.props.activeOrder.id, "pedido-2");
  assert.equal(requests, 1);
  cleanups.forEach((cleanup) => cleanup());
});
