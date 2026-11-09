export type EstadoVisible = "AUTORIZADO" | "RECHAZADO" | "PENDIENTE"

export function clasificarEstadoSri(estado: unknown, fechaAutorizacion: unknown): EstadoVisible {
  const crudo = String(estado || "").trim().toUpperCase()
  const fecha = String(fechaAutorizacion || "").trim()
  if (crudo === "AUTORIZADO" && fecha) return "AUTORIZADO"
  if (crudo.includes("DEVUELT") || crudo.includes("NO AUTORIZ") || crudo.includes("RECHAZ")) return "RECHAZADO"
  return "PENDIENTE"
}

export function estadoEnModal(estado: unknown, fechaAutorizacion: unknown, recepcion: unknown) {
  const visible = clasificarEstadoSri(estado, fechaAutorizacion)
  if (visible === "AUTORIZADO") return "AUTORIZADO"
  const recep = String(recepcion || "").toUpperCase()
  const crudo = String(estado || "").toUpperCase()
  if (recep.includes("DEVUELT") || crudo.includes("DEVUELT") || crudo.includes("NO AUTORIZ") || crudo.includes("RECHAZ")) return "DEVUELTA"
  return "PENDIENTE"
}
