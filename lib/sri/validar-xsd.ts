import { DOMParser, type Element as XmlElement } from "@xmldom/xmldom"

/**
 * Esquemas que emite este sistema. Cuando el SRI publique otra versión,
 * se cambia aquí la versión y, si cambia el IVA, la tabla TARIFAS_IVA.
 * factura 1.1.0, liquidación 1.1.0, nota de crédito 1.1.0, guía 1.1.0,
 * nota de débito 1.0.0, retención 2.0.0.
 */
const VERSIONES: Record<string, { version: string; codDoc: string }> = {
  factura: { version: "1.1.0", codDoc: "01" },
  liquidacionCompra: { version: "1.1.0", codDoc: "03" },
  notaCredito: { version: "1.1.0", codDoc: "04" },
  notaDebito: { version: "1.0.0", codDoc: "05" },
  guiaRemision: { version: "1.1.0", codDoc: "06" },
  comprobanteRetencion: { version: "2.0.0", codDoc: "07" },
}

export const TARIFAS_IVA: Record<string, number> = {
  "0": 0, "2": 12, "3": 14, "4": 15, "5": 5, "6": 0, "7": 0, "8": 8, "10": 13,
}

const INFO: Record<string, string[]> = {
  factura: ["fechaEmision", "dirEstablecimiento", "obligadoContabilidad", "tipoIdentificacionComprador", "razonSocialComprador", "identificacionComprador", "totalSinImpuestos", "totalDescuento", "totalConImpuestos", "propina", "importeTotal", "moneda", "pagos"],
  liquidacionCompra: ["fechaEmision", "dirEstablecimiento", "obligadoContabilidad", "tipoIdentificacionProveedor", "razonSocialProveedor", "identificacionProveedor", "direccionProveedor", "totalSinImpuestos", "totalDescuento", "totalConImpuestos", "importeTotal", "moneda", "pagos"],
  notaCredito: ["fechaEmision", "dirEstablecimiento", "tipoIdentificacionComprador", "razonSocialComprador", "identificacionComprador", "obligadoContabilidad", "codDocModificado", "numDocModificado", "fechaEmisionDocSustento", "totalSinImpuestos", "valorModificacion", "moneda", "totalConImpuestos", "motivo"],
  notaDebito: ["fechaEmision", "dirEstablecimiento", "tipoIdentificacionComprador", "razonSocialComprador", "identificacionComprador", "obligadoContabilidad", "codDocModificado", "numDocModificado", "fechaEmisionDocSustento", "totalSinImpuestos", "impuestos", "valorTotal", "pagos"],
  guiaRemision: ["dirEstablecimiento", "dirPartida", "razonSocialTransportista", "tipoIdentificacionTransportista", "rucTransportista", "obligadoContabilidad", "fechaIniTransporte", "fechaFinTransporte", "placa"],
  comprobanteRetencion: ["fechaEmision", "dirEstablecimiento", "obligadoContabilidad", "tipoIdentificacionSujetoRetenido", "razonSocialSujetoRetenido", "identificacionSujetoRetenido", "periodoFiscal"],
}

const BLOQUE: Record<string, string> = {
  factura: "infoFactura",
  liquidacionCompra: "infoLiquidacionCompra",
  notaCredito: "infoNotaCredito",
  notaDebito: "infoNotaDebito",
  guiaRemision: "infoGuiaRemision",
  comprobanteRetencion: "infoCompRetencion",
}

function elementos(nodo: XmlElement) {
  const lista: XmlElement[] = []
  for (let i = 0; i < nodo.childNodes.length; i++) {
    const hijo = nodo.childNodes[i]
    if (hijo.nodeType === 1) lista.push(hijo as XmlElement)
  }
  return lista
}

function uno(nodo: XmlElement | undefined, nombre: string) {
  if (!nodo) return undefined
  return elementos(nodo).find((hijo) => hijo.nodeName === nombre)
}

function texto(nodo: XmlElement | undefined) {
  return String(nodo?.textContent || "").trim()
}

function exigir(nodo: XmlElement | undefined, campos: string[], donde: string) {
  if (!nodo) return `Falta ${donde}`
  for (const campo of campos) {
    if (!texto(uno(nodo, campo))) return `Falta ${campo} en ${donde}`
  }
  return ""
}

function fecha(valor: string) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(valor)
}

function dinero(valor: string) {
  return /^\d+(\.\d{1,2})?$/.test(valor)
}

function revisarIva(nodo: XmlElement): string {
  const bloques = elementos(nodo).filter((hijo) => hijo.nodeName === "impuesto" || hijo.nodeName === "totalImpuesto" || hijo.nodeName === "impuestoDocSustento")
  for (const bloque of bloques) {
    const codigo = texto(uno(bloque, "codigo") || uno(bloque, "codImpuestoDocSustento"))
    if (codigo !== "2") continue
    const porcentaje = texto(uno(bloque, "codigoPorcentaje"))
    if (!Object.prototype.hasOwnProperty.call(TARIFAS_IVA, porcentaje)) return `El código de IVA ${porcentaje || "(vacío)"} no está en la tabla vigente`
    const tarifa = texto(uno(bloque, "tarifa"))
    if (tarifa && Math.abs(Number(tarifa) - TARIFAS_IVA[porcentaje]) > 0.001) {
      return `La tarifa ${tarifa} no corresponde al código de IVA ${porcentaje}`
    }
  }
  for (const hijo of elementos(nodo)) {
    const anidado = revisarIva(hijo)
    if (anidado) return anidado
  }
  return ""
}

