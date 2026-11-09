import { readFileSync } from "fs"
import { PrismaClient } from "@prisma/client"

if (process.env.VERCEL !== "1") {
  process.exit(0)
}

const sql = readFileSync(
  new URL("../prisma/migrations/20261109021500_sync_empresa_plan/migration.sql", import.meta.url),
  "utf8"
)

const prisma = new PrismaClient()
try {
  await prisma.$executeRawUnsafe(sql)
} finally {
  await prisma.$disconnect()
}
