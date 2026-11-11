import { NextResponse } from "next/server"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { ambienteDeEmpresa } from "@/lib/sri/ambiente"
import { enviarComprobante } from "@/lib/sri/soap"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  if (!body?.confirmar) {
    return NextResponse.json({ enviado: false, bloqueado: true, estado: "PENDIENTE_DE_AUTORIZAR", mensaje: "El envío a pruebas se hace con ENVIAR A SRI PRUEBAS." }, { status: 403 })
  }
  const resultado = await enviarComprobante({
    xmlFirmado: String(body?.xml || body?.xmlFirmado || ""),
    claveAcceso: String(body?.clave || body?.claveAcceso || ""),
    ambiente: ambienteDeEmpresa(sesion.empresa),
  })
  const status = resultado.bloqueado ? 403 : 200
  return NextResponse.json({ ...resultado, estadoSRI: resultado.estado }, { status })
}
