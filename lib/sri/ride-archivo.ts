import { htmlGuiaRemision, htmlRide } from "@/lib/sri/ride-html"

const ANIOS_CONSERVACION = 7

const WIN: Record<string, string> = {
  á: "\\341", é: "\\351", í: "\\355", ó: "\\363", ú: "\\372",
  Á: "\\301", É: "\\311", Í: "\\315", Ó: "\\323", Ú: "\\332",
  ñ: "\\361", Ñ: "\\321", ü: "\\374", Ü: "\\334", "¿": "\\277", "¡": "\\241",
}

export function conservarHasta(fecha: string) {
  const partes = String(fecha || "").match(/(\d{2})\/(\d{2})\/(\d{4})/)
  const base = partes ? new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1])) : new Date()
  if (Number.isNaN(base.getTime())) base.setTime(Date.now())
  base.setFullYear(base.getFullYear() + ANIOS_CONSERVACION)
  return base.toISOString().slice(0, 10)
}

function pdfTexto(valor: unknown) {
  return String(valor ?? "").normalize("NFC").split("").map((char) => {
    if (WIN[char]) return WIN[char]
    if (char === "\\") return "\\\\"
    if (char === "(" || char === ")") return `\\${char}`
    const code = char.charCodeAt(0)
    return code >= 32 && code <= 126 ? char : " "
  }).join("").slice(0, 110)
}

function lineasDe(body: Record<string, any>, fecha: string) {
  const emisor = body.configEmisor || {}
  const cliente = body.cliente || {}
  const totales = body.totales || {}
  const numero = [body.establecimiento, body.secuencial].filter(Boolean).join("-")
  const lineas = [
    "RIDE - COMPROBANTE ELECTRONICO",
    `Emisor: ${emisor.razon || ""}`,
    `RUC: ${emisor.ruc || ""}`,
    `Numero: ${numero}`,
    `Clave de acceso: ${String(body.claveAcceso || "").replace(/\D/g, "")}`,
    `Fecha de autorizacion: ${fecha}`,
    `Ambiente: ${String(body.claveAcceso || "")[23] === "2" ? "PRODUCCION" : "PRUEBAS"}`,
    `Cliente: ${cliente.razon || body.clienteNombre || ""}`,
    `Identificacion: ${cliente.identificacion || ""}`,
    `Fecha de emision: ${body.fechaEmisionFormato || ""}`,
    `Forma de pago: ${body.formaPago || ""}`,
  ]
  const items = Array.isArray(body.items) ? body.items : []
  for (const item of items) {
    lineas.push(`${item.cant ?? item.cantidad ?? ""}  ${item.descripcion || ""}  ${item.total ?? item.pUnit ?? ""}`)
  }
  lineas.push(`Subtotal: ${totales.subtotalSin ?? ""}`)
  lineas.push(`IVA: ${totales.iva15 ?? ""}`)
  lineas.push(`Total: ${totales.total ?? ""}`)
  return lineas
}

export function pdfRide(body: Record<string, any>, fecha: string) {
  const lineas = lineasDe(body, fecha).map(pdfTexto)
  const porPagina = 46
  const paginas: string[][] = []
  for (let i = 0; i < lineas.length; i += porPagina) paginas.push(lineas.slice(i, i + porPagina))
  if (!paginas.length) paginas.push(["RIDE"])
  const objetos: string[] = []
  const kids: string[] = []
  objetos.push("<< /Type /Catalog /Pages 2 0 R >>")
  objetos.push("")
  let id = 3
  for (const pagina of paginas) {
    const contenidoId = id + 1
    kids.push(`${id} 0 R`)
    const comandos = ["BT", "/F1 10 Tf", "40 800 Td", "14 TL"]
    pagina.forEach((linea, indice) => {
      if (indice) comandos.push("T*")
      comandos.push(`(${linea}) Tj`)
    })
    comandos.push("ET")
    const stream = comandos.join("\n")
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents ${contenidoId} 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>`)
    objetos.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`)
    id += 2
  }
  objetos[1] = `<< /Type /Pages /Count ${paginas.length} /Kids [${kids.join(" ")}] >>`
  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  objetos.forEach((objeto, indice) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${indice + 1} 0 obj\n${objeto}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`
  pdf += `trailer << /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, "latin1")
}

