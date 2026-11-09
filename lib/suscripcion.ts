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

  const tienePlan = e.planEstado === "ACTIVO" && !!e.plan && !!e.planInicio && !!e.planFin
  const yaEmpezo = tienePlan && now.getTime() >= e.planInicio!.getTime()
  const sigueVigente = tienePlan && now.getTime() <= e.planFin!.getTime()
  const limite = e.plan?.limiteComprobantes ?? -1
  const bajoLimite = limite < 0 || e.comprobantesUsados < limite

  let estado: EstadoPlan = "BLOQUEADO"
  let vence: Date | null = trialEnd
  let limiteComprobantes = PRUEBA_COMPROBANTES
  let planNombre = "PLAN DE PRUEBA"
  let modulos: string[] | null = null

  if (e.planEstado === "CANCELADO") {
    estado = "BLOQUEADO"
    vence = e.planFin
  } else if (yaEmpezo && sigueVigente && bajoLimite) {
    estado = "ACTIVO"
    vence = e.planFin
    limiteComprobantes = limite
    planNombre = e.plan!.nombre
    modulos = e.plan!.modulos.split(",").map((m) => m.trim()).filter(Boolean)
  } else if (yaEmpezo && sigueVigente && !bajoLimite) {
    estado = "BLOQUEADO"
    vence = e.planFin
    limiteComprobantes = limite
    planNombre = e.plan!.nombre
    modulos = e.plan!.modulos.split(",").map((m) => m.trim()).filter(Boolean)
  } else if (!yaEmpezo && pruebaVigente) {
    estado = "PRUEBA"
    vence = trialEnd
  } else {
    estado = "BLOQUEADO"
    vence = tienePlan ? e.planFin : trialEnd
    if (tienePlan && e.plan) planNombre = e.plan.nombre
  }

  const diasFirma = e.firmaExpira
    ? Math.ceil((e.firmaExpira.getTime() - now.getTime()) / 86400000)
    : null

  const mensaje = estado === "BLOQUEADO"
    ? "Tu plan de prueba terminó o el plan asignado ya no está vigente. Solo MEIJSAC puede activarte un plan."
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
