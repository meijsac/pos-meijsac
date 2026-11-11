import { prisma } from "@/lib/prisma"
import { ambienteDeEmpresa } from "@/lib/sri/ambiente"
import { enviarAlSri } from "@/lib/sri/cliente-sri"
import { guardarRespuestaSri } from "@/lib/sri/guardar-respuesta"

export async function reenviarClaveSri(empresaId: string, claveEntrada: string) {
  const clave = claveEntrada.replace(/\D/g, "")
  if (!empresaId || clave.length !== 49) return { ok: false as const, status: 400, error: "Falta la clave de acceso" }
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } })
  if (!empresa) return { ok: false as const, status: 404, error: "No encontré la empresa" }
  const filas = await prisma.facturaEmitida.findMany({
    where: { empresaId },
    orderBy: { createdAt: "desc" },
    take: 80,
  })
  const factura = filas.find((fila) => String((fila.payload as { claveAcceso?: string } | null)?.claveAcceso || "").replace(/\D/g, "") === clave)
  if (!factura) return { ok: false as const, status: 404, error: "No encontré la factura" }
  const body = (factura.payload || {}) as Record<string, any>
  if (String(body.fechaAutorizacion || "").trim() && String(factura.sriStatus || factura.estado) === "AUTORIZADO") {
    return { ok: true as const, status: 200, datos: { estado: "AUTORIZADO", fechaAutorizacion: body.fechaAutorizacion, mensaje: body.mensajeSri || "", numeroAutorizacion: body.numeroAutorizacion || "" } }
  }
  const ambiente = ambienteDeEmpresa(empresa)
  const xml = String(body.xmlContent || "")
  if (!xml) return { ok: false as const, status: 400, error: "La factura no tiene XML firmado" }
  const real = await enviarAlSri({ xmlFirmado: xml, claveAcceso: clave, ambiente })
  const cerrado = await guardarRespuestaSri(factura.id, body, real)
  return { ok: true as const, status: 200, datos: cerrado }
}
