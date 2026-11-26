const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync("src/modulos/tienda/pantallas/HistorialPedidosTienda.tsx", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const ui = new Proxy({}, { get: (_, name) => name });
const jsx = (type, props) => ({ type, props: props || {} });
const componentExports = {};
vm.runInNewContext(compiled, {
  exports: componentExports,
  require(name) {
    if (name === "react") return { __esModule: true, default: {}, useState: (value) => [value, () => {}], useMemo: (fn) => fn(), useCallback: (fn) => fn };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
    if (name === "lucide-react" || name === "@/components/ui/button" || name === "@/components/ModalTicketDigital") return ui;
    if (name === "../ui/ResenaPedidoDialog") return ui;
    throw new Error(`Dependencia inesperada: ${name}`);
  },
});

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

function text(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (typeof tree !== "object") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join("");
  return text(tree.props?.children);
}

test("Pedidos muestra la sección en curso aun sin pedidos", () => {
  const tree = componentExports.HistorialPedidosTienda({ orders: [] });
  const section = nodes(tree).find((node) => node.props?.["aria-label"] === "Pedidos en curso");
  assert.ok(section);
  assert.match(text(section), /Pedidos en curso \(0\)/);
  assert.match(text(section), /No tenés pedidos en curso/);
  assert.match(text(tree), /Historial/);
});

test("Pedidos separa los activos del historial y abre el pedido seleccionado", () => {
  const active = { id: "pedido-activo", status: "confirmed", branch: "Comercio" };
  const delivered = { id: "pedido-entregado", status: "delivered" };
  let selected;
  const tree = componentExports.HistorialPedidosTienda({
    orders: [active, delivered],
    onSelectActiveOrder: (order) => { selected = order; },
  });
  const section = nodes(tree).find((node) => node.props?.["aria-label"] === "Pedidos en curso");
  assert.match(text(section), /Pedidos en curso \(1\)/);
  assert.match(text(section), /Aceptado por el comercio/);
  assert.doesNotMatch(text(section), /pedido-entregado/);
  nodes(section).find((node) => node.type === "button").props.onClick();
  assert.equal(selected, active);
  assert.match(text(tree), /pedido-entregado/);
});

test("solo los pedidos entregados ofrecen calificar al comercio", () => {
  const tree = componentExports.HistorialPedidosTienda({
    orders: [
      { id: "entregado", status: "Delivered" },
      { id: "cancelado", status: "cancelled" },
      { id: "activo", status: "Assigned" },
    ],
  });
  const cards = nodes(tree).filter((node) => node.type === "article");
  assert.equal(cards.length, 2);
  assert.match(text(cards[0]), /Calificar comercio/);
  assert.doesNotMatch(text(cards[1]), /Calificar comercio/);
});
