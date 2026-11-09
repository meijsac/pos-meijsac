import { prisma } from "@/lib/prisma"
import { MODULOS_MEIJSAC } from "@/lib/suscripcion"

export async function asegurarPlanInicial() {
  const planes = await prisma.planComercial.findMany({ orderBy: { createdAt: "asc" } })
  const activo = planes.find((p) => /inicial/i.test(p.nombre) && p.activo !== false)
  if (activo) return activo
  const inactivo = planes.find((p) => /inicial/i.test(p.nombre))
  if (inactivo) {
    return prisma.planComercial.update({ where: { id: inactivo.id }, data: { activo: true } })
  }
  return prisma.planComercial.create({
    data: {
      nombre: "Plan Inicial",
      descripcion: "Gratuito",
      precio: 0,
      precioAnual: 0,
      duracionDias: 365,
      trialDias: 0,
      limiteComprobantes: 15,
      limiteUsuarios: 1,
      documentosAnio: 15,
      badge: "Gratuito",
      activo: true,
      modulos: MODULOS_MEIJSAC.join(","),
    },
  })
}

export function vigenciaPlan(plan: { trialDias?: number | null; duracionDias: number }, desde = new Date()) {
  const inicio = new Date(desde)
  inicio.setHours(0, 0, 0, 0)
  const dias = Math.max(1, (plan.trialDias || 0) + (plan.duracionDias || 365))
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + dias)
  fin.setHours(23, 59, 59, 999)
  return { inicio, fin }
}
