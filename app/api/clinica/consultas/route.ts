import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { jsonConsulta, plantillaDe, sanearConsulta, texto } from "@/lib/clinica/consulta"

const vacio = { signos: {}, especialidad: {}, diagnosticos: [], ordenes: [], receta: [] }

export async function GET(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const pacienteId = texto(req.nextUrl.searchParams.get("pacienteId"), 40)
  const estado = texto(req.nextUrl.searchParams.get("estado"), 12)
  const consultas = await prisma.clinicaConsulta.findMany({
    where: {
      empresaId: sesion.empresa.id,
      ...(pacienteId ? { pacienteId } : {}),
      ...(estado === "CERRADA" || estado === "BORRADOR" ? { estado } : {}),
    },
    include: {
      paciente: true,
      archivos: { select: { id: true, nombre: true, mime: true, clase: true, interpretacion: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  })
  return NextResponse.json({ consultas })
}

export async function POST(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const pacienteId = texto(body.pacienteId, 40)
  const paciente = await prisma.clinicaPaciente.findFirst({ where: { id: pacienteId, empresaId: sesion.empresa.id } })
  if (!paciente) return NextResponse.json({ error: "Elige un paciente de esta empresa" }, { status: 400 })
  const datos = sanearConsulta({ ...vacio, plantilla: plantillaDe(body.plantilla) })
  const consulta = await prisma.clinicaConsulta.create({
    data: {
      empresaId: sesion.empresa.id,
      pacienteId: paciente.id,
      usuarioId: sesion.usuario.id,
      usuarioNombre: sesion.usuario.nombre,
      ...jsonConsulta(datos),
    },
    include: { paciente: true, archivos: true },
  })
  return NextResponse.json({ consulta })
}
