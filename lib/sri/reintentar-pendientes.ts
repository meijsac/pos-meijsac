import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { reenviarClaveSri } from "@/lib/sri/reenviar-pendiente"

const LOTE = 3

export async function reintentarPendientesSri(empresaId?: string) {
  const filtroEmpresa = empresaId ? Prisma.sql`AND "empresaId" = ${empresaId}` : Prisma.empty
  const filas = await prisma.$queryRaw<Array<{ empresaId: string; clave: string }>>(Prisma.sql`
    SELECT "empresaId",
      regexp_replace(COALESCE(payload->>'claveAcceso', ''), '[^0-9]', '', 'g') AS clave
    FROM "FacturaEmitida"
    WHERE COALESCE(payload->>'fechaAutorizacion', '') = ''
      AND estado IN ('PENDIENTE', 'PENDIENTE_DE_AUTORIZAR')
      AND length(COALESCE(payload->>'xmlContent', '')) > 40
      AND "createdAt" < NOW() - INTERVAL '20 seconds'
      AND "createdAt" > NOW() - INTERVAL '15 days'
      ${filtroEmpresa}
    ORDER BY "createdAt" ASC
    LIMIT ${LOTE}
  `)
  const revisados: Array<{ clave: string; estado: string; conectado: boolean }> = []
  for (const fila of filas) {
    if (fila.clave.length !== 49) continue
    const resultado = await reenviarClaveSri(fila.empresaId, fila.clave)
    if (!resultado.ok) {
      revisados.push({ clave: fila.clave, estado: "ERROR", conectado: false })
      continue
    }
    const conectado = "conectado" in resultado.datos ? resultado.datos.conectado !== false : true
    revisados.push({ clave: fila.clave, estado: String(resultado.datos.estado || ""), conectado })
    if (!conectado) break
  }
  return { revisados }
}
