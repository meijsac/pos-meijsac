import { claveAcceso49 } from "@/lib/sri/clave"
import { codigoAmbiente } from "@/lib/sri/ambiente"

const TARIFAS: Record<string, number> = {
  "0": 0, "2": 12, "3": 14, "4": 15, "5": 5, "6": 0, "7": 0, "8": 8, "10": 13,
}

export class FaltanDatosSri extends Error {
  faltantes: string[]
  constructor(faltantes: string[]) {
    super(faltantes.join(". "))
    this.faltantes = faltantes
  }
}

function xml(valor: unknown) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
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

function tipoIdentificacion(id: string) {
  const limpio = id.replace(/\s/g, "")
  if (limpio === "9999999999999") return "07"
  if (/^\d{13}$/.test(limpio)) return "04"
  if (/^\d{10}$/.test(limpio)) return "05"
  return "06"
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
  const compradorId = String(body?.cliente?.identificacion || "").trim()
  const comprador = String(body?.cliente?.razon || "").trim()
  if (!compradorId || !comprador) faltantes.push("Faltan la identificación y la razón social del comprador")
  if (faltantes.length) throw new FaltanDatosSri(faltantes)

  const serie = String(body?.establecimiento || "001-001")
  const [estabRaw, ptoRaw] = serie.split("-")
  const estab = (estabRaw || "001").replace(/\D/g, "").padStart(3, "0").slice(-3)
  const pto = (ptoRaw || "001").replace(/\D/g, "").padStart(3, "0").slice(-3)
  const secuencial = String(body?.secuencial || "").replace(/\D/g, "").padStart(9, "0").slice(-9)
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
    const cod = String(item.codigoPorcentaje ?? "4")
    const tarifa = TARIFAS[cod] ?? 0
    const iva = cod === "6" || cod === "7" ? 0 : base * (tarifa / 100)
    totalDescuento += desc
    if (!grupos[cod]) grupos[cod] = { base: 0, valor: 0, tarifa }
    grupos[cod].base += base
    grupos[cod].valor += iva
    return `<detalle><codigoPrincipal>${xml(item.codigo || "001")}</codigoPrincipal><descripcion>${xml(item.descripcion)}</descripcion><cantidad>${dinero(cant)}</cantidad><precioUnitario>${dinero(precio)}</precioUnitario><descuento>${dinero(desc)}</descuento><precioTotalSinImpuesto>${dinero(base)}</precioTotalSinImpuesto><impuestos><impuesto><codigo>2</codigo><codigoPorcentaje>${xml(cod)}</codigoPorcentaje><tarifa>${dinero(tarifa)}</tarifa><baseImponible>${dinero(base)}</baseImponible><valor>${dinero(iva)}</valor></impuesto></impuestos></detalle>`
  }).join("")

  const totalSin = Object.values(grupos).reduce((s, g) => s + g.base, 0)
  const totalIva = Object.values(grupos).reduce((s, g) => s + g.valor, 0)
  const propina = Number(body?.totales?.propina || 0)
  const importe = totalSin + totalIva + propina
  const totalesXml = Object.entries(grupos).map(([cod, g]) => `<totalImpuesto><codigo>2</codigo><codigoPorcentaje>${cod}</codigoPorcentaje><baseImponible>${dinero(g.base)}</baseImponible><valor>${dinero(g.valor)}</valor></totalImpuesto>`).join("")

  const montoPago = (valor: unknown) => {
    const n = Number(valor)
    if (!Number.isFinite(n) || n <= 0) return 0
    return Math.round(n * 100) / 100
  }
  const listaPagos: Array<[string, number]> = body?.tipo_cobro === "CREDITO"
    ? [["20", importe]]
    : [
        ["01", montoPago(body?.pagos?.efectivo)],
        ["15", montoPago(body?.pagos?.compensacion)],
        ["16", montoPago(body?.pagos?.debito)],
        ["17", montoPago(body?.pagos?.dineroElec)],
        ["18", montoPago(body?.pagos?.prepago)],
        ["19", montoPago(body?.pagos?.tarjeta)],
        ["20", montoPago(body?.pagos?.redBancaria)],
        ["21", montoPago(body?.pagos?.endoso)],
      ].filter((fila): fila is [string, number] => Number(fila[1]) > 0)
  const pagos = (listaPagos.length ? listaPagos : [["01", importe] as [string, number]])
    .map(([codigo, monto]) => `<pago><formaPago>${codigo}</formaPago><total>${dinero(monto)}</total></pago>`)
    .join("")
  const email = String(body?.cliente?.email || "").trim()

  const documento = `<?xml version="1.0" encoding="UTF-8"?><factura id="comprobante" version="1.1.0"><infoTributaria><ambiente>${ambiente}</ambiente><tipoEmision>1</tipoEmision><razonSocial>${xml(razon)}</razonSocial>${comercial ? `<nombreComercial>${xml(comercial)}</nombreComercial>` : ""}<ruc>${ruc}</ruc><claveAcceso>${clave}</claveAcceso><codDoc>01</codDoc><estab>${estab}</estab><ptoEmi>${pto}</ptoEmi><secuencial>${secuencial}</secuencial><dirMatriz>${xml(direccion)}</dirMatriz></infoTributaria><infoFactura><fechaEmision>${fecha}</fechaEmision><dirEstablecimiento>${xml(dirEstablecimiento)}</dirEstablecimiento><obligadoContabilidad>${obligado}</obligadoContabilidad><tipoIdentificacionComprador>${tipoIdentificacion(compradorId)}</tipoIdentificacionComprador><razonSocialComprador>${xml(comprador)}</razonSocialComprador><identificacionComprador>${xml(compradorId)}</identificacionComprador><totalSinImpuestos>${dinero(totalSin)}</totalSinImpuestos><totalDescuento>${dinero(totalDescuento)}</totalDescuento><totalConImpuestos>${totalesXml}</totalConImpuestos><propina>${dinero(propina)}</propina><importeTotal>${dinero(importe)}</importeTotal><moneda>DOLAR</moneda><pagos>${pagos}</pagos></infoFactura><detalles>${detalles}</detalles>${email ? `<infoAdicional><campoAdicional nombre="Email">${xml(email)}</campoAdicional></infoAdicional>` : ""}</factura>`

  return { xml: documento, claveAcceso: clave, ambiente, estab, pto, secuencial, fecha }
}
