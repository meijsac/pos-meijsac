export type ItemProforma = {
  codigo: string
  descripcion: string
  cant: number
  pUnit: number
  descPorc: number
  codigoPorcentaje: string
  ice: number
  esPlastico: boolean
}

export type TotalesProforma = {
  bruto: number
  descuento: number
  subtotalSin: number
  base15: number
  base0: number
  baseNoObjeto: number
  baseExento: number
  baseDiferenciado: number
  valorICE: number
  valorIRBPNR: number
  iva15: number
  ivaDiferenciado: number
  propina: number
  total: number
}

const TARIFAS = new Set(["0", "2", "3", "4", "5", "6", "7", "8", "10"])

export function texto(valor: unknown, tope: number) {
  return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, tope)
}

export function dinero(valor: unknown) {
  const n = Number(valor)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

export function itemProforma(row: unknown): ItemProforma | null {
  if (!row || typeof row !== "object") return null
  const fila = row as Record<string, unknown>
  const codigoPorcentaje = String(fila.codigoPorcentaje ?? "")
  if (!TARIFAS.has(codigoPorcentaje)) return null
  const cant = Number(fila.cant)
  const pUnit = Number(fila.pUnit)
  if (!Number.isFinite(cant) || cant <= 0 || cant > 100000) return null
  if (!Number.isFinite(pUnit) || pUnit < 0 || pUnit > 100000000) return null
  const descPorc = Math.min(100, Math.max(0, Number(fila.descPorc) || 0))
  return {
    codigo: texto(fila.codigo, 40),
    descripcion: texto(fila.descripcion, 300),
    cant,
    pUnit,
    descPorc,
    codigoPorcentaje,
    ice: Math.max(0, Number(fila.ice) || 0),
    esPlastico: Boolean(fila.esPlastico),
  }
}

function base(items: ItemProforma[], codigo: string) {
  return items
    .filter((item) => item.codigoPorcentaje === codigo)
    .reduce((suma, item) => suma + item.cant * item.pUnit * (1 - item.descPorc / 100), 0)
}

export function totalesProforma(items: ItemProforma[], conPropina: boolean): TotalesProforma {
  const bruto = items.reduce((suma, item) => suma + item.cant * item.pUnit, 0)
  const descuento = items.reduce((suma, item) => suma + item.cant * item.pUnit * item.descPorc / 100, 0)
  const subtotalSin = bruto - descuento
  const base15 = base(items, "4")
  const base5 = base(items, "5")
  const base8 = base(items, "8")
  const propina = conPropina ? subtotalSin * 0.1 : 0
  const iva15 = base15 * 0.15
  const ivaDiferenciado = base5 * 0.05 + base8 * 0.08
  const valorICE = items.reduce((suma, item) => suma + item.ice, 0)
  const valorIRBPNR = items.filter((item) => item.esPlastico).reduce((suma, item) => suma + item.cant * 0.02, 0)
  const total = subtotalSin + iva15 + ivaDiferenciado + valorICE + valorIRBPNR + propina
  return {
    bruto: dinero(bruto),
    descuento: dinero(descuento),
    subtotalSin: dinero(subtotalSin),
    base15: dinero(base15),
    base0: dinero(base(items, "0")),
    baseNoObjeto: dinero(base(items, "6")),
    baseExento: dinero(base(items, "7")),
    baseDiferenciado: dinero(base(items, "10") + base(items, "5") + base(items, "8") + base(items, "2") + base(items, "3")),
    valorICE: dinero(valorICE),
    valorIRBPNR: dinero(valorIRBPNR),
    iva15: dinero(iva15),
    ivaDiferenciado: dinero(ivaDiferenciado),
    propina: dinero(propina),
    total: dinero(total),
  }
}

export function numeroProforma(numero: number) {
  return String(numero).padStart(9, "0")
}

export function correosDe(valor: unknown) {
  const vistos = new Set<string>()
  return String(valor || "")
    .split(/[;,\s]+/)
    .map((parte) => parte.trim().toLowerCase())
    .filter((parte) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parte) && !vistos.has(parte) && vistos.add(parte))
    .slice(0, 5)
}
