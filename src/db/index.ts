import { neon, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  neonPool?: Pool;
};

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL belum diatur pada environment variables.");
  }
  return connectionString;
}

// Stateless HTTP driver avoids idle WebSocket drops in serverless and local Node.
export function getDb() {
  const sql = neon(getConnectionString());
  return drizzleHttp(sql, { schema });
}

export function getTxDb() {
  if (!globalForDb.neonPool) {
    const pool = new Pool({ connectionString: getConnectionString() });
    pool.on("error", (err) => {
      console.error("Neon pool idle connection error:", err);
    });
    globalForDb.neonPool = pool;
  }
  return drizzleServerless(globalForDb.neonPool, { schema });
}
