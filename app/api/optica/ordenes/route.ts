import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

const ESTADOS = ["PENDIENTE_COTIZAR", "EN_TALLER", "LISTO_ENTREGA", "ENTREGADO"]

function texto(valor: unknown, tope = 160) {
  return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, tope)
}

export async function GET(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const ordenes = await prisma.opticaOrden.findMany({
    where: { empresaId: sesion.empresa.id },
    include: { paciente: true, clienteFacturacion: true },
    orderBy: { createdAt: "desc" },
    take: 40,
  })
  return NextResponse.json({
    ordenes: ordenes.map((orden) => ({
      ...orden,
      clienteFacturacion: orden.clienteFacturacion ? { id: orden.clienteFacturacion.id, razonSocial: orden.clienteFacturacion.razonSocial, identificacion: orden.clienteFacturacion.identificacion } : null,
    })),
  })
}

export async function POST(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const pacienteId = String(body.pacienteId || "")
  const paciente = await prisma.opticaPaciente.findFirst({ where: { id: pacienteId, empresaId: sesion.empresa.id } })
  if (!paciente) return NextResponse.json({ error: "Elige el paciente de esta óptica" }, { status: 404 })
  const sucursalId = String(body.sucursalId || "")
  const sucursal = sucursalId ? await prisma.establecimientoSri.findFirst({ where: { id: sucursalId, empresaId: sesion.empresa.id } }) : null
  const formula = body.formula && typeof body.formula === "object" ? body.formula : { od: {}, oi: {}, material_sugerido: texto(body.material, 150) }
  const orden = await prisma.opticaOrden.create({
    data: {
      empresaId: sesion.empresa.id,
      sucursalId: sucursal?.id || null,
      pacienteId: paciente.id,
      formula,
      tipoLente: texto(body.tipoLente, 100),
      material: texto(body.material, 150),
      observaciones: texto(body.observaciones, 400),
      estado: "PENDIENTE_COTIZAR",
    },
  })
  return NextResponse.json({ orden })
}

export async function PATCH(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const orden = await prisma.opticaOrden.findFirst({ where: { id: String(body.id || ""), empresaId: sesion.empresa.id } })
  if (!orden) return NextResponse.json({ error: "Esa orden no está en esta óptica" }, { status: 404 })
  const estado = ESTADOS.includes(String(body.estado || "")) ? String(body.estado) : orden.estado
  let clienteFacturacionId = orden.clienteFacturacionId
  if (body.clienteFacturacionId) {
    const cliente = await prisma.cliente.findFirst({ where: { id: String(body.clienteFacturacionId), empresaId: sesion.empresa.id } })
    if (!cliente) return NextResponse.json({ error: "Ese cliente no es de esta empresa" }, { status: 404 })
    clienteFacturacionId = cliente.id
  }
  let facturaId = orden.facturaId
  const secuencial = String(body.secuencial || "").replace(/\D/g, "")
  if (secuencial) {
    const facturas = await prisma.facturaEmitida.findMany({ where: { empresaId: sesion.empresa.id }, orderBy: { createdAt: "desc" }, take: 80 })
    const hallada = facturas.find((fila) => {
      const payload = fila.payload && typeof fila.payload === "object" ? fila.payload as Record<string, unknown> : {}
      return String(payload.secuencial || "").replace(/\D/g, "").padStart(9, "0") === secuencial.slice(-9).padStart(9, "0")
    })
    if (!hallada) return NextResponse.json({ error: "No hay una factura de esta empresa con ese secuencial" }, { status: 404 })
    facturaId = hallada.id
  }
  const actualizada = await prisma.opticaOrden.update({
    where: { id: orden.id },
    data: {
      estado,
      clienteFacturacionId,
      facturaId,
      tipoLente: body.tipoLente !== undefined ? texto(body.tipoLente, 100) : orden.tipoLente,
      material: body.material !== undefined ? texto(body.material, 150) : orden.material,
      observaciones: body.observaciones !== undefined ? texto(body.observaciones, 400) : orden.observaciones,
      armazonNombre: body.armazonNombre !== undefined ? texto(body.armazonNombre, 160) : orden.armazonNombre,
      lunaNombre: body.lunaNombre !== undefined ? texto(body.lunaNombre, 160) : orden.lunaNombre,
    },
  })
  return NextResponse.json({ orden: actualizada })
}
