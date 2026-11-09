import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { codigoAmbiente } from "@/lib/sri/ambiente"
import { URLS_SRI, enviarAlSri } from "@/lib/sri/cliente-sri"
import { guardarRespuestaSri } from "@/lib/sri/guardar-respuesta"

export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
    const pedido = await req.json().catch(() => ({}))
    const clave = String(pedido?.claveAcceso || "").replace(/\D/g, "")
    if (clave.length !== 49) return NextResponse.json({ error: "Falta la clave de acceso" }, { status: 400 })
    const filas = await prisma.facturaEmitida.findMany({
      where: { empresaId: sesion.empresa.id },
      orderBy: { createdAt: "desc" },
      take: 80,
    })
    const factura = filas.find((fila) => String((fila.payload as { claveAcceso?: string } | null)?.claveAcceso || "").replace(/\D/g, "") === clave)
    if (!factura) return NextResponse.json({ error: "No encontré la factura" }, { status: 404 })
    const body = (factura.payload || {}) as Record<string, any>
    if (String(body.fechaAutorizacion || "").trim() && String(factura.sriStatus || factura.estado) === "AUTORIZADO") {
      return NextResponse.json({ estado: "AUTORIZADO", fechaAutorizacion: body.fechaAutorizacion, mensaje: body.mensajeSri || "", numeroAutorizacion: body.numeroAutorizacion || "" })
    }
    const extra = sesion.empresa.datosRegistro && typeof sesion.empresa.datosRegistro === "object" && !Array.isArray(sesion.empresa.datosRegistro)
      ? sesion.empresa.datosRegistro as Record<string, unknown>
      : {}
    const ambiente = codigoAmbiente(extra.ambiente || body?.configEmisor?.ambiente)
    const urls = URLS_SRI[ambiente]
    const xml = String(body.xmlContent || "")
    if (!xml) return NextResponse.json({ error: "La factura no tiene XML firmado" }, { status: 400 })
    const real = await enviarAlSri({
      xmlFirmado: xml,
      claveAcceso: clave,
      ambiente,
      recepcionUrl: urls.recepcion,
      autorizacionUrl: urls.autorizacion,
    })
    const cerrado = await guardarRespuestaSri(factura.id, body, real)
    return NextResponse.json(cerrado)
  } catch (e: any) {
    const code = String(e?.cause?.code || e?.code || e?.codigo || "")
    if (e?.name === "TimeoutError" || code === "Timeout" || code === "ETIMEDOUT") {
      return NextResponse.json({ conectado: false, estado: "PENDIENTE", error: "El SRI tardó demasiado en responder (Timeout)." }, { status: 504 })
    }
    return NextResponse.json({ conectado: false, estado: "PENDIENTE", error: e?.message || "No se pudo consultar al SRI" }, { status: 500 })
  }
}
