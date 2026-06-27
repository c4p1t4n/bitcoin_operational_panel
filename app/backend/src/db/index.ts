import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "../../../infra/schema";

/** Tipo do client Drizzle com schema tipado — usado em vez de `NodePgDatabase` bare para que selects/inserts conheçam as tabelas. */
export type Database = NodePgDatabase<typeof schema>;

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://ops_user:ops_password_dev@localhost:5432/bitcoin_ops";

const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });

// Health check for database connection
export async function checkDatabaseConnection() {
  try {
    await db.execute(sql`SELECT 1 as connection_ok`);
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Database connection check failed:", error);
    throw error;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection() {
  await pool.end();
}
