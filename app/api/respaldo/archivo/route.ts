import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { puede } from "@/lib/seguridad"
import { pdfRide } from "@/lib/sri/ride-archivo"
import { leerComprobanteArchivado } from "@/lib/security/storage"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: "No hay sesión" }, { status: 401 })
  if (!puede(sesion.usuario.rol, "facturar")) return NextResponse.json({ error: "Tu rol no puede descargar este respaldo" }, { status: 403 })
  const url = new URL(req.url)
  const id = String(url.searchParams.get("id") || "")
  const tipo = url.searchParams.get("tipo") === "pdf" ? "pdf" : "xml"
  const fila = await prisma.facturaEmitida.findFirst({ where: { id, empresaId: sesion.empresa.id } })
  if (!fila) return NextResponse.json({ error: "No encontré esa factura en tu empresa" }, { status: 404 })
  const datos = fila.payload && typeof fila.payload === "object" && !Array.isArray(fila.payload)
    ? fila.payload as Record<string, any>
    : {}
  const clave = String(datos.claveAcceso || "").replace(/\D/g, "")
  const numero = String(datos.secuencial || id).replace(/\D/g, "").slice(-9) || "factura"
  if (tipo === "xml") {
    const guardado = clave.length === 49 ? await leerComprobanteArchivado(sesion.empresa.id, clave, "xml") : null
    const xml = guardado && guardado.length ? guardado : Buffer.from(String(datos.xmlContent || ""), "utf8")
    if (!xml.length) return NextResponse.json({ error: "Esta factura no tiene XML guardado" }, { status: 404 })
    return new NextResponse(new Uint8Array(xml), {
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="factura-${numero}.xml"`,
      },
    })
  }
  const guardado = clave.length === 49 ? await leerComprobanteArchivado(sesion.empresa.id, clave, "pdf") : null
  const pdf = guardado && guardado.length ? guardado : pdfRide(datos, String(datos.fechaAutorizacion || datos.fechaEmisionFormato || ""))
  if (!pdf?.length) return NextResponse.json({ error: "Esta factura no tiene PDF guardado" }, { status: 404 })
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="factura-${numero}.pdf"`,
    },
  })
}
