import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { datosRegistroDe, usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { sanearConsulta } from "@/lib/optica/consulta"
import { consultaParaQuien, veHistoriaClinica } from "@/lib/optica/acceso"

export async function GET(req: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const { id } = await contexto.params
  const consulta = await prisma.opticaConsulta.findFirst({
    where: { id, empresaId: sesion.empresa.id },
    include: { paciente: true, adendas: { orderBy: { createdAt: "asc" } } },
  })
  if (!consulta) return NextResponse.json({ error: "Esa consulta no está en esta óptica" }, { status: 404 })
  const historia = veHistoriaClinica(sesion.usuario)
  const visible = consultaParaQuien(consulta as unknown as Record<string, unknown>, historia) as Record<string, unknown>
  const extra = datosRegistroDe(sesion.empresa.datosRegistro)
  const local = visible.establecimiento && typeof visible.establecimiento === "object" ? visible.establecimiento as Record<string, unknown> : {}
  visible.establecimiento = {
    ...local,
    nombre: local.nombre || sesion.empresa.nombreComercial || sesion.empresa.razonSocial,
    ruc: local.ruc || sesion.empresa.ruc,
    direccion: local.direccion || sesion.empresa.direccion || "",
    logoUrl: local.logoUrl || String(extra.logo_url || extra.logoUrl || extra.marca_ride || ""),
  }
  return NextResponse.json({ consulta: visible })
}

export async function PATCH(req: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!veHistoriaClinica(sesion.usuario)) return NextResponse.json({ error: "La historia clínica es solo del optometrista" }, { status: 403 })
  const { id } = await contexto.params
  const actual = await prisma.opticaConsulta.findFirst({ where: { id, empresaId: sesion.empresa.id } })
  if (!actual) return NextResponse.json({ error: "Esa consulta no está en esta óptica" }, { status: 404 })
  if (actual.estado === "CERRADA" || actual.cerrada) return NextResponse.json({ error: "La consulta ya está cerrada. Agrega una nota aclaratoria." }, { status: 409 })
  const body = await req.json().catch(() => ({}))
  const saneado = sanearConsulta(body)
  if ("error" in saneado) return NextResponse.json({ error: saneado.error }, { status: 400 })
  const datos = saneado.datos
  const config = await prisma.opticaConfig.findUnique({ where: { empresaId: sesion.empresa.id } })
  const local = actual.establecimiento && typeof actual.establecimiento === "object" && !Array.isArray(actual.establecimiento) ? actual.establecimiento as Record<string, unknown> : {}
  const sucursalId = String(body.sucursalId || "")
  const sucursal = sucursalId ? await prisma.establecimientoSri.findFirst({ where: { id: sucursalId, empresaId: sesion.empresa.id } }) : null
  try {
    const consulta = await prisma.opticaConsulta.update({
      where: { id: actual.id },
      data: {
        sucursalId: sucursal?.id || actual.sucursalId,
        motivo: datos.motivo,
        anamnesis: datos.anamnesis,
        lensometria: datos.lensometria,
        agudeza: datos.agudeza,
        examen: datos.examen,
        motilidad: datos.motilidad,
        refraccion: datos.refraccion,
        diagnosticos: datos.diagnosticos,
        plan: datos.plan,
        profesional: {
          nombre: sesion.usuario.nombre,
          cedula: config?.cedulaProfesional || "",
          registro_acess: config?.registroAcess || "",
          registro_senescyt: config?.registroSenescyt || "",
        },
        establecimiento: { ...local, unicodigo_acess: config?.unicodigo || "" },
      },
    })
    return NextResponse.json({ consulta })
  } catch {
    return NextResponse.json({ error: "La consulta ya está cerrada. Agrega una nota aclaratoria." }, { status: 409 })
  }
}
