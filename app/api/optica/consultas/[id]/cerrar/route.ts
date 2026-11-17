import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { veHistoriaClinica } from "@/lib/optica/acceso"

export async function POST(req: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!veHistoriaClinica(sesion.usuario)) return NextResponse.json({ error: "Cerrar la consulta es solo del optometrista" }, { status: 403 })
  const { id } = await contexto.params
  const actual = await prisma.opticaConsulta.findFirst({ where: { id, empresaId: sesion.empresa.id } })
  if (!actual) return NextResponse.json({ error: "Esa consulta no está en esta óptica" }, { status: 404 })
  if (actual.estado === "CERRADA" || actual.cerrada) return NextResponse.json({ error: "La consulta ya está cerrada" }, { status: 409 })
  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const consulta = await tx.opticaConsulta.update({
        where: { id: actual.id },
        data: { estado: "CERRADA", cerrada: true },
      })
      const orden = await tx.opticaOrden.create({
        data: {
          empresaId: sesion.empresa.id,
          sucursalId: actual.sucursalId,
          consultaId: actual.id,
          pacienteId: actual.pacienteId,
          formula: actual.refraccion as object,
          material: String((actual.refraccion as { material_sugerido?: string })?.material_sugerido || ""),
        },
      })
      return { consulta, orden }
    })
    return NextResponse.json(resultado)
  } catch {
    return NextResponse.json({ error: "No se pudo cerrar la consulta" }, { status: 409 })
  }
}
