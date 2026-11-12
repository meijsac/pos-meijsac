import { archivarComprobante } from "@/lib/security/storage"
import { conservarHasta, htmlRespaldo, pdfRide } from "@/lib/sri/ride-archivo"

const AVISO = "No se pudo guardar el XML y el RIDE. El comprobante sigue en el sistema, pero el archivo no quedó en el depósito."

export async function guardarRespaldo(empresaId: string, clave: string, xml: string, respuesta: unknown, body?: Record<string, any>) {
  const fecha = String(body?.fechaAutorizacion || (respuesta as { fechaAutorizacion?: string } | null)?.fechaAutorizacion || "").trim()
  const autorizado = fecha.length > 0
  try {
    let pdf: Buffer | undefined
    let html = ""
    let hasta = ""
    if (autorizado && body) {
      html = htmlRespaldo(body, fecha)
      pdf = pdfRide(body, fecha)
      hasta = conservarHasta(fecha)
      if (!html || !pdf.length) return { respaldoOk: false, respaldoError: AVISO, conservarHasta: "" }
    }
    await archivarComprobante(empresaId, clave, xml, respuesta, { pdf, html, conservarHasta: hasta })
    if (autorizado && (!pdf?.length || !html)) return { respaldoOk: false, respaldoError: AVISO, conservarHasta: "" }
    return { respaldoOk: true, respaldoError: "", conservarHasta: hasta }
  } catch {
    return { respaldoOk: false, respaldoError: AVISO, conservarHasta: "" }
  }
}
