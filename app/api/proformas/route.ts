import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { puede } from "@/lib/seguridad"
import { numeroProforma, texto } from "@/lib/proforma/calculos"
import { armarPayload, crearProforma, emisorDeEmpresa } from "@/lib/proforma/guardar"

export const dynamic = "force-dynamic"

function fila(proforma: { id: string; numero: number; estado: string; createdAt: Date; payload: unknown }) {
  const payload = proforma.payload && typeof proforma.payload === "object" ? proforma.payload as Record<string, unknown> : {}
  const cliente = payload.cliente && typeof payload.cliente === "object" ? payload.cliente as Record<string, unknown> : {}
  const totales = payload.totales && typeof payload.totales === "object" ? payload.totales as Record<string, unknown> : {}
  return {
    id: proforma.id,
    numero: numeroProforma(proforma.numero),
    estado: proforma.estado,
    fecha: texto(payload.fecha, 20),
    cliente: texto(cliente.razon, 180),
    total: Number(totales.total) || 0,
    creada: proforma.createdAt,
  }
}

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!puede(sesion.usuario.rol, "facturar")) return NextResponse.json({ error: "Tu rol no puede ver proformas" }, { status: 403 })
  const lista = await prisma.proforma.findMany({
    where: { empresaId: sesion.empresa.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  return NextResponse.json(lista.map(fila))
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!puede(sesion.usuario.rol, "facturar")) return NextResponse.json({ error: "Tu rol no puede guardar proformas" }, { status: 403 })
  const body = await req.json().catch(() => null)
  const armado = armarPayload(body, emisorDeEmpresa(sesion.empresa), sesion.usuario.nombre)
  if ("error" in armado) return NextResponse.json({ error: armado.error }, { status: 400 })
  const proforma = await crearProforma(sesion.empresa.id, armado.payload)
  return NextResponse.json(fila(proforma))
}
