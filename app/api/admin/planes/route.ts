import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { MODULOS_MEIJSAC } from "@/lib/suscripcion"

function limpiar(body: any) {
  const nombre = String(body?.nombre || "").trim()
  const precio = Number(body?.precio)
  const duracionDias = Math.round(Number(body?.duracionDias))
  const limiteComprobantes = Math.round(Number(body?.limiteComprobantes))
  const limiteUsuarios = Math.round(Number(body?.limiteUsuarios))
  const modulos = Array.isArray(body?.modulos)
    ? body.modulos.map((m: unknown) => String(m)).filter((m: string) => (MODULOS_MEIJSAC as readonly string[]).includes(m))
    : String(body?.modulos || "").split(",").map((m) => m.trim()).filter((m) => (MODULOS_MEIJSAC as readonly string[]).includes(m))

  if (!nombre) return { error: "Escribe el nombre del plan" }
  if (!Number.isFinite(precio) || precio < 0) return { error: "El precio puede ser 0 o mayor" }
  if (!Number.isFinite(duracionDias) || duracionDias < 1) return { error: "La duración debe ser de al menos 1 día" }
  if (!Number.isFinite(limiteComprobantes) || limiteComprobantes < -1) return { error: "Límite de comprobantes inválido. -1 es ilimitado" }
  if (!Number.isFinite(limiteUsuarios) || limiteUsuarios < 1) return { error: "El plan debe permitir al menos 1 usuario" }
  if (modulos.length === 0) return { error: "Elige al menos un módulo" }

  return {
    data: {
      nombre,
      precio,
      duracionDias,
      limiteComprobantes,
      limiteUsuarios,
      modulos: modulos.join(","),
    },
  }
}

export async function GET() {
  const planes = await prisma.planComercial.findMany({ orderBy: { createdAt: "asc" } })
  return NextResponse.json(planes.map((p) => ({ ...p, modulos: p.modulos.split(",").filter(Boolean) })))
}

export async function POST(req: Request) {
  const parsed = limpiar(await req.json().catch(() => ({})))
  if ("error" in parsed && parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const plan = await prisma.planComercial.create({ data: parsed.data! })
  return NextResponse.json(plan)
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}))
  const id = String(body?.id || "")
  if (!id) return NextResponse.json({ error: "Falta el plan" }, { status: 400 })
  const parsed = limpiar(body)
  if ("error" in parsed && parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const existe = await prisma.planComercial.findUnique({ where: { id } })
  if (!existe) return NextResponse.json({ error: "Ese plan ya no existe" }, { status: 404 })
  const plan = await prisma.planComercial.update({ where: { id }, data: parsed.data! })
  return NextResponse.json(plan)
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || ""
  if (!id) return NextResponse.json({ error: "Falta el plan" }, { status: 400 })
  const enUso = await prisma.empresa.count({ where: { planId: id, planEstado: "ACTIVO" } })
  if (enUso > 0) {
    return NextResponse.json({ error: "Ese plan tiene clientes activos. Quítalo de esos clientes antes de eliminarlo." }, { status: 409 })
  }
  await prisma.planComercial.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
