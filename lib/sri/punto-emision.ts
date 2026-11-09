export type PuntoFactura = {
  estab: string
  pto: string
  serie: string
  ultimo: string
  indice: number
}

function tres(valor: unknown) {
  return String(valor ?? "").replace(/\D/g, "").padStart(3, "0").slice(-3)
}

function nueve(valor: unknown) {
  const digitos = String(valor ?? "").replace(/\D/g, "")
  return digitos ? digitos.padStart(9, "0").slice(-9) : ""
}

function esFactura(fila: any) {
  const codigo = String(fila?.codigo || "01").replace(/\D/g, "").padStart(2, "0").slice(-2)
  const tipo = String(fila?.tipo || "").toUpperCase()
  const estado = String(fila?.estado || "ACTIVO").toUpperCase()
  const apagada = estado.includes("INACTIV") || estado.includes("BAJA") || estado === "OFF"
  return (codigo === "01" || tipo.includes("FACTURA")) && !apagada
}

export function serieDeAmbiente(ambiente: unknown) {
  const codigo = String(ambiente ?? "").trim().toUpperCase()
  if (codigo === "2" || codigo.includes("PROD")) return "001-001"
  return "001-002"
}

export function puntoActivoFactura(secuenciales: unknown, ambiente: unknown): { punto: PuntoFactura; aviso: string } {
  const serie = serieDeAmbiente(ambiente)
  const [estab, pto] = serie.split("-")
  const lista = Array.isArray(secuenciales) ? secuenciales : []
  const indice = lista.findIndex((fila) => esFactura(fila) && `${tres(fila?.estab)}-${tres(fila?.pto)}` === serie)
  const fila = indice >= 0 ? lista[indice] : null
  return {
    punto: { estab, pto, serie, ultimo: nueve(fila?.ultimo), indice },
    aviso: "",
  }
}

export function elegirSecuencial(pedido: string, ultimo: string, usados: Set<string>) {
  const mayor = Math.max(Number(nueve(ultimo) || "0"), ...[...usados].map((n) => Number(n)), 0)
  const pedido9 = nueve(pedido)
  if (pedido9 && Number(pedido9) > mayor && !usados.has(pedido9)) return pedido9
  return siguienteSecuencial(String(mayor).padStart(9, "0"), usados)
}

export function siguienteSecuencial(ultimo: string, usados: Set<string>) {
  let n = Number(nueve(ultimo) || "0") + 1
  if (!Number.isFinite(n) || n < 1) n = 1
  while (n <= 999999999 && usados.has(String(n).padStart(9, "0"))) n += 1
  if (n > 999999999) return ""
  return String(n).padStart(9, "0")
}

export function secuencialYaUsado(secuencial: string, usados: Set<string>) {
  const n = nueve(secuencial)
  return Boolean(n) && usados.has(n)
}
