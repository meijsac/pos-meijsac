import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { puede } from "@/lib/seguridad"
import { enviarCorreosFactura } from "@/lib/correo/factura"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!puede(sesion.usuario.rol, "facturar")) return NextResponse.json({ error: "Tu rol no puede enviar correos" }, { status: 403 })
  const pedido = await req.json().catch(() => ({}))
  const id = String(pedido?.id || "")
  if (!id) return NextResponse.json({ error: "Falta la factura" }, { status: 400 })
  const factura = await prisma.facturaEmitida.findFirst({ where: { id, empresaId: sesion.empresa.id } })
  if (!factura) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
  const payload = { ...((factura.payload || {}) as Record<string, any>) }
  const correoCuenta = String(sesion.empresa.email || "").trim()
  if (correoCuenta) {
    const emisor = payload.configEmisor && typeof payload.configEmisor === "object" ? payload.configEmisor : {}
    payload.configEmisor = { ...emisor, email: correoCuenta }
  }
  const guardado = payload.sriAutorizacion?.RespuestaAutorizacionComprobante?.autorizaciones?.autorizacion?.comprobante
  const xml = String(guardado || "").startsWith("<") ? String(guardado) : String(payload.xmlContent || "")
  const correoRegistro = await enviarCorreosFactura(payload, xml).catch(() => "")
  if (!correoRegistro) return NextResponse.json({ error: "Esta factura todavía no tiene una respuesta del SRI para enviar el correo" }, { status: 409 })
  payload.correoRegistro = correoRegistro
  await prisma.facturaEmitida.update({ where: { id }, data: { payload } })
  return NextResponse.json({ correoRegistro })
}
