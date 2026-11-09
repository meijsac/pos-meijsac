import { NextResponse } from "next/server"
import { anotarWhatsapp, bloquearWhatsapp } from "@/lib/login-memoria"
import { evaluarWhatsapp, pieWhatsapp, revisarMensajeWhatsapp, verificarFirmaMeta } from "@/lib/seguridad"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const raw = await req.text()
  const firma = req.headers.get("x-hub-signature-256") || ""
  if (!verificarFirmaMeta(raw, firma, process.env.WHATSAPP_APP_SECRET || "")) {
    return NextResponse.json({ error: "Firma de Meta inválida" }, { status: 401 })
  }
  const body = JSON.parse(raw || "{}")
  const numero = String(body?.from || body?.numero || "")
  const texto = String(body?.text || body?.mensaje || "")
  const archivo = String(body?.archivo || "")
  const ahora = Date.now()
  const estado = anotarWhatsapp(numero, ahora)
  const decision = evaluarWhatsapp(estado.fechas, ahora, estado.bloqueadoHasta)
  if (decision.bloquearHasta) bloquearWhatsapp(numero, decision.bloquearHasta)
  if (!decision.permitir) {
    if (decision.alerta) prisma.seguridadLog.create({ data: { accion: "WHATSAPP_BLOQUEO", detalle: numero, ip: numero } }).catch(() => {})
    return NextResponse.json({ error: "Número bloqueado" }, { status: 429 })
  }
  const revision = revisarMensajeWhatsapp(texto, archivo)
  if (revision.sospechoso) return NextResponse.json({ sospechoso: true, mostrar: false })
  const respuesta = revision.respuesta || pieWhatsapp()
  return NextResponse.json({ sospechoso: false, respuesta })
}
