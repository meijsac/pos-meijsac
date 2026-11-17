import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

export async function POST(req: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const { id } = await contexto.params
  const consulta = await prisma.opticaConsulta.findFirst({ where: { id, empresaId: sesion.empresa.id } })
  if (!consulta) return NextResponse.json({ error: "Esa consulta no está en esta óptica" }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const texto = String(body.texto || "").replace(/\s+/g, " ").trim().slice(0, 1000)
  if (!texto) return NextResponse.json({ error: "Escribe la nota aclaratoria" }, { status: 400 })
  const adenda = await prisma.opticaAdenda.create({
    data: {
      empresaId: sesion.empresa.id,
      consultaId: consulta.id,
      usuarioId: sesion.usuario.id,
      usuarioNombre: sesion.usuario.nombre,
      texto,
    },
  })
  return NextResponse.json({ adenda })
}
