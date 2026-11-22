import { ambienteDeComprobante } from "@/lib/ambiente-datos"

export type EstadoConsumo = "AUTORIZADO" | "RECHAZADO" | "EN_PROCESO" | "ANULADO"

export function fechaAutorizacionColumna(valor: unknown) {
  const texto = String(valor || "").trim()
  if (!texto) return null
  const partida = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (partida) {
    const fecha = new Date(Number(partida[3]), Number(partida[2]) - 1, Number(partida[1]), Number(partida[4] || 0), Number(partida[5] || 0), Number(partida[6] || 0))
    return Number.isNaN(fecha.getTime()) ? null : fecha
  }
  const iso = new Date(texto)
  return Number.isNaN(iso.getTime()) ? null : iso
}

export function estadoSriColumna(estado: unknown, fecha: unknown): EstadoConsumo {
  const crudo = String(estado || "").toUpperCase()
  if (crudo.includes("ANUL")) return "ANULADO"
  if (crudo.includes("RECHAZ") || crudo.includes("DEVUELT") || crudo.includes("NO AUTORIZ")) return "RECHAZADO"
  if (String(fecha || "").trim()) return "AUTORIZADO"
  return "EN_PROCESO"
}

export function columnasConsumo(data: Record<string, any>) {
  const payload = data.payload
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return data
  const fechaTexto = payload.fechaAutorizacion
  return {
    ...data,
    ambiente: ambienteDeComprobante(payload),
    fechaAutorizacion: fechaAutorizacionColumna(fechaTexto),
    estadoSri: estadoSriColumna(payload.estadoSRI || payload.estado || data.estado || data.sriStatus, fechaTexto),
  }
}
