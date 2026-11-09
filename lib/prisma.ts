import { PrismaClient } from "@prisma/client"

function pooledDatabaseUrl(raw: string | undefined) {
  if (!raw) return undefined
  const [base, query = ""] = raw.split("?")
  const params = new URLSearchParams(query)
  params.set("pgbouncer", "true")
  params.set("connection_limit", "1")
  return `${base}?${params.toString()}`
}

const databaseUrl = pooledDatabaseUrl(process.env.DATABASE_URL)
if (databaseUrl) process.env.DATABASE_URL = databaseUrl

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
