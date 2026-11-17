import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

export async function GET(req: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const { id } = await contexto.params
  const consulta = await prisma.opticaConsulta.findFirst({
    where: { id, empresaId: sesion.empresa.id },
    include: { paciente: true, adendas: { orderBy: { createdAt: "asc" } } },
  })
  if (!consulta) return NextResponse.json({ error: "Esa consulta no está en esta óptica" }, { status: 404 })
  return NextResponse.json({ consulta })
}
