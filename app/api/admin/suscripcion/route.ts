import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { asegurarPlanInicial, vigenciaPlan } from "@/lib/plan-inicial"

const PAGOS = ["manual", "transferencia", "efectivo"]

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}))
  const id = String(body?.id || "")
  const accion = String(body?.accion || "")
  const empresa = await prisma.empresa.findUnique({ where: { id }, include: { plan: true } })
  if (!empresa) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })

  if (accion === "asignar" || accion === "cambiar" || accion === "inicial") {
    const plan = accion === "inicial"
      ? await asegurarPlanInicial()
      : await prisma.planComercial.findUnique({ where: { id: String(body.planId || "") } })
    if (!plan) return NextResponse.json({ error: "Elige un plan" }, { status: 400 })
    if (plan.activo === false) return NextResponse.json({ error: "Ese plan está inactivo" }, { status: 400 })
    const metodo = PAGOS.includes(String(body.metodoPago || "")) ? String(body.metodoPago) : "manual"
    const { inicio, fin } = vigenciaPlan(plan)
    const actualizada = await prisma.empresa.update({
      where: { id },
      data: {
        planId: plan.id,
        planEstado: "ACTIVO",
        planInicio: inicio,
        planFin: fin,
        metodoPago: metodo,
        comprobantesUsados: 0,
      },
      include: { plan: true },
    })
    return NextResponse.json(actualizada)
  }

  if (accion === "suspender") {
    const actualizada = await prisma.empresa.update({
      where: { id },
      data: { planEstado: "SUSPENDIDO" },
      include: { plan: true },
    })
    return NextResponse.json(actualizada)
  }

  if (accion === "reactivar") {
    const vigente = empresa.plan && empresa.planFin && empresa.planFin.getTime() >= Date.now()
    if (!vigente) {
      const plan = await asegurarPlanInicial()
      const { inicio, fin } = vigenciaPlan(plan)
      const actualizada = await prisma.empresa.update({
        where: { id },
        data: { planId: plan.id, planEstado: "ACTIVO", planInicio: inicio, planFin: fin, metodoPago: "manual" },
        include: { plan: true },
      })
      return NextResponse.json(actualizada)
    }
    const actualizada = await prisma.empresa.update({
      where: { id },
      data: { planEstado: "ACTIVO" },
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
