/**
 * BinManager — Read-only SQL Server connection pool.
 * Credentials come from environment variables; pool is created lazily on first use.
 */

import sql from "mssql";

let _pool: sql.ConnectionPool | null = null;

export async function getBMPool(): Promise<sql.ConnectionPool> {
  if (_pool && _pool.connected) return _pool;

  const pw = process.env.BM_PASSWORD ?? "Myy8XZ8j2reuBEZx9SZIAa9#";
  console.log("[BM] password length:", pw.length, "ends with #:", pw.endsWith("#"));

  // Read env vars lazily so dotenv has time to load them before first use
  const cfg: sql.config = {
    server: process.env.BM_SERVER ?? "45.22.197.136",
    database: process.env.BM_DATABASE ?? "BinManagerRo",
    user: process.env.BM_USER ?? "ro_leonel.hernandez",
    password: pw,
    options: { encrypt: false, trustServerCertificate: true },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
    connectionTimeout: 20_000,
    requestTimeout: 30_000,
  };

  _pool = await new sql.ConnectionPool(cfg).connect();
  _pool.on("error", () => {
    _pool = null;
  });
  return _pool;
}