export function htmlRespaldo(body: Record<string, any>, fecha: string) {
  const emisor = body.configEmisor || {}
  const cliente = body.cliente || {}
  const totales = body.totales || {}
  const clave = String(body.claveAcceso || "").replace(/\D/g, "")
  const numero = [body.establecimiento, body.secuencial].filter(Boolean).join("-")
  if (String(body.tipoComprobante || body.codDoc || "") === "06") {
    const destinos = (Array.isArray(body.destinatarios) ? body.destinatarios : []).map((dest: Record<string, any>) => ({
      identificacion: dest.identificacionDestinatario,
      razon: dest.razonSocialDestinatario,
      direccion: dest.dirDestinatario,
      motivo: dest.motivoTraslado,
      documento: dest.codDocSustento === "04" ? "Nota de crédito" : dest.codDocSustento === "03" ? "Liquidación" : "Factura",
      numero: dest.numDocSustento,
      fecha: dest.fechaEmisionDocSustento,
      productos: (Array.isArray(dest.productos) ? dest.productos : []).map((item: Record<string, any>) => ({
        codigo: item.codigoInterno || item.codigo,
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad ?? item.cantidadEnviar ?? 0),
      })),
    }))
    return htmlGuiaRemision({
      razonSocial: emisor.razon || "",
      nombreComercial: emisor.comercial || "",
      ruc: emisor.ruc || "",
      numero,
      claveAcceso: clave,
      fechaAutorizacion: fecha,
      ambiente: clave[23] === "2" ? "PRODUCCIÓN" : "PRUEBAS",
      transportista: body.transportista?.razon || "",
      placa: body.transportista?.placa || "",
      inicio: body.fechaIniTransporte || "",
      fin: body.fechaFinTransporte || "",
      destinatarios: destinos,
      dirMatriz: emisor.matriz || "",
      obligado: emisor.obligado || "",
      regimen: emisor.regimen || "",
      fechaEmision: body.fechaEmisionFormato || "",
      identificacionTransportista: body.transportista?.identificacion || "",
      partida: body.dirPartida || "",
    })
  }
  return htmlRide({
    razonSocial: emisor.razon || "",
    nombreComercial: emisor.comercial || "",
    ruc: emisor.ruc || "",
    dirMatriz: emisor.matriz || "",
    dirSucursal: emisor.sucursal || "",
    obligado: emisor.obligado || "",
    regimen: emisor.regimen || "",
    logoUrl: emisor.logo || "",
    numeroFactura: numero,
    claveAcceso: clave,
    fechaAutorizacion: fecha,
    ambiente: clave[23] === "2" ? "PRODUCCIÓN" : "PRUEBAS",
    cliente: cliente.razon || body.clienteNombre || "",
    identificacion: cliente.identificacion || "",
    fechaEmision: body.fechaEmisionFormato || "",
    email: cliente.email || "",
    direccionCliente: cliente.direccion || "",
    formaPago: body.formaPago || "",
    items: Array.isArray(body.items) ? body.items : [],
    base15: totales.base15,
    base0: totales.base0,
    baseNoObjeto: totales.baseNoObjeto,
    baseExento: totales.baseExento,
    subtotalSin: totales.subtotalSin,
    descuento: totales.descuento,
    ice: totales.valorICE,
    iva: totales.iva15,
    propina: totales.propina,
    total: totales.total,
    vuelto: Number(body.pagos?.vuelto || body.vuelto || 0),
    recibido: Number(body.pagos?.efectivoRecibido || body.efectivoRecibido || body.pagos?.entregado || 0),
  })
}
