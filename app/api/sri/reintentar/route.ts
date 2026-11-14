import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { reintentarPendientesSri } from "@/lib/sri/reintentar-pendientes"
import { copiarRespaldoDiario } from "@/lib/sri/respaldo-diario"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function cronAutorizado(req: Request) {
  const esperado = process.env.CRON_SECRET || ""
  const recibido = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "")
  if (!esperado || recibido.length !== esperado.length) return false
  return timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado))
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if (!("error" in sesion)) {
    const resultado = await reintentarPendientesSri(sesion.empresa.id)
    const respaldo = await copiarRespaldoDiario(sesion.empresa.id).catch(() => ({ copiados: 0 }))
    return NextResponse.json({ ...resultado, respaldo })
  }
  if (!cronAutorizado(req)) return NextResponse.json({ error: "No hay sesión" }, { status: 401 })
  const resultado = await reintentarPendientesSri()
  const respaldo = await copiarRespaldoDiario().catch(() => ({ copiados: 0 }))
  return NextResponse.json({ ...resultado, respaldo })
}

export async function GET(req: Request) {
  return POST(req)
}
