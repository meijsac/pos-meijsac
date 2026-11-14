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

function redondear(n: number, decimales: number) {
  if (!Number.isFinite(n)) n = 0
  const negativo = n < 0
  const ajustado = Math.abs(n) * (10 ** decimales) + 1e-8
  const entero = Math.floor(ajustado)
  const resultado = ajustado - entero >= 0.5 ? entero + 1 : entero
  const texto = String(resultado).padStart(decimales + 1, "0")
  const ent = texto.slice(0, texto.length - decimales)
  const frac = texto.slice(texto.length - decimales)
  const cuerpo = decimales ? `${ent}.${frac}` : ent
  return negativo && resultado !== 0 ? `-${cuerpo}` : cuerpo
}

function dinero(n: number) {
  return redondear(n, 2)
}

function hastaSeis(n: number) {
  return redondear(n, 6).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
}

function aEscala(texto: string, decimales: number) {
  const negativo = texto.startsWith("-")
  const [ent, frac = ""] = texto.replace("-", "").split(".")
  const valor = BigInt(ent || "0") * (10n ** BigInt(decimales)) + BigInt((frac + "0".repeat(decimales)).slice(0, decimales) || "0")
  return negativo ? -valor : valor
}

function mitadArriba(valor: bigint, divisor: bigint) {
  const negativo = valor < 0n
  const absoluto = negativo ? -valor : valor
  const cociente = absoluto / divisor
  const sube = absoluto % divisor * 2n >= divisor
  const resultado = sube ? cociente + 1n : cociente
  return negativo ? -resultado : resultado
}

function textoCentavos(centavos: bigint) {
  const negativo = centavos < 0n
  const absoluto = negativo ? -centavos : centavos
  return `${negativo ? "-" : ""}${absoluto / 100n}.${(absoluto % 100n).toString().padStart(2, "0")}`
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

  const grupos: Record<string, { base: bigint; tarifa: number }> = {}
  let totalDescuento = 0n
  let totalSin = 0n
  const detalles = items.map((item: any) => {
    const cant = Number(item.cant ?? item.cantidad ?? 0)
    const precio = Number(item.pUnit ?? item.precioUnitario ?? 0)
    const cantTxt = redondear(cant, 6)
    const precioTxt = redondear(precio, 6)
    const producto = aEscala(cantTxt, 6) * aEscala(precioTxt, 6)
    const porc = aEscala(redondear(Number(item.descPorc || 0), 4), 4)
    const descuento = mitadArriba(producto * porc, 10000000000000000n)
    const base = mitadArriba(producto - descuento * 10000000000n, 10000000000n)
    const auxiliar = String(item.codigoAuxiliar || "").trim()
    const esTransporte = auxiliar === "H492001" || auxiliar === "H492002"
    const cod = esTransporte ? "0" : String(item.codigoPorcentaje ?? "4")
    const tarifa = esTransporte ? 0 : (tarifasEnMemoria()[cod] ?? 0)
    const iva = cod === "6" || cod === "7" || esTransporte ? 0n : mitadArriba(base * aEscala(redondear(tarifa, 2), 2), 10000n)
    totalDescuento += descuento
    totalSin += base
    if (!grupos[cod]) grupos[cod] = { base: 0n, tarifa }
    grupos[cod].base += base
    return `<detalle><codigoPrincipal>${xml(item.codigo || item.codigoPrincipal || "001")}</codigoPrincipal>${auxiliar ? `<codigoAuxiliar>${xml(auxiliar)}</codigoAuxiliar>` : ""}<descripcion>${xml(item.descripcion)}</descripcion><cantidad>${hastaSeis(cant)}</cantidad><precioUnitario>${hastaSeis(precio)}</precioUnitario><descuento>${textoCentavos(descuento)}</descuento><precioTotalSinImpuesto>${textoCentavos(base)}</precioTotalSinImpuesto><impuestos><impuesto><codigo>2</codigo><codigoPorcentaje>${xml(cod)}</codigoPorcentaje><tarifa>${dinero(tarifa)}</tarifa><baseImponible>${textoCentavos(base)}</baseImponible><valor>${textoCentavos(iva)}</valor></impuesto></impuestos></detalle>`
  }).join("")

  let totalIva = 0n
  const propina = Number(body?.totales?.propina || 0)
  const totalesXml = Object.entries(grupos).map(([cod, g]) => {
    const valor = cod === "6" || cod === "7" ? 0n : mitadArriba(g.base * aEscala(redondear(g.tarifa, 2), 2), 10000n)
    totalIva += valor
    return `<totalImpuesto><codigo>2</codigo><codigoPorcentaje>${cod}</codigoPorcentaje><baseImponible>${textoCentavos(g.base)}</baseImponible><valor>${textoCentavos(valor)}</valor></totalImpuesto>`
  }).join("")
  const propinaCentavos = aEscala(redondear(propina, 2), 2)
  const importe = Number(textoCentavos(totalSin + totalIva + propinaCentavos))

  const listaPagos: Array<[string, number]> = body?.tipo_cobro === "CREDITO"
    ? [["20", importe]]
    : cuadrarPagosSri(body, importe)
  const pagos = (listaPagos.length ? listaPagos : [["01", importe] as [string, number]])
    .map(([codigo, monto]) => `<pago><formaPago>${codigo}</formaPago><total>${dinero(monto)}</total></pago>`)
    .join("")
  const email = String(body?.cliente?.email || "").trim()
  const placa = String(body?.placaVehiculo || "").trim()

  const documento = `<?xml version="1.0" encoding="UTF-8"?><factura id="comprobante" version="1.1.0"><infoTributaria><ambiente>${ambiente}</ambiente><tipoEmision>1</tipoEmision><razonSocial>${xml(razon)}</razonSocial>${comercial ? `<nombreComercial>${xml(comercial)}</nombreComercial>` : ""}<ruc>${ruc}</ruc><claveAcceso>${clave}</claveAcceso><codDoc>01</codDoc><estab>${estab}</estab><ptoEmi>${pto}</ptoEmi><secuencial>${secuencial}</secuencial><dirMatriz>${xml(direccion)}</dirMatriz></infoTributaria><infoFactura><fechaEmision>${fecha}</fechaEmision><dirEstablecimiento>${xml(dirEstablecimiento)}</dirEstablecimiento><obligadoContabilidad>${obligado}</obligadoContabilidad><tipoIdentificacionComprador>${tipoIdentificacion(compradorId, compradorTipo)}</tipoIdentificacionComprador><razonSocialComprador>${xml(comprador)}</razonSocialComprador><identificacionComprador>${xml(compradorId)}</identificacionComprador><totalSinImpuestos>${textoCentavos(totalSin)}</totalSinImpuestos><totalDescuento>${textoCentavos(totalDescuento)}</totalDescuento><totalConImpuestos>${totalesXml}</totalConImpuestos><propina>${dinero(propina)}</propina><importeTotal>${textoCentavos(totalSin + totalIva + propinaCentavos)}</importeTotal><moneda>DOLAR</moneda>${placa ? `<placa>${xml(placa)}</placa>` : ""}<pagos>${pagos}</pagos></infoFactura><detalles>${detalles}</detalles>${email ? `<infoAdicional><campoAdicional nombre="Email">${xml(email)}</campoAdicional></infoAdicional>` : ""}</factura>`

  return { xml: documento, claveAcceso: clave, ambiente, estab, pto, secuencial, fecha }
}