function revisarDetalle(raiz: XmlElement, nombre: string) {
  if (nombre === "guiaRemision" || nombre === "comprobanteRetencion" || nombre === "notaDebito") return ""
  const detalles = uno(raiz, "detalles")
  const filas = detalles ? elementos(detalles).filter((hijo) => hijo.nodeName === "detalle") : []
  if (!filas.length) return "El comprobante no tiene detalles"
  for (const fila of filas) {
    const codigo = texto(uno(fila, "codigoPrincipal") || uno(fila, "codigoInterno"))
    if (!codigo) return "Un detalle no tiene código"
    if (!texto(uno(fila, "descripcion"))) return "Un detalle no tiene descripción"
    if (!dinero(texto(uno(fila, "cantidad")))) return "Una cantidad no tiene el formato del esquema"
    if (!uno(fila, "impuestos")) return "Un detalle no tiene impuestos"
  }
  return ""
}

export function validarEsquemaSri(xml: string) {
  const fallos: string[] = []
  let doc
  try {
    doc = new DOMParser({
      onError: (nivel, mensaje) => {
        if (nivel !== "warning") fallos.push(String(mensaje))
      },
    }).parseFromString(String(xml || ""), "text/xml")
  } catch {
    return "El XML no está bien formado"
  }
  if (fallos.length || !doc) return "El XML no está bien formado"
  const raiz = doc.documentElement
  if (!raiz) return "El XML no tiene comprobante"
  const regla = VERSIONES[raiz.nodeName]
  if (!regla) return `El comprobante ${raiz.nodeName || ""} no tiene esquema cargado`
  if (raiz.getAttribute("version") !== regla.version) {
    return `La versión ${raiz.getAttribute("version") || "(vacía)"} no es la vigente ${regla.version} de ${raiz.nodeName}`
  }
  const info = uno(raiz, "infoTributaria")
  const faltaInfo = exigir(info, ["ambiente", "tipoEmision", "razonSocial", "ruc", "claveAcceso", "codDoc", "estab", "ptoEmi", "secuencial", "dirMatriz"], "infoTributaria")
  if (faltaInfo) return faltaInfo
  if (!info) return "Falta infoTributaria"
  const ambiente = texto(uno(info, "ambiente"))
  if (ambiente !== "1" && ambiente !== "2") return "El ambiente del comprobante no es 1 ni 2"
  if (texto(uno(info, "tipoEmision")) !== "1") return "El tipo de emisión no es el normal"
  if (!/^\d{13}$/.test(texto(uno(info, "ruc")))) return "El RUC del emisor no tiene 13 dígitos"
  if (!/^\d{49}$/.test(texto(uno(info, "claveAcceso")))) return "La clave de acceso no tiene 49 dígitos"
  if (texto(uno(info, "codDoc")) !== regla.codDoc) return "El código del comprobante no coincide con el esquema"
  if (!/^\d{3}$/.test(texto(uno(info, "estab"))) || !/^\d{3}$/.test(texto(uno(info, "ptoEmi")))) return "El establecimiento o el punto de emisión no tiene 3 dígitos"
  if (!/^\d{9}$/.test(texto(uno(info, "secuencial")))) return "El secuencial no tiene 9 dígitos"
  const bloque = uno(raiz, BLOQUE[raiz.nodeName])
  const faltaBloque = exigir(bloque, INFO[raiz.nodeName], BLOQUE[raiz.nodeName])
  if (faltaBloque) return faltaBloque
  const emision = texto(uno(bloque, "fechaEmision"))
  if (emision && !fecha(emision)) return "La fecha de emisión no tiene el formato dd/mm/aaaa"
  const obligado = texto(uno(bloque, "obligadoContabilidad"))
  if (obligado && obligado !== "SI" && obligado !== "NO") return "Obligado a llevar contabilidad debe ser SI o NO"
  const moneda = texto(uno(bloque, "moneda"))
  if (moneda && moneda !== "DOLAR") return "La moneda del esquema es DOLAR"
  for (const campo of ["totalSinImpuestos", "totalDescuento", "propina", "importeTotal", "valorModificacion", "valorTotal"]) {
    const valor = texto(uno(bloque, campo))
    if (valor && !dinero(valor)) return `${campo} no tiene el formato del esquema`
  }
  const iva = revisarIva(raiz)
  if (iva) return iva
  const detalle = revisarDetalle(raiz, raiz.nodeName)
  if (detalle) return detalle
  if (raiz.nodeName === "guiaRemision") {
    const destinatarios = uno(raiz, "destinatarios")
    const lista = destinatarios ? elementos(destinatarios).filter((hijo) => hijo.nodeName === "destinatario") : []
    if (!lista.length) return "La guía no tiene destinatarios"
  }
  if (raiz.nodeName === "comprobanteRetencion" && !uno(raiz, "docsSustento")) return "La retención no tiene documento de sustento"
  if (raiz.nodeName === "notaDebito") {
    const motivos = uno(raiz, "motivos")
    const lista = motivos ? elementos(motivos).filter((hijo) => hijo.nodeName === "motivo") : []
    if (!lista.length) return "La nota de débito no tiene motivos"
  }
  return ""
}
