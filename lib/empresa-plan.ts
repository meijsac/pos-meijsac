import { prisma } from "@/lib/prisma"
import { evaluarSuscripcion } from "@/lib/suscripcion"

export const includePlan = { plan: true } as const

export async function empresaPorRuc(ruc: string) {
  return prisma.empresa.findUnique({
    where: { ruc },
    include: includePlan,
  })
}

export function resumenEmpresa(empresa: NonNullable<Awaited<ReturnType<typeof empresaPorRuc>>>) {
  const evaluacion = evaluarSuscripcion(empresa)
  return {
    id: empresa.id,
    ruc: empresa.ruc,
    razonSocial: empresa.razonSocial,
    nombreComercial: empresa.nombreComercial,
    createdAt: empresa.createdAt,
    firmaExpira: empresa.firmaExpira,
    diasFirma: evaluacion.diasFirma,
    planId: empresa.planId,
    planNombre: evaluacion.planNombre,
    planEstado: empresa.planEstado,
    estado: evaluacion.estado,
    mensaje: evaluacion.mensaje,
    planInicio: empresa.planInicio,
    planFin: empresa.planFin,
    vence: evaluacion.vence,
    metodoPago: empresa.metodoPago,
    comprobantesUsados: empresa.comprobantesUsados,
    limiteComprobantes: evaluacion.limiteComprobantes,
    limiteUsuarios: empresa.plan?.limiteUsuarios ?? 1,
    modulos: evaluacion.modulos,
    precio: evaluacion.precio,
    duracionDias: empresa.plan?.duracionDias ?? null,
  }
}
