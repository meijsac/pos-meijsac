import { codigoAmbiente, type CodigoAmbiente } from "@/lib/sri/ambiente"

export function ambienteDeComprobante(doc: unknown): CodigoAmbiente {
  const fila = doc && typeof doc === "object" ? doc as Record<string, unknown> : {}
  const clave = String(fila.claveAcceso || fila.clave || fila.claveAccesoSustento || "").replace(/\D/g, "")
  if (clave.length >= 24 && (clave[23] === "1" || clave[23] === "2")) return clave[23]
  const emisor = fila.configEmisor && typeof fila.configEmisor === "object" ? fila.configEmisor as Record<string, unknown> : {}
  const marcado = fila.envioSri || fila.ambiente || emisor.ambiente
  if (marcado) return codigoAmbiente(marcado)
  return "1"
}

export function esDelAmbiente(doc: unknown, codigo: unknown) {
  return ambienteDeComprobante(doc) === codigoAmbiente(codigo)
}
