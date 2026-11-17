import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { datosRegistroDe, usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { sanearConsulta } from "@/lib/optica/consulta"
import { consultaParaQuien, veHistoriaClinica } from "@/lib/optica/acceso"

export async function GET(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const pacienteId = String(req.nextUrl.searchParams.get("pacienteId") || "")
  const historia = veHistoriaClinica(sesion.usuario)
  if (pacienteId && !historia) return NextResponse.json({ error: "La historia clínica es solo del optometrista" }, { status: 403 })
  const consultas = await prisma.opticaConsulta.findMany({
    where: { empresaId: sesion.empresa.id, ...(pacienteId ? { pacienteId } : {}) },
    include: { paciente: true, adendas: { orderBy: { createdAt: "asc" } } },
    orderBy: { fechaHora: "desc" },
    take: pacienteId ? 50 : 30,
  })
  return NextResponse.json({ consultas: consultas.map((fila) => consultaParaQuien(fila as unknown as Record<string, unknown>, historia)) })
}

export async function POST(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!veHistoriaClinica(sesion.usuario)) return NextResponse.json({ error: "La historia clínica es solo del optometrista" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const pacienteId = String(body.pacienteId || "")
  const paciente = await prisma.opticaPaciente.findFirst({ where: { id: pacienteId, empresaId: sesion.empresa.id } })
  if (!paciente) return NextResponse.json({ error: "El paciente no está en esta óptica" }, { status: 404 })
  if (!paciente.consentimientoAt) return NextResponse.json({ error: "El paciente debe autorizar el uso de sus datos" }, { status: 400 })
  const saneado = sanearConsulta(body)
  if ("error" in saneado) return NextResponse.json({ error: saneado.error }, { status: 400 })
  const datos = saneado.datos
  const config = await prisma.opticaConfig.findUnique({ where: { empresaId: sesion.empresa.id } })
  const profesional = {
    nombre: sesion.usuario.nombre,
    cedula: config?.cedulaProfesional || "",
    registro_acess: config?.registroAcess || "",
    registro_senescyt: config?.registroSenescyt || "",
  }
  const sucursalId = String(body.sucursalId || "")
  const sucursal = sucursalId
    ? await prisma.establecimientoSri.findFirst({ where: { id: sucursalId, empresaId: sesion.empresa.id } })
    : null
  const extra = datosRegistroDe(sesion.empresa.datosRegistro)
  const consulta = await prisma.opticaConsulta.create({
    data: {
      empresaId: sesion.empresa.id,
      pacienteId: paciente.id,
      usuarioId: sesion.usuario.id,
      usuarioNombre: sesion.usuario.nombre,
      sucursalId: sucursal?.id || null,
      estado: "ABIERTA",
      cerrada: false,
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
        direccion: sesion.empresa.direccion || "",
        logoUrl: String(extra.logo_url || extra.logoUrl || extra.marca_ride || ""),
        ciudad: String(extra.ciudad || extra.canton || ""),
        sucursal: sucursal ? `${sucursal.codigo} ${sucursal.nombre}` : String(body.sucursalNombre || ""),
        unicodigo_acess: config?.unicodigo || "",
      },
      pacienteResumen: {
        nombres: paciente.nombres,
        apellidos: paciente.apellidos,
        identificacion: paciente.identificacion,
        fecha_nacimiento: paciente.fechaNacimiento ? paciente.fechaNacimiento.toISOString().slice(0, 10) : "",
      },
    },
  })
  return NextResponse.json({ consulta })
}
