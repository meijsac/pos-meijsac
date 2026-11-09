export const PRUEBA_DIAS = 15
export const PRUEBA_COMPROBANTES = 10

export const MODULOS_MEIJSAC = [
  "CONFIGURACIÓN",
  "COMPROBANTES ELECTRÓNICOS",
  "POS TICKET",
  "RESTAURANTE POS",
  "CONTABILIDAD",
  "CUENTAS POR COBRAR",
  "INVENTARIO",
  "CAJA",
  "CLIENTES",
  "REPORTES",
  "COMPROBANTES ADICIONALES",
] as const

export type EstadoPlan = "PRUEBA" | "ACTIVO" | "BLOQUEADO"

type PlanRow = {
  nombre: string
  limiteComprobantes: number
  limiteUsuarios: number
  modulos: string
  duracionDias: number
  precio: number
}

export type EmpresaPlan = {
  planEstado: string
  planInicio: Date | null
  planFin: Date | null
  comprobantesUsados: number
  pruebaInicio: Date
  createdAt: Date
  firmaExpira: Date | null
  metodoPago: string | null
  plan: PlanRow | null
}

export function evaluarSuscripcion(e: EmpresaPlan, now = new Date()) {
  const trialStart = e.pruebaInicio || e.createdAt
  const trialEnd = new Date(trialStart)
  trialEnd.setDate(trialEnd.getDate() + PRUEBA_DIAS)
  const pruebaVigente = now.getTime() <= trialEnd.getTime() && e.comprobantesUsados < PRUEBA_COMPROBANTES

  const manual = e.planEstado === "SUSPENDIDO" || e.planEstado === "CANCELADO"
  const tienePlan = !!e.plan && !!e.planInicio && !!e.planFin
  const vencio = tienePlan && now.getTime() > e.planFin!.getTime()
  const pruebaVencida = now.getTime() > trialEnd.getTime()
  const limite = e.plan?.limiteComprobantes ?? PRUEBA_COMPROBANTES

  let estado: EstadoPlan = "PRUEBA"
  let vence: Date | null = trialEnd
  let limiteComprobantes = PRUEBA_COMPROBANTES
  let planNombre = "PLAN DE PRUEBA"
  let modulos: string[] | null = null

  if (manual || (tienePlan && vencio) || (!tienePlan && pruebaVencida)) {
    estado = "BLOQUEADO"
    vence = tienePlan ? e.planFin : trialEnd
    if (e.plan) {
      planNombre = e.plan.nombre
      limiteComprobantes = limite
      modulos = e.plan.modulos.split(",").map((m) => m.trim()).filter(Boolean)
    }
  } else if (tienePlan && e.planEstado === "ACTIVO" && now.getTime() >= e.planInicio!.getTime()) {
    estado = "ACTIVO"
    vence = e.planFin
    limiteComprobantes = limite
    planNombre = e.plan!.nombre
    modulos = e.plan!.modulos.split(",").map((m) => m.trim()).filter(Boolean)
  } else if (pruebaVigente || !pruebaVencida) {
    estado = "PRUEBA"
    vence = trialEnd
  }

  const diasFirma = e.firmaExpira
    ? Math.ceil((e.firmaExpira.getTime() - now.getTime()) / 86400000)
    : null

  const mensaje = estado === "BLOQUEADO"
    ? (e.planEstado === "SUSPENDIDO" || e.planEstado === "CANCELADO"
      ? "La cuenta está suspendida. MEIJSAC puede reactivarla."
      : "El plan está vencido. MEIJSAC puede asignar otro plan.")
    : estado === "PRUEBA"
      ? `PLAN DE PRUEBA: ${PRUEBA_DIAS} días o ${PRUEBA_COMPROBANTES} comprobantes, lo que ocurra primero.`
      : `${planNombre} activo hasta ${vence ? vence.toLocaleDateString() : ""}.`

  return {
    estado,
    mensaje,
    vence,
    limiteComprobantes,
    planNombre,
    modulos,
    diasFirma,
    firmaExpira: e.firmaExpira,
    comprobantesUsados: e.comprobantesUsados,
    metodoPago: e.metodoPago,
    precio: e.plan?.precio ?? 0,
  }
}

export function rangoPlan(fechaInicio: string, duracionDias: number) {
  const inicio = new Date(`${fechaInicio}T00:00:00`)
  if (Number.isNaN(inicio.getTime())) throw new Error("Fecha de inicio inválida")
  const dias = Math.round(Number(duracionDias))
  if (!Number.isFinite(dias) || dias < 1) throw new Error("La duración debe ser de al menos 1 día")
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + dias)
  fin.setHours(23, 59, 59, 999)
  return { inicio, fin }
}
