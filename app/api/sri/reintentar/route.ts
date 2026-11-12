import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { reintentarPendientesSri } from "@/lib/sri/reintentar-pendientes"

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
    return NextResponse.json(resultado)
  }
  if (!cronAutorizado(req)) return NextResponse.json({ error: "No hay sesión" }, { status: 401 })
  const resultado = await reintentarPendientesSri()
  return NextResponse.json(resultado)
}

export async function GET(req: Request) {
  return POST(req)
}
