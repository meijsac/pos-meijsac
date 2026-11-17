import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { datosRegistroDe, usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { sanearConsulta } from "@/lib/optica/consulta"

export async function GET(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const pacienteId = String(req.nextUrl.searchParams.get("pacienteId") || "")
  const consultas = await prisma.opticaConsulta.findMany({
    where: { empresaId: sesion.empresa.id, ...(pacienteId ? { pacienteId } : {}) },
    include: { paciente: true, adendas: { orderBy: { createdAt: "asc" } } },
    orderBy: { fechaHora: "desc" },
    take: pacienteId ? 50 : 30,
  })
  return NextResponse.json({ consultas })
}

export async function POST(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const pacienteId = String(body.pacienteId || "")
  const paciente = await prisma.opticaPaciente.findFirst({ where: { id: pacienteId, empresaId: sesion.empresa.id } })
  if (!paciente) return NextResponse.json({ error: "El paciente no está en esta óptica" }, { status: 404 })
  if (!paciente.consentimientoAt) return NextResponse.json({ error: "El paciente debe autorizar el uso de sus datos" }, { status: 400 })
  const saneado = sanearConsulta(body)
  if ("error" in saneado) return NextResponse.json({ error: saneado.error }, { status: 400 })
  const datos = saneado.datos
  const profesional = {
    ...datos.profesional,
    nombre: datos.profesional.nombre || sesion.usuario.nombre,
  }
  const consulta = await prisma.opticaConsulta.create({
    data: {
      empresaId: sesion.empresa.id,
      pacienteId: paciente.id,
      usuarioId: sesion.usuario.id,
      usuarioNombre: sesion.usuario.nombre,
      motivo: datos.motivo,
      anamnesis: datos.anamnesis,
      lensometria: datos.lensometria,
      agudeza: datos.agudeza,
      examen: datos.examen,
      motilidad: datos.motilidad,
      refraccion: datos.refraccion,
      diagnosticos: datos.diagnosticos,
      plan: datos.plan,
      profesional,
      establecimiento: {
        nombre: sesion.empresa.nombreComercial || sesion.empresa.razonSocial,
        ruc: sesion.empresa.ruc,
        ciudad: String(datosRegistroDe(sesion.empresa.datosRegistro).ciudad || datosRegistroDe(sesion.empresa.datosRegistro).canton || ""),
        unicodigo_acess: datos.unicodigo,
      },
      pacienteResumen: {
        nombres: paciente.nombres,
        apellidos: paciente.apellidos,
        identificacion: paciente.identificacion,
        fecha_nacimiento: paciente.fechaNacimiento ? paciente.fechaNacimiento.toISOString().slice(0, 10) : "",
      },
    },
  })
  await prisma.opticaConfig.upsert({
    where: { empresaId: sesion.empresa.id },
    update: {
      unicodigo: datos.unicodigo,
      registroAcess: profesional.registro_acess,
      registroSenescyt: profesional.registro_senescyt,
      cedulaProfesional: profesional.cedula,
    },
    create: {
      empresaId: sesion.empresa.id,
      unicodigo: datos.unicodigo,
      registroAcess: profesional.registro_acess,
      registroSenescyt: profesional.registro_senescyt,
      cedulaProfesional: profesional.cedula,
    },
  })
  return NextResponse.json({ consulta })
}
