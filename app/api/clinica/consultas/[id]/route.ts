import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { jsonConsulta, sanearConsulta } from "@/lib/clinica/consulta"

async function propia(id: string, empresaId: string) {
  return prisma.clinicaConsulta.findFirst({
    where: { id, empresaId },
    include: {
      paciente: true,
      archivos: { select: { id: true, nombre: true, mime: true, clase: true, interpretacion: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  })
}

export async function GET(req: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const { id } = await contexto.params
  const consulta = await propia(id, sesion.empresa.id)
  if (!consulta) return NextResponse.json({ error: "Esa consulta no está en esta empresa" }, { status: 404 })
  return NextResponse.json({
    consulta,
    empresa: {
      razon: sesion.empresa.razonSocial || sesion.empresa.nombreComercial,
      ruc: sesion.empresa.ruc,
    },
  })
}

export async function PUT(req: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const { id } = await contexto.params
  const actual = await prisma.clinicaConsulta.findFirst({ where: { id, empresaId: sesion.empresa.id } })
  if (!actual) return NextResponse.json({ error: "Esa consulta no está en esta empresa" }, { status: 404 })
  if (actual.estado === "CERRADA") return NextResponse.json({ error: "La consulta está cerrada" }, { status: 400 })
  const body = await req.json().catch(() => ({}))
  const datos = sanearConsulta(body)
  const consulta = await prisma.clinicaConsulta.update({
    where: { id: actual.id },
    data: jsonConsulta(datos),
    include: {
      paciente: true,
      archivos: { select: { id: true, nombre: true, mime: true, clase: true, interpretacion: true, createdAt: true } },
    },
  })
  return NextResponse.json({ consulta })
}

export async function POST(req: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const { id } = await contexto.params
  const actual = await prisma.clinicaConsulta.findFirst({ where: { id, empresaId: sesion.empresa.id }, include: { paciente: true, archivos: { select: { id: true, nombre: true, mime: true, clase: true, interpretacion: true, createdAt: true } } } })
  if (!actual) return NextResponse.json({ error: "Esa consulta no está en esta empresa" }, { status: 404 })
  if (actual.estado === "CERRADA") return NextResponse.json({ consulta: actual })
  const consulta = await prisma.clinicaConsulta.update({
    where: { id: actual.id },
    data: { estado: "CERRADA" },
    include: { paciente: true, archivos: { select: { id: true, nombre: true, mime: true, clase: true, interpretacion: true, createdAt: true } } },
  })
  return NextResponse.json({ consulta })
}
