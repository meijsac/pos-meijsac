import { claveAcceso49 } from "@/lib/sri/clave"
import { codigoAmbiente } from "@/lib/sri/ambiente"
import { tarifasEnMemoria } from "@/lib/sri/catalogos-base"

export class FaltanDatosSri extends Error {
  faltantes: string[]
  constructor(faltantes: string[]) {
    super(faltantes.join(". "))
    this.faltantes = faltantes
  }
}

import { sanitizarTextoXml } from "@/lib/sri/sanitizar"

function xml(valor: unknown) {
  return sanitizarTextoXml(valor)
}

function dinero(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2)
}

function fechaSri(valor: unknown) {
  const texto = String(valor || "")
  const conBarra = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (conBarra) return `${conBarra[1].padStart(2, "0")}/${conBarra[2].padStart(2, "0")}/${conBarra[3]}`
  const iso = texto.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export const ID_CONSUMIDOR_FINAL = "9999999999999"

function codigoDocumento(cliente: any) {
  const c = String(cliente?.tipoDoc || cliente?.tipoId || "").replace(/\D/g, "").padStart(2, "0")
  if (c === "04" || c === "05" || c === "06" || c === "08") return c
  return "06"
}

export function normalizarComprador(cliente: any) {
  const razon = String(cliente?.razon || "").trim()
  const digitos = String(cliente?.identificacion || "").replace(/\D/g, "")
  const idFinal = digitos === ID_CONSUMIDOR_FINAL || /^9{13,}$/.test(digitos)
  const nombreFinal = razon.toUpperCase() === "CONSUMIDOR FINAL"
  if (idFinal || (nombreFinal && digitos.length !== 10 && digitos.length !== 13)) {
    return { ...cliente, tipoDoc: "07", tipoId: "07", identificacion: ID_CONSUMIDOR_FINAL, razon: "CONSUMIDOR FINAL" }
  }
  const tipo = digitos.length === 10 ? "05" : digitos.length === 13 ? "04" : codigoDocumento(cliente)
  return { ...cliente, tipoDoc: tipo, tipoId: tipo, identificacion: digitos, razon }
}

function tipoIdentificacion(id: string, codigo?: unknown) {
  const limpio = id.replace(/\D/g, "")
  if (limpio === ID_CONSUMIDOR_FINAL || /^9{13,}$/.test(limpio)) return "07"
  if (limpio.length === 10) return "05"
  if (limpio.length === 13) return "04"
  const c = String(codigo ?? "").replace(/\D/g, "").padStart(2, "0")
  if (c === "04" || c === "05" || c === "06" || c === "08") return c
  return "06"
}

function montoPago(valor: unknown) {
  const n = Number(valor)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 100) / 100
}

/** Tabla 24: 01 efectivo, 16 débito, 19 crédito, 20 transferencia. El efectivo se informa neto, sin el vuelto. */
export function cuadrarPagosSri(body: any, importe: number): Array<[string, number]> {
  const vuelto = montoPago(body?.pagos?.vuelto ?? body?.vuelto)
  let efectivo = montoPago(body?.pagos?.efectivo)
  if (vuelto > 0) efectivo = Math.max(0, Math.round((efectivo - vuelto) * 100) / 100)
  const lineas: Array<[string, number]> = [
    ["01", efectivo],
    ["15", montoPago(body?.pagos?.compensacion)],
    ["16", montoPago(body?.pagos?.debito)],
    ["17", montoPago(body?.pagos?.dineroElec)],
    ["18", montoPago(body?.pagos?.prepago)],
    ["19", montoPago(body?.pagos?.tarjeta)],
    ["20", montoPago(body?.pagos?.redBancaria)],
    ["21", montoPago(body?.pagos?.endoso)],
  ].filter((fila): fila is [string, number] => fila[1] > 0)
  if (!lineas.length) return [["01", Math.round(importe * 100) / 100]]
  const suma = lineas.reduce((total, fila) => total + fila[1], 0)
  const diff = Math.round((importe - suma) * 100) / 100
  if (Math.abs(diff) >= 0.01) {
    const idx = Math.max(0, lineas.findIndex((fila) => fila[0] === "01"))
    const ajustado = Math.round((lineas[idx][1] + diff) * 100) / 100
    if (ajustado > 0) lineas[idx][1] = ajustado
    else lineas.splice(idx, 1)
  }
  return lineas.length ? lineas : [["01", Math.round(importe * 100) / 100]]
}

