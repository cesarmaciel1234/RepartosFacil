const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function setup() {
  const values = new Map();
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  const load = (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const exports = {};
    vm.runInNewContext(compiled, { exports, localStorage, console });
    return exports;
  };
  return {
    localStorage,
    catalog: load("src/modulos/tienda/catalogo/cacheCatalogo.ts"),
    orders: load("src/modulos/tienda/pedidos/cachePedidosCliente.ts"),
    availability: load("src/modulos/tienda/motor/productoDisponibilidad.ts"),
  };
}

const company = {
  id: "store-1", name: "Comercio", category: "Almacén", categorySlug: "minimercados",
  address: "", phone: "", isOpen: true, badges: [], rating: 0, ratingCount: 0,
  deliveryTimeMin: 20, deliveryTimeMax: 40, deliveryFee: 100,
};
const product = {
  id: "product-1", companyId: "store-1", name: "Producto", category: "Almacén",
  unit: "un", description: "", price: 250, stockKg: 4, priceSource: "tpv",
};

test("guarda comercios y productos por separado y conserva el precio sin habilitar la compra offline", () => {
  const { catalog, availability } = setup();
  catalog.saveCompaniesCache([company]);
  catalog.saveProductsCache([product]);
  assert.equal(catalog.readCompaniesCache().data[0].name, "Comercio");
  const cached = catalog.asCachedProducts(catalog.readProductsCache().data)[0];
  assert.equal(cached.price, 250);
  assert.equal(cached.catalogCached, true);
  assert.equal(availability.isProductPurchasable(cached), false);
  assert.equal(availability.isProductPurchasable(product), true);
  assert.equal(typeof catalog.readProductsCache().savedAt, "string");
});

test("una respuesta vacía reemplaza la copia anterior y una copia dañada no se presenta como válida", () => {
  const { catalog, localStorage } = setup();
  catalog.saveProductsCache([product]);
  catalog.saveProductsCache([]);
  assert.equal(catalog.readProductsCache().data.length, 0);
  localStorage.setItem("rf_catalog_companies_v1", JSON.stringify({ savedAt: "invalid", data: [company] }));
  assert.equal(catalog.readCompaniesCache(), null);
});

test("el historial guardado queda separado por comprador y rechaza pedidos ajenos", () => {
  const { orders } = setup();
  const order = { id: "order-1", clientId: "client-1", status: "Assigned" };
  orders.saveClientOrdersCache("client-1", [order]);
  assert.equal(orders.readClientOrdersCache("client-1").orders[0].status, "Assigned");
  assert.equal(orders.readClientOrdersCache("client-2"), null);
  assert.throws(() => orders.saveClientOrdersCache("client-2", [order]), /no corresponden/);
  assert.equal(orders.filterClientOrders([order], "client-2").length, 0);
});

test("el catálogo restaura datos sin conexión y los actualiza al reconectar", async () => {
  const { catalog } = setup();
  const state = [];
  const effects = [];
  const listeners = {};
  const navigator = { onLine: true };
  let cursor = 0;
  let mounted = false;
  let currentPrice = 250;
  let currentCompany = company;
  let interval;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (next) => {
        state[index] = typeof next === "function" ? next(state[index]) : next;
      }];
    },
    useEffect(effect) { if (!mounted) effects.push(effect); },
    useCallback(callback) { return callback; },
    useMemo(callback) { return callback(); },
  };
  const fakeWindow = {
    setTimeout, clearTimeout,
    setInterval: (callback, delay) => { assert.equal(delay, 60000); interval = callback; return 1; },
    clearInterval() {},
    addEventListener: (name, fn) => { listeners[name] = fn; },
    removeEventListener() {},
  };
  const fakeDocument = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
  const fetch = async (url) => {
    if (!navigator.onLine) throw new Error("offline");
    const body = url.endsWith("/companies")
      ? { empresas: [currentCompany] }
      : { products: [{ ...product, price: currentPrice }], warnings: [] };
    return { ok: true, json: async () => body };
  };
  const source = fs.readFileSync(path.join(process.cwd(), "src/modulos/tienda/catalogo/hooks/useCatalogoTienda.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console, navigator, fetch, window: fakeWindow, document: fakeDocument, AbortController,
    require: (name) => {
      if (name === "react") return react;
      if (name === "../cacheCatalogo") return catalog;
      throw new Error(`Dependencia inesperada: ${name}`);
    },
  });
  const render = () => {
    cursor = 0;
    return exports.useCatalogoTienda({ selectedCompany: company, selectedCategory: "todos", searchQuery: "" });
  };
  render();
  let cleanup = effects[0]();
  mounted = true;
  await new Promise(setImmediate);
  assert.equal(render().productsStatus, "ready");
  assert.equal(render().filteredProducts[0].price, 250);
  navigator.onLine = false;
  listeners.offline();
  assert.equal(render().productsStatus, "error");
  assert.equal(render().filteredProducts[0].catalogCached, true);
  assert.equal(render().filteredProducts[0].priceSource, undefined);
  assert.equal(catalog.readProductsCache().data[0].price, 250);
  cleanup();
  state.length = 0;
  effects.length = 0;
  mounted = false;
  render();
  cleanup = effects[0]();
  mounted = true;
  await new Promise(setImmediate);
  assert.equal(render().companies[0].name, "Comercio");
  assert.equal(render().filteredProducts[0].price, 250);
  assert.equal(render().filteredProducts[0].catalogCached, true);
  currentPrice = 310;
  navigator.onLine = true;
  listeners.online();
  await new Promise(setImmediate);
  assert.equal(render().productsStatus, "ready");
  assert.equal(render().filteredProducts[0].price, 310);
  assert.equal(catalog.readProductsCache().data[0].price, 310);
  currentCompany = { ...company, address: "Nueva dirección", phone: "5493411234567" };
  interval();
  await new Promise(setImmediate);
  assert.equal(render().companies[0].address, "Nueva dirección");
  assert.equal(render().companies[0].phone, "5493411234567");
  cleanup();
});
