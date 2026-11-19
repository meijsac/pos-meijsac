import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { puede } from "@/lib/seguridad"

export const dynamic = "force-dynamic"

export async function POST(req: Request, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!puede(sesion.usuario.rol, "facturar")) return NextResponse.json({ error: "Tu rol no puede convertir proformas" }, { status: 403 })
  const { id } = await contexto.params
  const proforma = await prisma.proforma.findFirst({ where: { id, empresaId: sesion.empresa.id } })
  if (!proforma) return NextResponse.json({ error: "Proforma no encontrada" }, { status: 404 })
  const payload = proforma.payload && typeof proforma.payload === "object" ? proforma.payload as Record<string, unknown> : {}
  await prisma.proforma.update({ where: { id: proforma.id }, data: { estado: "CONVERTIDA" } })
  return NextResponse.json({
    cliente: payload.cliente || null,
    items: Array.isArray(payload.items) ? payload.items : [],
    propina: Boolean(payload.propina),
  })
}
