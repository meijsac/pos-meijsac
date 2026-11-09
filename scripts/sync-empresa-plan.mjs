import { readFileSync } from "fs"
import pg from "pg"

if (process.env.VERCEL !== "1") {
  process.exit(0)
}

const databaseUrl = process.env.DIRECT_URL
if (!databaseUrl) {
  console.error("Falta DIRECT_URL")
  process.exit(1)
}

const sql = readFileSync(
  new URL("../prisma/migrations/20261109021500_sync_empresa_plan/migration.sql", import.meta.url),
  "utf8"
)

// Prisma agrega pgbouncer y connection_limit, que Postgres no entiende.
// node-postgres, sin lista de valores, usa el protocolo simple: no crea prepared statements.
const url = new URL(databaseUrl)
for (const key of ["pgbouncer", "connection_limit", "pool_timeout", "statement_cache_size", "sslmode"]) {
  url.searchParams.delete(key)
}

const client = new pg.Client({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false },
})
await client.connect()
try {
  await client.query(sql)
} finally {
  await client.end()
}
