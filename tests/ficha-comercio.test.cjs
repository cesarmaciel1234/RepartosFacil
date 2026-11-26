const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

test("el catálogo publica la ficha vigente y las estrellas verificadas, no datos privados", async () => {
  let profile = { nombre: "Mi comercio", direccion: "Anterior 1", latitud: -32.9, longitud: -60.6,
    whatsapp: "5493411111111", descripcion: "Almacén", horario: "9 a 20" };
  const compiled = ts.transpileModule(fs.readFileSync("src/app/api/cobrofacil/[...path]/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, process: { env: {} }, console,
    require(name) {
      if (name === "next/server") return { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };
      if (name === "@/data/productImageManifest.json") return {};
      if (name === "@/lib/db") return { queryDb: async (sql) => sql.includes("public.empresas e")
        ? [{ id: 3, nombre: "Empresa registrada", slug: "comercio", company_data: {},
            public_profile: profile, promedio: "4.5", cantidad: "2" }]
        : [] };
      throw new Error(`Dependencia inesperada: ${name}`);
    },
  });
  const get = () => exports.GET({}, { params: Promise.resolve({ path: ["companies"] }) });
  let result = (await get()).body.empresas[0];
  assert.equal(result.address, "Anterior 1");
  assert.equal(result.phone, "5493411111111");
  assert.equal(result.rating, 4.5);
  assert.equal(result.ratingCount, 2);
  profile = { ...profile, direccion: "Nueva 42", whatsapp: "5493422222222", latitud: -33, longitud: -61 };
  result = (await get()).body.empresas[0];
  assert.equal(result.address, "Nueva 42");
  assert.equal(result.phone, "5493422222222");
  assert.equal(result.coordinates.lat, -33);
  assert.equal(result.openingHours, "9 a 20");
  assert.equal(result.smtp_password, undefined);
});
