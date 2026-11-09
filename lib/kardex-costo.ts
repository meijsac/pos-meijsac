export type MetodoCosteo = "PROMEDIO" | "PEPS" | "UEPS"

export type MovimientoCosto = {
  id: string
  fecha: string
  sucursal: string
  cantidadEntrada: number
  cantidadSalida: number
  costoEntrada: number
}

export type FilaCosto = MovimientoCosto & {
  saldoCantidad: number
  costoUnitario: number
  costoPromedio: number
  saldoValor: number
}

type Capa = { cant: number; costo: number }

function redondear(n: number) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6
}

export function calcularKardex<T extends MovimientoCosto>(movs: T[], metodo: MetodoCosteo, sucursal?: string): (T & Omit<FilaCosto, keyof MovimientoCosto>)[] {
  const ordenados = [...movs]
    .filter((m) => !sucursal || m.sucursal === sucursal)
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime() || a.id.localeCompare(b.id))
  const capas: Capa[] = []
  let saldoCant = 0
  let saldoValor = 0
  let promedio = 0
  return ordenados.map((m) => {
    const entra = Number(m.cantidadEntrada) || 0
    const sale = Number(m.cantidadSalida) || 0
    let costoUnit = Number(m.costoEntrada) || 0
    if (entra > 0) {
      const costoIn = costoUnit
      saldoCant = redondear(saldoCant + entra)
      saldoValor = redondear(saldoValor + entra * costoIn)
      promedio = saldoCant > 0 ? redondear(saldoValor / saldoCant) : 0
      if (metodo !== "PROMEDIO") capas.push({ cant: entra, costo: costoIn })
      costoUnit = costoIn
    }
    if (sale > 0) {
      if (metodo === "PROMEDIO") {
        costoUnit = promedio
        saldoValor = redondear(saldoValor - sale * costoUnit)
      } else {
        let restante = sale
        let valor = 0
        const tomar = () => (metodo === "PEPS" ? capas[0] : capas[capas.length - 1])
        while (restante > 0.0000001 && capas.length) {
          const capa = tomar()
          const usar = Math.min(capa.cant, restante)
          valor += usar * capa.costo
          capa.cant = redondear(capa.cant - usar)
          restante = redondear(restante - usar)
          if (capa.cant <= 0.0000001) {
            if (metodo === "PEPS") capas.shift()
            else capas.pop()
          }
        }
        costoUnit = sale > 0 ? redondear(valor / sale) : 0
        saldoValor = redondear(saldoValor - valor)
      }
      saldoCant = redondear(saldoCant - sale)
      if (saldoCant <= 0.0000001) {
        saldoCant = 0
        saldoValor = 0
        promedio = 0
        capas.length = 0
      } else promedio = redondear(saldoValor / saldoCant)
    }
    return { ...m, saldoCantidad: saldoCant, costoUnitario: redondear(costoUnit), costoPromedio: promedio, saldoValor: redondear(saldoValor) }
  })
}

export function costoParaSalida(movs: MovimientoCosto[], metodo: MetodoCosteo, sucursal: string, cantidad: number) {
  const historial = calcularKardex(movs, metodo, sucursal)
  const saldo = historial.length ? historial[historial.length - 1].saldoCantidad : 0
  if (cantidad <= 0 || saldo + 0.0000001 < cantidad) return { ok: false, costoUnitario: 0, saldo }
  const simulado = calcularKardex(
    [...movs, { id: "SIM", fecha: new Date(8640000000000000).toISOString(), sucursal, cantidadEntrada: 0, cantidadSalida: cantidad, costoEntrada: 0 }],
    metodo,
    sucursal
  )
  return { ok: true, costoUnitario: simulado[simulado.length - 1]?.costoUnitario || 0, saldo }
}
