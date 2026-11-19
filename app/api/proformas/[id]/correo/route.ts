import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { puede } from "@/lib/seguridad"
import { correosDe, numeroProforma, texto } from "@/lib/proforma/calculos"
import { pdfDeProforma } from "@/lib/proforma/guardar"
import { enviarCorreoProforma } from "@/lib/correo/proforma"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!puede(sesion.usuario.rol, "facturar")) return NextResponse.json({ error: "Tu rol no puede enviar proformas" }, { status: 403 })
  const { id } = await contexto.params
  const proforma = await prisma.proforma.findFirst({ where: { id, empresaId: sesion.empresa.id } })
  if (!proforma) return NextResponse.json({ error: "Proforma no encontrada" }, { status: 404 })
  const pedido = await req.json().catch(() => ({}))
  const destinos = correosDe(pedido?.correos)
  const payload = proforma.payload && typeof proforma.payload === "object" ? proforma.payload as Record<string, unknown> : {}
  const emisor = payload.emisor && typeof payload.emisor === "object" ? payload.emisor as Record<string, unknown> : {}
  const cliente = payload.cliente && typeof payload.cliente === "object" ? payload.cliente as Record<string, unknown> : {}
  const totales = payload.totales && typeof payload.totales === "object" ? payload.totales as Record<string, unknown> : {}
  const resultado = await enviarCorreoProforma({
    empresa: texto(emisor.razon, 180) || sesion.empresa.razonSocial,
    correoEmpresa: texto(emisor.email || sesion.empresa.email, 120),
    numero: numeroProforma(proforma.numero),
    cliente: texto(cliente.razon, 180) || "cliente",
    total: (Number(totales.total) || 0).toFixed(2),
    destinos,
    pdf: pdfDeProforma(proforma.numero, payload),
  })
  if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: 400 })
  return NextResponse.json({ ok: true, enviados: resultado.enviados })
}
