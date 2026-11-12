import { prisma } from "@/lib/prisma"

export async function facturaPorClave(empresaId: string, claveEntrada: string) {
  const clave = String(claveEntrada || "").replace(/\D/g, "")
  if (!empresaId || clave.length !== 49) return null
  const filas = await prisma.$queryRaw<Array<{ id: string; payload: unknown; estado: string; sriStatus: string | null }>>`
    SELECT id, payload, estado, sri_status AS "sriStatus"
    FROM "FacturaEmitida"
    WHERE "empresaId" = ${empresaId}
    AND regexp_replace(COALESCE(payload->>'claveAcceso', ''), '[^0-9]', '', 'g') = ${clave}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `
  return filas[0] || null
}
