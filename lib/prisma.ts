import { PrismaClient } from "@prisma/client"
import { columnasConsumo } from "@/lib/sri/columnas-consumo"

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

function crearPrisma() {
  const base = new PrismaClient({
    datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
  })
  return base.$extends({
    query: {
      facturaEmitida: {
        create({ args, query }) {
          return query({ ...args, data: columnasConsumo(args.data as Record<string, any>) as typeof args.data })
        },
        update({ args, query }) {
          return query({ ...args, data: columnasConsumo(args.data as Record<string, any>) as typeof args.data })
        },
        upsert({ args, query }) {
          return query({
            ...args,
            create: columnasConsumo(args.create as Record<string, any>) as typeof args.create,
            update: columnasConsumo(args.update as Record<string, any>) as typeof args.update,
          })
        },
      },
    },
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof crearPrisma> | undefined
}

export const prisma = globalForPrisma.prisma ?? crearPrisma()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
