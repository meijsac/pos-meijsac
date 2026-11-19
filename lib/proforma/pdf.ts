import type { ItemProforma, TotalesProforma } from "@/lib/proforma/calculos"

export type EmisorProforma = {
  razon: string
  comercial: string
  ruc: string
  matriz: string
  sucursal: string
  obligado: string
  regimen: string
  email: string
  telefono: string
}

const WIN: Record<string, string> = {
  á: "\\341", é: "\\351", í: "\\355", ó: "\\363", ú: "\\372",
  Á: "\\301", É: "\\311", Í: "\\315", Ó: "\\323", Ú: "\\332",
  ñ: "\\361", Ñ: "\\321", ü: "\\374", Ü: "\\334", "¿": "\\277", "¡": "\\241",
}

function pdfTexto(valor: unknown) {
  return String(valor ?? "").normalize("NFC").slice(0, 90).split("").map((char) => {
    if (WIN[char]) return WIN[char]
    if (char === "\\") return "\\\\"
    if (char === "(" || char === ")") return `\\${char}`
    const code = char.charCodeAt(0)
    return code >= 32 && code <= 126 ? char : " "
  }).join("")
}

function dineroPdf(valor: unknown) {
  const n = Number(valor)
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`
}

function leyendaRegimen(valor: unknown) {
  const texto = String(valor || "").toUpperCase()
  if (texto.includes("POPULAR")) return "CONTRIBUYENTE REGIMEN RIMPE: NEGOCIO POPULAR"
  if (texto.includes("RIMPE") || texto.includes("EMPRENDEDOR")) return "CONTRIBUYENTE REGIMEN RIMPE: EMPRENDEDOR"
  return ""
}

export function pdfProforma(datos: {
  emisor: EmisorProforma
  cliente: { razon: string; identificacion: string; direccion: string; email: string }
  numero: string
  fecha: string
  items: ItemProforma[]
  totales: TotalesProforma
  atendidoPor: string
}) {
  const { emisor, cliente, totales } = datos
  const cmd: string[] = ["0.75 0.8 0.84 RG", "0.12 0.16 0.22 rg"]
  const t = (x: number, y: number, size: number, bold: boolean, valor: unknown) => {
    cmd.push(`BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfTexto(valor)}) Tj ET`)
  }
  const caja = (x: number, y: number, w: number, h: number) => cmd.push(`${x} ${y} ${w} ${h} re S`)
  caja(32, 640, 268, 170)
  caja(308, 640, 256, 170)
  t(40, 790, 11, true, emisor.razon)
  t(40, 774, 9, false, emisor.comercial)
  t(40, 758, 8, false, `Direccion Matriz: ${emisor.matriz}`)
  t(40, 744, 8, false, `Direccion Sucursal: ${emisor.sucursal || emisor.matriz}`)
  t(40, 728, 8, true, `OBLIGADO A LLEVAR CONTABILIDAD: ${emisor.obligado || "NO"}`)
  const leyenda = leyendaRegimen(emisor.regimen)
  if (leyenda) t(40, 712, 7, true, leyenda)
  t(316, 790, 10, true, `R.U.C.: ${emisor.ruc}`)
  t(316, 772, 14, true, "PROFORMA")
  t(316, 754, 10, true, `No. ${datos.numero}`)
  t(316, 730, 8, false, "DOCUMENTO INFORMATIVO")
  t(316, 716, 8, false, "NO ES FACTURA")
  t(316, 702, 8, false, "NO ES COMPROBANTE ELECTRONICO")
  if (datos.atendidoPor) t(316, 684, 8, false, `VENDEDOR: ${datos.atendidoPor}`)
  t(316, 668, 8, false, `Fecha: ${datos.fecha}`)
  caja(32, 548, 532, 80)
  t(40, 610, 8, true, "Razon Social / Nombres y Apellidos:")
  t(230, 610, 8, false, cliente.razon)
  t(40, 594, 8, true, "Identificacion:")
  t(130, 594, 8, false, cliente.identificacion)
  t(300, 594, 8, true, "Fecha:")
  t(400, 594, 8, false, datos.fecha)
  t(40, 578, 8, true, "Direccion:")
  t(100, 578, 8, false, cliente.direccion || "-")
  t(300, 578, 8, true, "Email:")
  t(350, 578, 8, false, cliente.email || "-")
  caja(32, 520, 532, 18)
  t(40, 526, 8, true, "Cod. Principal")
  t(130, 526, 8, true, "Cant.")
  t(190, 526, 8, true, "Descripcion")
  t(390, 526, 8, true, "Precio Unitario")
  t(470, 526, 8, true, "Descuento")
  t(520, 526, 8, true, "Precio Total")
  let y = 500
  const visibles = datos.items.slice(0, 12)
  for (const item of visibles) {
    const desc = item.cant * item.pUnit * item.descPorc / 100
    const total = item.cant * item.pUnit - desc
    t(40, y, 8, false, item.codigo)
    t(130, y, 8, false, item.cant.toFixed(2))
    t(190, y, 8, false, item.descripcion)
    t(400, y, 8, false, dineroPdf(item.pUnit))
    t(475, y, 8, false, dineroPdf(desc))
    t(525, y, 8, false, dineroPdf(total))
    y -= 14
  }
  if (datos.items.length > visibles.length) t(190, y, 8, false, `y ${datos.items.length - visibles.length} productos mas`)
  caja(32, 70, 260, 150)
  t(40, 200, 8, true, "INFORMACION ADICIONAL")
  t(40, 184, 8, false, "Documento: PROFORMA")
  t(40, 170, 8, false, "No reemplaza a la factura")
  t(40, 84, 7, true, "Proveedor del sistema: MEIJSAC S.A.S. RUC 1793243789001")
  caja(308, 70, 256, 200)
  const filas: [string, unknown][] = [
    ["SUBTOTAL 15%", totales.base15],
    ["SUBTOTAL 0%", totales.base0],
    ["SUBTOTAL NO OBJETO DE IVA", totales.baseNoObjeto],
    ["SUBTOTAL EXENTO DE IVA", totales.baseExento],
    ["SUBTOTAL SIN IMPUESTOS", totales.subtotalSin],
    ["TOTAL DESCUENTO", totales.descuento],
    ["ICE", totales.valorICE],
    ["IVA 15%", totales.iva15],
    ["PROPINA", totales.propina],
  ]
  filas.forEach((fila, i) => {
    t(316, 250 - i * 14, 7, fila[0].includes("SIN IMPUESTOS"), fila[0])
    t(490, 250 - i * 14, 7, false, dineroPdf(fila[1]))
  })
  t(316, 90, 10, true, "VALOR TOTAL")
  t(470, 90, 10, true, dineroPdf(totales.total))
  const stream = cmd.join("\n")
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ]
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