export function armarXmlFactura(empresa: {
  ruc?: string | null
  razonSocial?: string | null
  nombreComercial?: string | null
  direccion?: string | null
  datosRegistro?: unknown
}, body: any) {
  const extra = empresa.datosRegistro && typeof empresa.datosRegistro === "object" && !Array.isArray(empresa.datosRegistro)
    ? empresa.datosRegistro as Record<string, unknown>
    : {}
  const ruc = String(empresa.ruc || "").replace(/\D/g, "")
  const razon = String(empresa.razonSocial || body?.configEmisor?.razon || "").trim()
  const direccion = String(extra.dirMatriz || empresa.direccion || body?.configEmisor?.matriz || "").trim()
  const obligadoRaw = String(extra.obligadoConta || extra.obligado || body?.configEmisor?.obligado || "").trim().toUpperCase()
  const faltantes: string[] = []
  if (ruc.length !== 13) faltantes.push("Falta el RUC del emisor (13 dígitos)")
  if (!razon) faltantes.push("Falta la razón social del emisor")
  if (!direccion) faltantes.push("Falta la dirección matriz")
  if (obligadoRaw !== "SI" && obligadoRaw !== "NO") faltantes.push("Falta obligado a llevar contabilidad (SI o NO)")
  const items = Array.isArray(body?.items) ? body.items : []
  if (items.length === 0) faltantes.push("La factura no tiene ítems")
  const compradorNormal = normalizarComprador(body?.cliente)
  if (body) body.cliente = compradorNormal
  const compradorTipo = compradorNormal?.tipoDoc || compradorNormal?.tipoId
  const compradorId = String(compradorNormal?.identificacion || "").trim()
  const comprador = String(compradorNormal?.razon || "").trim()
  if (!compradorId || !comprador) faltantes.push("Faltan la identificación y la razón social del comprador")
  if (faltantes.length) throw new FaltanDatosSri(faltantes)

  const serie = String(body?.establecimiento || (body?.estadoSRI === "BORRADOR" ? "001-001" : "")).trim()
  if (!/^\d{3}-\d{3}$/.test(serie)) faltantes.push("Falta el punto de emisión activo de Configuración")
  const secuencial = String(body?.secuencial || "").replace(/\D/g, "").padStart(9, "0").slice(-9)
  if (!secuencial || secuencial === "000000000") faltantes.push("Falta el secuencial del punto activo")
  if (faltantes.length) throw new FaltanDatosSri(faltantes)
  const [estabRaw, ptoRaw] = serie.split("-")
  let estab = estabRaw
  let pto = ptoRaw
  const fecha = fechaSri(body?.fechaEmisionFormato || body?.fechaEmision)
  const ambiente = codigoAmbiente(extra.ambiente || extra.ambienteCodigo || body?.configEmisor?.ambiente)
  const obligado = obligadoRaw === "SI" ? "SI" : "NO"
  const comercial = String(empresa.nombreComercial || "").trim()
  const dirEstablecimiento = String(
    (body?.tipoEstablecimiento === "sucursal" ? body?.cliente?.direccion : "") ||
    extra.dirEstablecimiento ||
    direccion
  ).trim() || direccion

  const clave = claveAcceso49({
    fecha: fecha.replace(/\D/g, ""),
    ruc,
    ambiente,
    establecimiento: estab,
    puntoEmision: pto,
    secuencial,
  })

  const grupos: Record<string, { base: number; valor: number; tarifa: number }> = {}
  let totalDescuento = 0
  const detalles = items.map((item: any) => {
    const cant = Number(item.cant ?? item.cantidad ?? 0)
    const precio = Number(item.pUnit ?? item.precioUnitario ?? 0)
    const desc = cant * precio * (Number(item.descPorc || 0) / 100)
    const base = cant * precio - desc
    const auxiliar = String(item.codigoAuxiliar || "").trim()
    const esTransporte = auxiliar === "H492001" || auxiliar === "H492002"
    const cod = esTransporte ? "0" : String(item.codigoPorcentaje ?? "4")
    const tarifa = esTransporte ? 0 : (tarifasEnMemoria()[cod] ?? 0)
    const iva = cod === "6" || cod === "7" || esTransporte ? 0 : base * (tarifa / 100)
    totalDescuento += desc
    if (!grupos[cod]) grupos[cod] = { base: 0, valor: 0, tarifa }
    grupos[cod].base += base
    grupos[cod].valor += iva
    return `<detalle><codigoPrincipal>${xml(item.codigo || item.codigoPrincipal || "001")}</codigoPrincipal>${auxiliar ? `<codigoAuxiliar>${xml(auxiliar)}</codigoAuxiliar>` : ""}<descripcion>${xml(item.descripcion)}</descripcion><cantidad>${dinero(cant)}</cantidad><precioUnitario>${dinero(precio)}</precioUnitario><descuento>${dinero(desc)}</descuento><precioTotalSinImpuesto>${dinero(base)}</precioTotalSinImpuesto><impuestos><impuesto><codigo>2</codigo><codigoPorcentaje>${xml(cod)}</codigoPorcentaje><tarifa>${dinero(tarifa)}</tarifa><baseImponible>${dinero(base)}</baseImponible><valor>${dinero(iva)}</valor></impuesto></impuestos></detalle>`
  }).join("")

  const totalSin = Object.values(grupos).reduce((s, g) => s + g.base, 0)
  const totalIva = Object.values(grupos).reduce((s, g) => s + g.valor, 0)
  const propina = Number(body?.totales?.propina || 0)
  const importe = totalSin + totalIva + propina
  const totalesXml = Object.entries(grupos).map(([cod, g]) => `<totalImpuesto><codigo>2</codigo><codigoPorcentaje>${cod}</codigoPorcentaje><baseImponible>${dinero(g.base)}</baseImponible><valor>${dinero(g.valor)}</valor></totalImpuesto>`).join("")

  const listaPagos: Array<[string, number]> = body?.tipo_cobro === "CREDITO"
    ? [["20", importe]]
    : cuadrarPagosSri(body, importe)
  const pagos = (listaPagos.length ? listaPagos : [["01", importe] as [string, number]])
    .map(([codigo, monto]) => `<pago><formaPago>${codigo}</formaPago><total>${dinero(monto)}</total></pago>`)
    .join("")
  const email = String(body?.cliente?.email || "").trim()
  const placa = String(body?.placaVehiculo || "").trim()

  const documento = `<?xml version="1.0" encoding="UTF-8"?><factura id="comprobante" version="1.1.0"><infoTributaria><ambiente>${ambiente}</ambiente><tipoEmision>1</tipoEmision><razonSocial>${xml(razon)}</razonSocial>${comercial ? `<nombreComercial>${xml(comercial)}</nombreComercial>` : ""}<ruc>${ruc}</ruc><claveAcceso>${clave}</claveAcceso><codDoc>01</codDoc><estab>${estab}</estab><ptoEmi>${pto}</ptoEmi><secuencial>${secuencial}</secuencial><dirMatriz>${xml(direccion)}</dirMatriz></infoTributaria><infoFactura><fechaEmision>${fecha}</fechaEmision><dirEstablecimiento>${xml(dirEstablecimiento)}</dirEstablecimiento><obligadoContabilidad>${obligado}</obligadoContabilidad><tipoIdentificacionComprador>${tipoIdentificacion(compradorId, compradorTipo)}</tipoIdentificacionComprador><razonSocialComprador>${xml(comprador)}</razonSocialComprador><identificacionComprador>${xml(compradorId)}</identificacionComprador><totalSinImpuestos>${dinero(totalSin)}</totalSinImpuestos><totalDescuento>${dinero(totalDescuento)}</totalDescuento><totalConImpuestos>${totalesXml}</totalConImpuestos><propina>${dinero(propina)}</propina><importeTotal>${dinero(importe)}</importeTotal><moneda>DOLAR</moneda>${placa ? `<placa>${xml(placa)}</placa>` : ""}<pagos>${pagos}</pagos></infoFactura><detalles>${detalles}</detalles>${email ? `<infoAdicional><campoAdicional nombre="Email">${xml(email)}</campoAdicional></infoAdicional>` : ""}</factura>`

  return { xml: documento, claveAcceso: clave, ambiente, estab, pto, secuencial, fecha }
}
