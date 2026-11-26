const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { randomBytes } = require("node:crypto");
const { Pool } = require("pg");
const dotenv = require("dotenv");
const ts = require("typescript");

test("reseñas verifican dueño, entrega y una sola calificación por pedido en PostgreSQL", {
  skip: process.env.RF_RUN_POSTGRES_TEST !== "1",
}, async () => {
  const env = {};
  const loaded = dotenv.config({ path: process.env.RF_DATABASE_ENV_FILE, processEnv: env, quiet: true });
  assert.ok(!loaded.error && env.DATABASE_URL, "No se pudo leer la base de pruebas.");
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_URL.includes("render.com") || env.DATABASE_URL.includes("dpg-")
      ? { rejectUnauthorized: false } : undefined,
    max: 5, connectionTimeoutMillis: 10000,
  });
  const schema = `rf_review_test_${randomBytes(12).toString("hex")}`;
  const quoted = `"${schema}"`;
  let created = false;
  const query = async (text, params) => {
    try { return await pool.query(text, params); }
    catch (error) { throw new Error(`Consulta de prueba fallida: ${error.code || "conexión"}`); }
  };
  try {
    await query(`CREATE SCHEMA ${quoted}`);
    created = true;
    await query(`CREATE TABLE ${quoted}.empresas (id integer primary key, nombre text, activo integer)`);
    await query(`INSERT INTO ${quoted}.empresas VALUES (1, 'Uno', 1), (2, 'Dos', 1)`);
    await query(`CREATE TABLE ${quoted}.repartofacil_pedidos (
      id text primary key, empresa_id integer, cliente_id text, cliente_usuario_id text, estado text
    )`);
    await query(`INSERT INTO ${quoted}.repartofacil_pedidos VALUES
      ('entregado',1,'perfil-1','usuario-1','Delivered'),
      ('pendiente',1,'perfil-1','usuario-1','Assigned'),
      ('ajeno',2,'perfil-2','usuario-2','Delivered')`);
    const migration = fs.readFileSync("scripts/repartofacil-empresas-resenas.sql", "utf8")
      .replaceAll("public.", `${quoted}.`);
    await query(migration);
    const compiled = ts.transpileModule(fs.readFileSync("src/app/api/resenas/route.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const exports = {};
    vm.runInNewContext(compiled, {
      exports, console,
      require(name) {
        if (name === "next/server") return { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };
        if (name === "@/lib/db") return { queryDb: async (sql, params) => (await query(sql.replaceAll("public.", `${quoted}.`), params)).rows };
        if (name === "@/lib/orderAuth") return { authenticateOrderUser: async (req) => req.user
          ? { user: { id: req.user, role: "Client" } }
          : { response: { status: 401 } } };
        throw new Error(`Dependencia inesperada: ${name}`);
      },
    });
    const req = (user, pedidoId, estrellas = 5, comentario = "Excelente") => ({
      user, json: async () => ({ pedidoId, estrellas, comentario }),
      nextUrl: { searchParams: new URLSearchParams({ pedidoId }) },
    });
    assert.equal((await exports.POST(req(null, "entregado"))).status, 401);
    assert.equal((await exports.POST(req("usuario-1", "entregado", 6))).status, 400);
    assert.equal((await exports.POST(req("usuario-1", "pendiente"))).status, 409);
    assert.equal((await exports.POST(req("usuario-1", "ajeno"))).status, 409);
    const concurrent = await Promise.all([
      exports.POST(req("usuario-1", "entregado")),
      exports.POST(req("usuario-1", "entregado")),
    ]);
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [201, 409]);
    assert.equal((await exports.GET(req("usuario-1", "entregado"))).body.resena.comentario, "Excelente");
    assert.equal((await exports.GET(req("usuario-2", "entregado"))).body.resena, null);
    const rows = await query(`SELECT empresa_id, estrellas FROM ${quoted}.repartofacil_resenas`);
    assert.equal(rows.rowCount, 1);
    assert.equal(rows.rows[0].empresa_id, 1);
  } finally {
    if (created) {
      const tables = await query("SELECT tablename FROM pg_tables WHERE schemaname = $1", [schema]);
      const allowed = new Set(["empresas", "repartofacil_pedidos", "repartofacil_empresa_perfiles", "repartofacil_resenas"]);
      if (!tables.rows.every((row) => allowed.has(row.tablename))) throw new Error("Se conservó el esquema de prueba por contener tablas inesperadas.");
      await query(`DROP SCHEMA ${quoted} CASCADE`);
    }
    await pool.end();
  }
});
