const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function compile(file, dependencies, globals = {}) {
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console, window: {}, ...globals,
    require(name) {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Dependencia inesperada: ${name}`);
    },
  });
  return exports;
}

function componentHarness(file, dependencies, globals = {}) {
  const states = [];
  const effects = [];
  let cursor = 0;
  const react = {
    __esModule: true,
    default: {},
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (next) => {
        states[index] = typeof next === "function" ? next(states[index]) : next;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = { current: initial };
      return states[index];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!states[index] || deps.some((value, i) => value !== states[index][i])) {
        states[index] = deps;
        effects.push(effect);
      }
    },
    useMemo(callback) { cursor++; return callback(); },
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const component = compile(file, {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    ...dependencies,
  }, globals);
  return {
    component,
    render(name, props) {
      cursor = 0;
      const tree = component[name](props);
      while (effects.length) effects.shift()();
      return tree;
    },
  };
}

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

const uiComponents = new Proxy({}, { get: (_, name) => name });
const icons = new Proxy({}, { get: (_, name) => name });

test("el acceso de repartidor solo aparece sin sesión activa de comprador", () => {
  const harness = componentHarness("src/modulos/tienda/pantallas/PerfilCliente.tsx", {
    "lucide-react": icons,
    "@/components/AppVersion": { AppVersion: "AppVersion" },
  });
  let switched = false;
  const props = {
    clientProfile: null, isClientAuthenticated: false, deliveryAddress: "",
    onSwitchToDriver: () => { switched = true; }, onLogin() {}, onLogout() {}, onEditAddress() {},
  };
  const driverButton = () => nodes(harness.render("PerfilCliente", props))
    .find((node) => node.type === "button" && node.props.onClick === props.onSwitchToDriver);
  assert.ok(driverButton());
  driverButton().props.onClick();
  assert.equal(switched, true);
  props.clientProfile = { id: "cliente-1", displayName: "Ana" };
  assert.ok(driverButton(), "un perfil guardado sin sesión no impide elegir repartidor");
  props.isClientAuthenticated = true;
  assert.equal(driverButton(), undefined);
  props.clientProfile = null;
  props.isClientAuthenticated = false;
  assert.ok(driverButton(), "la opción vuelve a aparecer al cerrar sesión");
});

test("checkout oculta datos registrados, pide solo lo que falta y conserva la dirección editable", async () => {
  let profile = { id: "cliente-1" };
  let saved = { customerName: "Ana", customerPhone: "", deliveryAddress: "Calle 123" };
  let submitted;
  const harness = componentHarness("src/modulos/tienda/ui/ModalCheckout.tsx", {
    "../motor/pedidoService": { loadSavedCustomer: () => saved, buildWhatsAppLink: () => "" },
    "../motor/tarifaUberService": { calcularTarifaEnvio: () => ({ totalDeliveryFee: 100 }) },
    "@/modulos/repartidor/motor/driverService": { loadClientProfile: () => profile },
    "@/components/ui/dialog": uiComponents, "@/components/ui/button": uiComponents,
    "@/components/ui/input": uiComponents, "@/components/ui/textarea": uiComponents,
    "@/components/ui/badge": uiComponents, "lucide-react": icons,
  });
  const props = {
    isOpen: true, cartTotal: 1000, isSubmitting: false, orderConfirmed: null,
    onConfirmOrder: async (form, id) => { submitted = { ...form, id }; },
  };
  const render = () => harness.render("ModalCheckout", props);
  render();
  let tree = render();
  let inputs = nodes(tree).filter((node) => node.type === "Input");
  assert.equal(inputs.some((input) => input.props.autoComplete === "name"), false);
  assert.equal(inputs.some((input) => input.props.autoComplete === "tel"), true);
  inputs.find((input) => input.props.autoComplete === "tel").props.onChange({ target: { value: "3411234567" } });
  inputs.find((input) => input.props.autoComplete === "street-address").props.onChange({ target: { value: "Otra calle 42" } });
  tree = render();
  inputs = nodes(tree).filter((node) => node.type === "Input");
  assert.equal(inputs.find((input) => input.props.autoComplete === "tel").props.value, "3411234567");
  await nodes(tree).find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(submitted.customerName, "Ana");
  assert.equal(submitted.customerPhone, "3411234567");
  assert.equal(submitted.deliveryAddress, "Otra calle 42");
  assert.equal(submitted.id, "cliente-1");

  profile = { id: "cliente-2" };
  submitted = undefined;
  await nodes(render()).find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(submitted, undefined);
  assert.ok(nodes(render()).some((node) => node.props?.role === "alert"));
  props.isOpen = false;
  render();
  saved = { customerName: "", customerPhone: "999", deliveryAddress: "Nueva 123" };
  props.isOpen = true;
  render();
  inputs = nodes(render()).filter((node) => node.type === "Input");
  assert.equal(inputs.some((input) => input.props.autoComplete === "name"), true);
  assert.equal(inputs.some((input) => input.props.autoComplete === "tel"), false);
  assert.equal(inputs.find((input) => input.props.autoComplete === "street-address").props.value, "Nueva 123");

  props.isOpen = false;
  render();
  saved = { customerName: "Luis", customerPhone: "999", deliveryAddress: "Nueva 123" };
  props.isOpen = true;
  render();
  inputs = nodes(render()).filter((node) => node.type === "Input");
  assert.equal(inputs.some((input) => input.props.autoComplete === "name"), false);
  assert.equal(inputs.some((input) => input.props.autoComplete === "tel"), false);
  assert.equal(inputs.some((input) => input.props.autoComplete === "street-address"), true);
});

test("guarda únicamente datos faltantes en el perfil propio y detiene el pedido si falla", async () => {
  let profile = { id: "cliente-1", userId: "cliente-1", displayName: "Ana", role: "Client" };
  const writes = [];
  let status = 200;
  const service = compile("src/modulos/tienda/motor/pedidoService.ts", {
    "./tarifaUberService": {},
    "@/lib/clientAuth": { authHeaders: () => ({ Authorization: "Bearer token" }) },
    "@/modulos/repartidor/motor/driverService": {
      loadClientProfile: () => profile,
      saveClientProfile: (next) => { profile = next; },
    },
    "./productoDisponibilidad": {},
  }, {
    fetch: async (url, options) => {
      writes.push({ url, body: JSON.parse(options.body) });
      return { ok: status === 200 };
    },
  });
  const form = { customerName: "Ana", customerPhone: "3411234567" };
  await service.saveMissingCustomerProfile(form, "cliente-1");
  assert.equal(writes[0].url, "/api/db/clients/cliente-1");
  assert.equal(writes[0].body.phone, "3411234567");
  assert.equal(Object.keys(writes[0].body).length, 1);
  assert.equal(profile.phone, "3411234567");
  await service.saveMissingCustomerProfile(form, "cliente-1");
  assert.equal(writes.length, 1);
  await assert.rejects(service.saveMissingCustomerProfile(form, "otro"), /sesión cambió/);
  profile = { ...profile, phone: "" };
  status = 503;
  await assert.rejects(service.saveMissingCustomerProfile(form, "cliente-1"), /guardar tus datos/);
  assert.equal(profile.phone, "");
});

test("recupera datos faltantes de la cuenta sin reemplazar los datos locales existentes", async () => {
  let profile = { id: "cliente-1", userId: "cliente-1", displayName: "Ana", role: "Client" };
  let status = 200;
  const service = compile("src/modulos/tienda/motor/pedidoService.ts", {
    "./tarifaUberService": {},
    "@/lib/clientAuth": { authHeaders: () => ({ Authorization: "Bearer token" }) },
    "@/modulos/repartidor/motor/driverService": {
      loadClientProfile: () => profile,
      saveClientProfile: (next) => { profile = next; },
    },
    "./productoDisponibilidad": {},
  }, {
    fetch: async (url, options) => {
      assert.equal(url, "/api/db/clients/cliente-1");
      assert.equal(options.headers.Authorization, "Bearer token");
      return { status, ok: status === 200, json: async () => ({ displayName: "Otro", phone: "3411234567" }) };
    },
  });
  await service.refreshMissingCustomerProfile();
  assert.equal(profile.displayName, "Ana");
  assert.equal(profile.phone, "3411234567");
  profile = { ...profile, phone: "" };
  status = 503;
  await assert.rejects(service.refreshMissingCustomerProfile(), /cargar tus datos/);
  assert.equal(profile.phone, "");
  status = 404;
  await service.refreshMissingCustomerProfile();
  assert.equal(profile.phone, "");
});

test("no aplica una respuesta del perfil a otra cuenta que inició sesión durante la consulta", async () => {
  let profile = { id: "cliente-1", userId: "cliente-1", displayName: "Ana", role: "Client" };
  let resolveResponse;
  const service = compile("src/modulos/tienda/motor/pedidoService.ts", {
    "./tarifaUberService": {},
    "@/lib/clientAuth": { authHeaders: () => ({ Authorization: "Bearer token" }) },
    "@/modulos/repartidor/motor/driverService": {
      loadClientProfile: () => profile,
      saveClientProfile: (next) => { profile = next; },
    },
    "./productoDisponibilidad": {},
  }, {
    fetch: () => new Promise((resolve) => { resolveResponse = resolve; }),
  });
  const pending = service.refreshMissingCustomerProfile();
  profile = { id: "cliente-2", userId: "cliente-2", displayName: "Luis", role: "Client" };
  resolveResponse({ ok: true, status: 200, json: async () => ({ phone: "3411234567" }) });
  await assert.rejects(pending, /sesión cambió/);
  assert.equal(profile.id, "cliente-2");
  assert.equal(profile.phone, undefined);
});

test("al iniciar sesión conserva el teléfono registrado sin sobrescribir el perfil", async () => {
  let savedProfile;
  const calls = [];
  const harness = componentHarness("src/modulos/tienda/ui/ModalClientAuth.tsx", {
    "@/components/ui/dialog": uiComponents, "@/components/ui/button": uiComponents,
    "@/components/ui/input": uiComponents, "lucide-react": icons,
    "@/hooks/use-toast": { useToast: () => ({ toast() {} }) },
    "@/firebase": { useFirestore: () => ({}) },
    "@/firebase/local-firestore": { doc() {}, setDoc() { throw new Error("No debe escribir el perfil al iniciar sesión"); } },
    "@/modulos/repartidor/motor/driverService": {
      saveClientProfile: (profile) => { savedProfile = profile; },
      generateUniqueEntityId: () => "generado",
    },
    "../motor/pedidoService": {
      readRegisteredCustomer: async (id, token) => {
        calls.push({ id, token });
        return { phone: "3411234567", address: "Calle 123" };
      },
    },
  }, {
    fetch: async () => ({
      ok: true,
      json: async () => ({
        access_token: "token",
        user: { id: "cliente-1", uid: "cliente-1", role: "Client", isAnonymous: false, displayName: "Ana" },
      }),
    }),
  });
  const props = { isOpen: true, onOpenChange() {} };
  let tree = harness.render("ModalClientAuth", props);
  nodes(tree).find((node) => node.props?.placeholder === "cliente o tu email").props.onChange({ target: { value: "ana" } });
  nodes(tree).find((node) => node.props?.placeholder === "••••••••").props.onChange({ target: { value: "password" } });
  tree = harness.render("ModalClientAuth", props);
  await nodes(tree).find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(calls[0].id, "cliente-1");
  assert.equal(calls[0].token, "Bearer token");
  assert.equal(savedProfile.phone, "3411234567");
  assert.equal(savedProfile.address, "Calle 123");
});
