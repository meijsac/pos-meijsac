import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { codigoAmbiente } from "@/lib/sri/ambiente"
import { consultarAutorizacion } from "@/lib/sri/soap"
import { clasificarEstadoSri, estadoEnModal } from "@/lib/sri/estado-visible"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const id = String(body?.id || body?.facturaId || "")
  let clave = String(body?.claveAcceso || "").replace(/\D/g, "")
  let factura = null as Awaited<ReturnType<typeof prisma.facturaEmitida.findFirst>>
  if (id) {
    factura = await prisma.facturaEmitida.findFirst({ where: { id, empresaId: sesion.empresa.id } })
    const payload = (factura?.payload || {}) as { claveAcceso?: string }
    if (!clave) clave = String(payload.claveAcceso || "").replace(/\D/g, "")
  }
  if (clave.length !== 49) {
    return NextResponse.json({
      estado: "PENDIENTE",
      mensaje: "Esta factura no tiene una clave de acceso de 49 dígitos. No se puede consultar en el SRI.",
    })
  }
  const extra = sesion.empresa.datosRegistro && typeof sesion.empresa.datosRegistro === "object" && !Array.isArray(sesion.empresa.datosRegistro)
    ? sesion.empresa.datosRegistro as Record<string, unknown>
    : {}
  const resultado = await consultarAutorizacion({
    claveAcceso: clave,
    ambiente: codigoAmbiente(extra.ambiente || extra.ambienteCodigo || body?.ambiente),
  })
  const visible = clasificarEstadoSri(resultado.estado, resultado.fechaAutorizacion)
  if (factura) {
    const previo = (factura.payload || {}) as Record<string, unknown>
    const payload = {
      ...previo,
      estadoSRI: visible === "AUTORIZADO" ? "AUTORIZADO" : resultado.estado,
      fechaAutorizacion: resultado.fechaAutorizacion || "",
      numeroAutorizacion: visible === "AUTORIZADO" ? (resultado.numeroAutorizacion || "") : "",
      mensajeSri: resultado.mensaje,
      estadoAutorizacion: resultado.estadoAutorizacion || "",
      mensajeAutorizacion: resultado.mensajeAutorizacion || resultado.mensaje,
    }
    await prisma.facturaEmitida.update({
      where: { id: factura.id },
      data: { estado: visible === "AUTORIZADO" ? "AUTORIZADO" : resultado.estado, payload },
    }).catch(() => {})
  }
  return NextResponse.json({
    estado: estadoEnModal(resultado.estado, resultado.fechaAutorizacion, resultado.estadoRecepcion),
    visible,
    mensaje: resultado.mensaje || "El SRI no devolvió un mensaje.",
    fechaAutorizacion: resultado.fechaAutorizacion || "",
    numeroAutorizacion: resultado.numeroAutorizacion || "",
    claveAcceso: clave,
  })
}
