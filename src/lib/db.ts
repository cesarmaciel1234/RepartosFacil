import { Pool } from "pg";

let pool: Pool | null = null;

const getPool = () => {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL debe configurarse para acceder a la base de datos.");
  }

  pool = new Pool({
    connectionString,
    ssl: connectionString.includes("render.com") || connectionString.includes("dpg-")
      ? { rejectUnauthorized: false }
      : undefined,
    max: 10,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
    keepAlive: true,
  });

  pool.on("error", (error) => {
    console.error("[DB] Se cortó o falló una conexión en el pool:", error.message);
  });

  return pool;
};

export async function queryDb<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const activePool = getPool();
  try {
    // pool.query adquiere un cliente del pool y garantiza liberarlo inmediatamente al terminar o fallar
    const res = await activePool.query(text, params);
    return res.rows;
  } catch (error: any) {
    console.error("[DB Query Error]:", error?.message || error);
    throw error;
  }
}

export default pool;
