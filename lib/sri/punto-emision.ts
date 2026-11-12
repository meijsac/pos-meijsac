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

export const SECUENCIALES_VISIBLES = [
  { estab: "001", pto: "001", codigo: "01", tipo: "01 FACTURA", ultimo: "00000125", estado: "ACTIVO" },
  { estab: "001", pto: "002", codigo: "01", tipo: "01 FACTURA", ultimo: "00000010", estado: "ACTIVO" },
  { estab: "002", pto: "001", codigo: "04", tipo: "04 NOTA CREDITO", ultimo: "00000005", estado: "ACTIVO" },
]

export function serieDeAmbiente(ambiente: unknown) {
  const codigo = String(ambiente ?? "").trim().toUpperCase()
  if (codigo === "2" || codigo.includes("PROD")) return "001-001"
  return "001-002"
}

export function puntoActivoFactura(secuenciales: unknown, _ambiente: unknown, estabElegido?: string): { punto: PuntoFactura; aviso: string } {
  const lista = Array.isArray(secuenciales) ? secuenciales : []
  const facturas = lista
    .map((fila, indice) => ({ fila, indice }))
    .filter(({ fila }) => esFactura(fila))
  const preferido = tres(estabElegido || "")
  const delEstablecimiento = preferido && preferido !== "000"
    ? facturas.filter(({ fila }) => tres(fila?.estab) === preferido)
    : []
  const elegida = delEstablecimiento[0]
    || facturas.find(({ fila }) => String(fila?.estado || "").toUpperCase() === "ACTIVO")
    || facturas[0]
  if (!elegida) {
    return {
      punto: { estab: "", pto: "", serie: "", ultimo: "", indice: -1 },
      aviso: "No hay un punto de emisión en Configuración",
    }
  }
  const estab = preferido && preferido !== "000" ? preferido : tres(elegida.fila?.estab)
  const pto = tres(elegida.fila?.pto)
  return {
    punto: { estab, pto, serie: `${estab}-${pto}`, ultimo: nueve(elegida.fila?.ultimo), indice: elegida.indice },
    aviso: "",
  }
}

export function elegirSecuencial(pedido: string, ultimo: string, usados: Set<string>) {
  const pedido9 = nueve(pedido)
  if (pedido9 && pedido9 !== "000000000" && !usados.has(pedido9)) return pedido9
  const mayor = Math.max(Number(nueve(ultimo) || "0"), ...[...usados].map((n) => Number(n)), 0)
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
