import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rangoPlan } from "@/lib/suscripcion"

const PAGOS = ["manual", "transferencia", "efectivo"]

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}))
  const id = String(body?.id || "")
  const accion = String(body?.accion || "")
  const empresa = await prisma.empresa.findUnique({ where: { id }, include: { plan: true } })
  if (!empresa) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })

  if (accion === "asignar" || accion === "cambiar") {
    const plan = await prisma.planComercial.findUnique({ where: { id: String(body.planId || "") } })
    if (!plan) return NextResponse.json({ error: "Elige un plan" }, { status: 400 })
    const metodo = String(body.metodoPago || "")
    if (!PAGOS.includes(metodo)) return NextResponse.json({ error: "Elige forma de pago: manual, transferencia o efectivo" }, { status: 400 })
    let rango: { inicio: Date; fin: Date }
    try {
      rango = rangoPlan(String(body.fechaInicio || ""), Number(body.duracionDias || plan.duracionDias))
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const actualizada = await prisma.empresa.update({
      where: { id },
      data: {
        planId: plan.id,
        planEstado: "ACTIVO",
        planInicio: rango.inicio,
        planFin: rango.fin,
        metodoPago: metodo,
        comprobantesUsados: 0,
      },
      include: { plan: true },
    })
    return NextResponse.json(actualizada)
  }

  if (accion === "aumentar") {
    if (empresa.planEstado !== "ACTIVO" || !empresa.planFin) {
      return NextResponse.json({ error: "Este cliente no tiene un plan activo para aumentar" }, { status: 400 })
    }
    const dias = Math.round(Number(body.dias))
    if (!Number.isFinite(dias) || dias < 1) return NextResponse.json({ error: "Indica cuántos días aumentar" }, { status: 400 })
    const fin = new Date(empresa.planFin)
    fin.setDate(fin.getDate() + dias)
    const actualizada = await prisma.empresa.update({
      where: { id },
      data: { planFin: fin, planEstado: "ACTIVO" },
      include: { plan: true },
    })
    return NextResponse.json(actualizada)
  }

  if (accion === "quitar") {
    const actualizada = await prisma.empresa.update({
      where: { id },
      data: {
        planId: null,
        planEstado: "BLOQUEADO",
        planInicio: null,
        planFin: null,
        metodoPago: null,
      },
      include: { plan: true },
    })
    return NextResponse.json(actualizada)
  }

  if (accion === "cancelar") {
    const actualizada = await prisma.empresa.update({
      where: { id },
      data: {
        planEstado: "CANCELADO",
        planFin: new Date(),
      },
      include: { plan: true },
    })
    return NextResponse.json(actualizada)
  }

  return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 })
}
