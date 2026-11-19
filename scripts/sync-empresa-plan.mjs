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

const archivosSql = [
  "../prisma/migrations/20261109021500_sync_empresa_plan/migration.sql",
  "../prisma/migrations/20261117030000_optica_historia/migration.sql",
  "../prisma/migrations/20261117040000_optica_orden/migration.sql",
  "../prisma/migrations/20261118210000_proforma/migration.sql",
  "../prisma/migrations/20261118220000_restaurante_estado/migration.sql",
]

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
  for (const archivo of archivosSql) {
    const sql = readFileSync(new URL(archivo, import.meta.url), "utf8")
    await client.query(sql)
  }
} finally {
  await client.end()
}
