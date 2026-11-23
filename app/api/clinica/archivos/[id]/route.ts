import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { descargarPrivado } from "@/lib/security/storage"

export async function GET(req: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const { id } = await contexto.params
  const archivo = await prisma.clinicaArchivo.findFirst({ where: { id, empresaId: sesion.empresa.id } })
  if (!archivo) return NextResponse.json({ error: "Ese examen no está en esta empresa" }, { status: 404 })
  const datos = await descargarPrivado("historia-clinica", archivo.ruta)
  return new NextResponse(new Blob([new Uint8Array(datos)]), {
    headers: {
      "Content-Type": archivo.mime,
      "Content-Disposition": `inline; filename="${archivo.nombre.replace(/["\r\n]/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
