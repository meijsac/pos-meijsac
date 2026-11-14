import { prisma } from "@/lib/prisma"
import { pdfRide } from "@/lib/sri/ride-archivo"
import { guardarCopiaDiaria, leerComprobanteArchivado } from "@/lib/security/storage"

function diaGuayaquil(fecha = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(fecha)
}

export async function copiarRespaldoDiario(empresaId?: string) {
  const desde = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const filas = await prisma.facturaEmitida.findMany({
    where: {
      ...(empresaId ? { empresaId } : {}),
      createdAt: { gte: desde },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  })
  const dia = diaGuayaquil()
  let copiados = 0
  for (const fila of filas) {
    const datos = fila.payload && typeof fila.payload === "object" && !Array.isArray(fila.payload)
      ? fila.payload as Record<string, any>
      : {}
    if (!String(datos.fechaAutorizacion || "").trim()) continue
    const clave = String(datos.claveAcceso || "").replace(/\D/g, "")
    if (clave.length !== 49) continue
    const xmlGuardado = await leerComprobanteArchivado(fila.empresaId, clave, "xml")
    const pdfGuardado = await leerComprobanteArchivado(fila.empresaId, clave, "pdf")
    const xml = xmlGuardado && xmlGuardado.length
      ? xmlGuardado
      : Buffer.from(String(datos.xmlContent || ""), "utf8")
    if (!xml.length) continue
    const pdf = pdfGuardado && pdfGuardado.length
      ? pdfGuardado
      : pdfRide(datos, String(datos.fechaAutorizacion))
    if (!pdf?.length) continue
    await guardarCopiaDiaria(fila.empresaId, clave, dia, xml, pdf)
    copiados += 1
  }
  return { copiados, dia }
}
