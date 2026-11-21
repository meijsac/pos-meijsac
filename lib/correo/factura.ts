import nodemailer from "nodemailer"
import { prisma } from "@/lib/prisma"
import { datosRegistroDe } from "@/lib/empresa-sesion"
import { leerComprobanteArchivado } from "@/lib/security/storage"
import { facturaPorClave } from "@/lib/sri/buscar-comprobante"

export const FALTA_CORREO_EMPRESA = "Configura el correo de tu empresa en Configuración - Identidad"
export const FALTA_DOMINIO_ENVIO = "Verifica el dominio de envío en Resend. Un correo de Gmail no puede ser el remitente."

const LEYENDA = "Este documento es un comprobante electrónico autorizado por el SRI. Para verificar su autenticidad ingrese a www.sri.gob.ec. Este correo fue generado automáticamente, por favor no responder."
const PIE = "Enviado automáticamente por el sistema de facturación electrónica MEIJSAC."

function escapar(valor: unknown) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function dinero(valor: unknown) {
  const n = Number(valor)
  return Number.isFinite(n) ? n.toFixed(2) : "0.00"
}

function correosDe(valor: unknown) {
  return String(valor || "")
    .split(/[;,]/)
    .map((parte) => parte.trim())
    .filter((parte) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parte))
}

function cuando() {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date())
}

function lineaAtencion(body: Record<string, any> | null) {
  if (!body) return ""
  const nombre = String(body.atendidoPor || body.auditoria?.usuario || "").trim()
  const caja = String(body.establecimiento || "").trim()
  if (!nombre && !caja) return ""
  return `Atendido por: ${nombre || "—"} · Caja: ${caja || "—"}`
}

function numeroDe(body: Record<string, any>) {
  const serie = String(body.establecimiento || "").trim()
  const sec = String(body.secuencial || "").replace(/\D/g, "").padStart(9, "0").slice(-9)
  return [serie, sec].filter(Boolean).join("-")
}

function nombreRemitente(empresa: string) {
  return empresa.replace(/["<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "Facturación"
}

function llaveResend() {
  const directa = String(process.env.RESEND_API_KEY || "").trim()
  if (directa) return directa
  const host = String(process.env.SMTP_HOST || "")
  const pass = String(process.env.SMTP_PASS || "").trim()
  if (/resend/i.test(host) && pass) return pass
  return ""
}

async function dominiosVerificados(llave: string) {
  const respuesta = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${llave}` },
  })
  const data = await respuesta.json().catch(() => ({}))
  const lista = Array.isArray(data?.data) ? data.data : []
  return lista
    .filter((fila: { status?: string; name?: string }) => String(fila?.status || "").toLowerCase() === "verified" && fila?.name)
    .map((fila: { name?: string }) => String(fila.name).toLowerCase())
}

async function remitenteVerificado(llave: string, nombreEmpresa: string, correoEmpresa: string) {
  const nombre = nombreRemitente(nombreEmpresa)
  const permitidos = await dominiosVerificados(llave).catch(() => [] as string[])
  const dominioEmpresa = correoEmpresa.split("@")[1]?.toLowerCase() || ""
  if (dominioEmpresa && permitidos.includes(dominioEmpresa)) return `${nombre} <${correoEmpresa}>`
  const explicito = correosDe(process.env.RESEND_FROM || process.env.EMAIL_FROM || "")[0]
  const dominioExplicito = explicito?.split("@")[1]?.toLowerCase() || ""
  if (explicito && permitidos.includes(dominioExplicito)) return `${nombre} <${explicito}>`
  const propio = permitidos.find((dominio) => dominio === "meijsac.com" || dominio.endsWith(".meijsac.com")) || permitidos[0]
  if (!propio) return ""
  return `${nombre} <facturas@${propio}>`
}

async function correoIdentidad(empresaId: string) {
  if (!empresaId) return { correo: "", nombre: "" }
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { id: true, email: true, razonSocial: true, nombreComercial: true, datosRegistro: true },
  })
  if (!empresa || empresa.id !== empresaId) return { correo: "", nombre: "" }
  const extra = datosRegistroDe(empresa.datosRegistro)
  return {
    correo: correosDe(empresa.email || extra.email || extra.correo)[0] || "",
    nombre: String(empresa.nombreComercial || empresa.razonSocial || extra.razonSocial || "").trim(),
  }
}

function marco(datos: { empresa: string; ruc: string; direccion: string; telefono: string; logo: string; cuerpo: string }) {
  const logo = datos.logo.startsWith("https://") || datos.logo.startsWith("http://")
    ? `<img src="${escapar(datos.logo)}" alt="" width="72" style="display:block;border:0;max-width:72px;height:auto" />`
    : ""
  return `<div style="margin:0;padding:24px;background:#f4f7f8;font-family:Arial,Helvetica,sans-serif;color:#1c2830">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d7e2e6;border-radius:12px;overflow:hidden">
      <div style="padding:20px 24px;background:#0c1e24;color:#ffffff">
        ${logo}
        <p style="margin:12px 0 0;font-size:18px;font-weight:700">${escapar(datos.empresa)}</p>
        <p style="margin:4px 0 0;font-size:12px;line-height:1.5;color:#c5d5db">RUC ${escapar(datos.ruc)}<br/>${escapar(datos.direccion)}<br/>${escapar(datos.telefono)}</p>
      </div>
      <div style="padding:24px;font-size:14px;line-height:1.6">${datos.cuerpo}</div>
      <div style="padding:0 24px 20px">
        <p style="margin:0;padding:12px;background:#f4f7f8;border-radius:8px;font-size:11px;line-height:1.5;color:#5c6b73">${escapar(LEYENDA)}</p>
        <p style="margin:8px 0 0;font-size:10px;color:#8a979d">${escapar(PIE)}</p>
      </div>
    </div>
  </div>`
}

export function htmlCorreoReceptor(datos: { cliente: string; numero: string; total: string; fecha: string; empresa: string; ruc: string; direccion: string; telefono: string; logo: string; atencion?: string }) {
  const texto = `Hola ${datos.cliente}, te enviamos tu comprobante electrónico No. ${datos.numero}, por un valor de $${datos.total}, fecha ${datos.fecha}, emitido por ${datos.empresa} con RUC ${datos.ruc}. Puedes verificarlo en www.sri.gob.ec.`
  const atencion = datos.atencion ? `<p style="margin:12px 0 0;font-size:12px;color:#5c6b73">${escapar(datos.atencion)}</p>` : ""
  return {
    texto: `${texto}${datos.atencion ? `\n${datos.atencion}` : ""}\n\n${LEYENDA}\n\n${PIE}`,
    html: marco({ ...datos, cuerpo: `<p style="margin:0">${escapar(texto)}</p>${atencion}<p style="margin:16px 0 0;font-size:12px;color:#5c6b73">Adjuntos: XML autorizado y RIDE PDF.</p>` }),
  }
}

export function htmlCorreoEmisor(datos: { cliente: string; numero: string; autorizacion: string; correo: string; cuando: string; autorizado: boolean; motivo: string; empresa: string; ruc: string; direccion: string; telefono: string; logo: string; atencion?: string }) {
  const texto = datos.autorizado
    ? `Tu factura No. ${datos.numero} fue AUTORIZADA por el SRI, autorización No. ${datos.autorizacion}, y ya fue enviada a ${datos.correo} el ${datos.cuando}.`
    : `Tu factura No. ${datos.numero} NO fue autorizada, motivo SRI: ${datos.motivo}.`
  const atencion = datos.atencion ? `<p style="margin:12px 0 0;font-size:12px;color:#5c6b73">${escapar(datos.atencion)}</p>` : ""
  return {
    texto: `${texto}${datos.atencion ? `\n${datos.atencion}` : ""}\n\n${LEYENDA}\n\n${PIE}`,
    html: marco({ ...datos, cuerpo: `<p style="margin:0">${escapar(texto)}</p>${atencion}<p style="margin:16px 0 0;font-size:12px;color:#5c6b73">Adjuntos: XML y RIDE PDF.</p>` }),
  }
}

function esGmail(host: string) {
  return /gmail|googlemail|google/i.test(host)
}

function claveSmtp(host: string) {
  const cruda = String(process.env.SMTP_PASS || "")
  return esGmail(host) ? cruda.replace(/\s/g, "") : cruda
}

function motivoSmtp(error: unknown) {
  const texto = String((error as { response?: string; message?: string })?.response || (error as { message?: string })?.message || "")
  const dominioBloqueado = texto.match(/from\s+([a-z0-9.-]+\.[a-z]{2,})/i)?.[1]
  if (dominioBloqueado && /not authorized/i.test(texto)) {
    return `La clave de Resend no puede enviar desde ${dominioBloqueado}. En Resend ese dominio tiene que estar verificado y la clave debe tener permiso para enviarlo`
  }
  if (/535|534|BadCredentials|Username and Password not accepted|Invalid login/i.test(texto)) {
    return "Gmail rechazó la clave. Hay que usar una contraseña de aplicación de Google, sin espacios"
  }
  if (/ECONNREFUSED|ETIMEDOUT|ESOCKET|ENOTFOUND|timed out|Greeting never|connect/i.test(texto)) {
    return "no hubo conexión con el servidor de correo"
  }
  const limpio = texto.replace(/\s+/g, " ").replace(/pass(word)?[=:]\S+/gi, "").slice(0, 160)
  return limpio || "no se pudo entregar"
}

function abrirTransporte(host: string, user: string, pass: string, port: number) {
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
    tls: { minVersion: "TLSv1.2" },
  })
}

async function enviarResend(llave: string, correo: { from: string; to: string; replyTo?: string; subject: string; text: string; html: string; attachments: { filename: string; content: string | Buffer }[] }) {
  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: correo.from,
      to: correo.to.split(",").map((parte) => parte.trim()).filter(Boolean),
      reply_to: correo.replyTo || undefined,
      subject: correo.subject,
      text: correo.text,
      html: correo.html,
      attachments: correo.attachments.map((adjunto) => ({
        filename: adjunto.filename,
        content: Buffer.isBuffer(adjunto.content) ? adjunto.content.toString("base64") : Buffer.from(adjunto.content).toString("base64"),
      })),
    }),
  })
  if (respuesta.ok) return
  const data = await respuesta.json().catch(() => ({}))
  throw new Error(String(data?.message || data?.error || `Resend respondió ${respuesta.status}`))
}

function transporte() {
  const hostIngresado = String(process.env.SMTP_HOST || "").trim()
  const user = String(process.env.SMTP_USER || "").trim()
  const pass = claveSmtp(hostIngresado)
  if (!hostIngresado || !user || !pass) return null
  const gmail = esGmail(hostIngresado)
  const host = gmail ? "smtp.gmail.com" : hostIngresado
  const port = gmail ? 465 : (Number(String(process.env.SMTP_PORT || "587").trim()) || 587)
  return abrirTransporte(host, user, pass, port)
}

const WIN: Record<string, string> = {
  á: "\\341", é: "\\351", í: "\\355", ó: "\\363", ú: "\\372",
  Á: "\\301", É: "\\311", Í: "\\315", Ó: "\\323", Ú: "\\332",
  ñ: "\\361", Ñ: "\\321", ü: "\\374", Ü: "\\334", "¿": "\\277", "¡": "\\241",
}

function pdfTexto(valor: unknown) {
  return String(valor ?? "").normalize("NFC").split("").map((char) => {
    if (WIN[char]) return WIN[char]
    if (char === "\\") return "\\\\"
    if (char === "(" || char === ")") return `\\${char}`
    const code = char.charCodeAt(0)
    return code >= 32 && code <= 126 ? char : " "
  }).join("")
}

function medirPdf(texto: string, size: number) {
  let ancho = 0
  for (const char of texto) ancho += char === " " ? size * 0.33 : char >= "0" && char <= "9" ? size * 0.56 : size * 0.52
  return ancho
}

function partirPdf(valor: unknown, size: number, ancho: number) {
  const texto = String(valor ?? "").normalize("NFC").replace(/\s+/g, " ").trim()
  if (!texto) return []
  const cabe = (s: string) => medirPdf(s, size) <= ancho
  const lineas: string[] = []
  let actual = ""
  const cortar = (palabra: string) => {
    let resto = palabra
    while (resto) {
      let n = resto.length
      while (n > 1 && !cabe(resto.slice(0, n))) n -= 1
      lineas.push(resto.slice(0, n))
      resto = resto.slice(n)
    }
  }
  for (const palabra of texto.split(" ")) {
    if (!cabe(palabra)) {
      if (actual) lineas.push(actual)
      actual = ""
      cortar(palabra)
      continue
    }
    const prueba = actual ? `${actual} ${palabra}` : palabra
    if (cabe(prueba)) actual = prueba
    else {
      if (actual) lineas.push(actual)
      actual = palabra
    }
  }
  if (actual) lineas.push(actual)
  return lineas
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

const CODE128 = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112",
]

function bitsCode128(texto: string) {
  const limpio = texto.replace(/\D/g, "")
  if (!limpio) return ""
  const valores = [104]
  for (const char of limpio) valores.push(char.charCodeAt(0) - 32)
  const suma = valores.reduce((total, valor, i) => total + valor * (i === 0 ? 1 : i), 0)
  valores.push(suma % 103)
  valores.push(106)
  return valores.map((valor) => CODE128[valor] || "").join("")
}

function xmlDelHistorial(p: Record<string, any>, xmlGuardado: Buffer | null) {
  const aut = p.sriAutorizacion?.RespuestaAutorizacionComprobante?.autorizaciones?.autorizacion
  const comp = Array.isArray(aut)
    ? aut.find((fila: { estado?: string }) => fila?.estado === "AUTORIZADO")?.comprobante || aut[0]?.comprobante
    : aut?.comprobante
  return String(comp || p.xmlContent || xmlGuardado?.toString("utf8") || "")
}

function pdfIgualAlRide(body: Record<string, any>) {
  const emisor = body.configEmisor || {}
  const cliente = body.cliente || {}
  const totales = body.totales || {}
  const clave = String(body.claveAcceso || "").replace(/\D/g, "")
  const numero = [body.establecimiento, body.secuencial].filter(Boolean).join("-")
  const fechaAutorizacion = String(body.fechaAutorizacion || "").trim()
  const ambiente = clave[23] === "2" ? "PRODUCCION" : "PRUEBAS"
  const vendedor = String(body.atendidoPor || body.auditoria?.usuario || "")
  const items = Array.isArray(body.items) ? body.items : []
  const cmd: string[] = ["0.75 0.8 0.84 RG", "0.12 0.16 0.22 rg"]
  const t = (x: number, y: number, size: number, bold: boolean, valor: unknown) => {
    cmd.push(`BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfTexto(valor)}) Tj ET`)
  }
  const caja = (x: number, y: number, w: number, h: number) => cmd.push(`${x} ${y} ${w} ${h} re S`)
  const bloque = (x: number, y: number, size: number, bold: boolean, valor: unknown, ancho: number, paso: number) => {
    const lineas = partirPdf(valor, size, ancho)
    lineas.forEach((linea, i) => t(x, y - i * paso, size, bold, linea))
    return lineas.length * paso
  }
  caja(32, 600, 268, 214)
  caja(308, 600, 256, 214)
  let izq = 792
  const ponerIzq = (size: number, bold: boolean, valor: unknown, paso: number) => {
    const usado = bloque(40, izq, size, bold, valor, 244, paso)
    if (usado) izq -= usado
  }
  ponerIzq(11, true, emisor.razon || "", 14)
  ponerIzq(9, false, emisor.comercial || "", 12)
  ponerIzq(8, false, `Direccion Matriz: ${emisor.matriz || ""}`, 12)
  ponerIzq(8, false, `Direccion Sucursal: ${emisor.sucursal || emisor.matriz || ""}`, 12)
  ponerIzq(7, true, `OBLIGADO A LLEVAR CONTABILIDAD: ${emisor.obligado || "NO"}`, 11)
  const leyenda = leyendaRegimen(emisor.regimen)
  if (leyenda) ponerIzq(7, true, leyenda, 10)
  let der = 792
  const ponerDer = (size: number, bold: boolean, valor: unknown, paso: number) => {
    const usado = bloque(316, der, size, bold, valor, 232, paso)
    if (usado) der -= usado
  }
  ponerDer(10, true, `R.U.C.: ${emisor.ruc || ""}`, 14)
  ponerDer(13, true, "FACTURA", 16)
  ponerDer(9, true, `No. ${numero}`, 14)
  ponerDer(8, true, "NUMERO DE AUTORIZACION:", 12)
  ponerDer(7, false, clave, 11)
  ponerDer(7, false, `FECHA Y HORA DE AUTORIZACION: ${fechaAutorizacion || "-"}`, 10)
  ponerDer(7, false, `AMBIENTE: ${ambiente}`, 10)
  ponerDer(7, false, "EMISION: NORMAL", 10)
  if (vendedor) ponerDer(7, false, `VENDEDOR: ${vendedor}`, 10)
  ponerDer(7, true, "CLAVE DE ACCESO:", 12)
  const bits = bitsCode128(clave)
  if (bits) {
    const x0 = 316
    const ancho = 232
    let unidades = 0
    for (const parte of bits) unidades += Number(parte)
    const escala = unidades ? ancho / unidades : 1
    let x = x0
    const alto = 16
    const base = der - alto
    cmd.push("0 0 0 rg")
    for (let i = 0; i < bits.length; i++) {
      const w = Number(bits[i]) * escala
      if (i % 2 === 0) cmd.push(`${x.toFixed(2)} ${base.toFixed(2)} ${w.toFixed(2)} ${alto} re f`)
      x += w
    }
    cmd.push("0.12 0.16 0.22 rg")
    der = base - 6
  }
  bloque(316, der, 7, false, clave, 232, 10)
  caja(32, 506, 532, 82)
  const una = (valor: unknown, size: number, ancho: number) => partirPdf(valor, size, ancho)[0] || ""
  t(40, 574, 8, true, una(`Razon Social / Nombres y Apellidos: ${cliente.razon || ""}`, 8, 500))
  t(40, 554, 8, true, una(`Identificacion: ${cliente.identificacion || ""}`, 8, 250))
  t(300, 554, 8, true, una(`Fecha de Emision: ${body.fechaEmisionFormato || ""}`, 8, 220))
  t(40, 534, 8, true, una(`Direccion: ${cliente.direccion || "-"}`, 8, 250))
  t(300, 534, 8, true, una(`Email: ${cliente.email || "-"}`, 8, 220))
  t(40, 516, 8, true, "Guia de Remision: S/N")
  caja(32, 478, 532, 16)
  t(40, 482, 8, true, "Cod. Principal")
  t(118, 482, 8, true, "Cant.")
  t(168, 482, 8, true, "Descripcion")
  t(372, 482, 8, true, "Precio Unitario")
  t(456, 482, 8, true, "Descuento")
  t(498, 482, 8, true, "Precio Total")
  let filaY = 462
  for (const item of items.slice(0, 10)) {
    const cant = Number(item.cant || item.cantidad || 0)
    const precio = Number(item.pUnit || item.precio || 0)
    const desc = Number(item.descDolar || 0) || cant * precio * Number(item.descPorc || 0) / 100
    const total = Number.isFinite(Number(item.total)) ? Number(item.total) : cant * precio - desc
    const codigo = partirPdf(item.codigo || "", 8, 70)[0] || ""
    const descripcion = partirPdf(item.descripcion || "", 8, 190)[0] || ""
    t(40, filaY, 8, false, codigo)
    t(118, filaY, 8, false, cant.toFixed(2))
    t(168, filaY, 8, false, descripcion)
    t(372, filaY, 8, false, dineroPdf(precio))
    t(456, filaY, 8, false, dineroPdf(desc))
    t(508, filaY, 8, false, dineroPdf(total))
    filaY -= 14
  }
  caja(32, 36, 260, 282)
  caja(308, 36, 256, 282)
  let infoY = 300
  const ponerInfo = (size: number, bold: boolean, valor: unknown, paso: number) => {
    if (infoY < 84) return
    const lineas = partirPdf(valor, size, 236).slice(0, Math.floor((infoY - 80) / paso))
    lineas.forEach((linea, i) => t(40, infoY - i * paso, size, bold, linea))
    if (lineas.length) infoY -= lineas.length * paso
  }
  ponerInfo(8, true, "INFORMACION ADICIONAL", 14)
  ponerInfo(8, false, `Forma de Pago: ${body.formaPago || ""}`, 11)
  const recibido = Number(body.pagos?.efectivoRecibido || body.efectivoRecibido || body.pagos?.entregado || 0)
  const vuelto = Number(body.pagos?.vuelto || body.vuelto || 0)
  if (recibido > 0) ponerInfo(8, false, `Valor recibido: ${dineroPdf(recibido)}`, 12)
  if (vuelto > 0) ponerInfo(8, false, `Vuelto entregado: ${dineroPdf(vuelto)}`, 12)
  if (body.mensajeSri) ponerInfo(7, false, `Mensaje del SRI: ${body.mensajeSri}`, 10)
  t(40, 64, 7, true, "Proveedor del sistema: MEIJSAC S.A.S.")
  t(40, 52, 7, true, "RUC 1793243789001")
  const filasTotales: [string, unknown][] = [
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
  filasTotales.forEach((fila, i) => {
    t(316, 300 - i * 16, 7, fila[0].includes("SIN IMPUESTOS"), fila[0])
    t(500, 300 - i * 16, 7, false, dineroPdf(fila[1]))
  })
  t(316, 58, 11, true, "VALOR TOTAL")
  t(470, 58, 11, true, dineroPdf(totales.total))
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

export async function enviarCorreosFactura(body: Record<string, any>, xmlAutorizado: string, empresaId = "") {
  const tipo = String(body.tipoComprobante || body.codDoc || "01")
  const estado = String(body.estadoSRI || "").toUpperCase()
  const autorizado = estado === "AUTORIZADO"
  const devuelta = estado.includes("DEVUELT") || estado.includes("NO AUTORIZ") || estado.includes("RECHAZ")
  if (tipo !== "01" || (!autorizado && !devuelta)) return ""
  const emisor = body.configEmisor && typeof body.configEmisor === "object" ? body.configEmisor : {}
  const cliente = body.cliente && typeof body.cliente === "object" ? body.cliente : {}
  const empresa = String(emisor.razon || emisor.razonSocial || "Empresa")
  const ruc = String(emisor.ruc || "")
  const direccion = String(emisor.matriz || emisor.direccion || "")
  const telefono = String(emisor.telefono || emisor.celular || "")
  const logo = String(emisor.logo || "")
  const nombreCliente = String(cliente.razon || "cliente")
  const numero = numeroDe(body)
  const fecha = String(body.fechaEmisionFormato || body.fechaAutorizacion || "")
  const total = dinero(body.totales?.total)
  const motivo = String(body.mensajeSri || "sin motivo informado por el SRI")
  const autorizacion = String(body.numeroAutorizacion || "")
  const hora = cuando()
  const identidad = await correoIdentidad(empresaId)
  const emisorCorreo = identidad.correo
  if (!emisorCorreo) return FALTA_CORREO_EMPRESA
  const llave = llaveResend()
  const from = llave ? await remitenteVerificado(llave, identidad.nombre || empresa, emisorCorreo) : `${nombreRemitente(identidad.nombre || empresa)} <${emisorCorreo}>`
  if (llave && !from) return FALTA_DOMINIO_ENVIO
  const clave = String(body.claveAcceso || "").replace(/\D/g, "")
  const propia = empresaId && clave.length === 49 ? await facturaPorClave(empresaId, clave).catch(() => null) : null
  const guardada = propia && propia.payload && typeof propia.payload === "object" ? propia.payload as Record<string, any> : null
  const origen = guardada || (empresaId ? null : body)
  const xmlGuardado = origen && empresaId && clave.length === 49 ? await leerComprobanteArchivado(empresaId, clave, "xml").catch(() => null) : null
  const xml = origen ? xmlDelHistorial(origen, xmlGuardado) : ""
  let pdf: Buffer | null = null
  if (origen) {
    try { pdf = pdfIgualAlRide(origen) } catch { pdf = null }
  }
  const clienteDeEsta = guardada && guardada.cliente && typeof guardada.cliente === "object" ? guardada.cliente as Record<string, any> : (empresaId ? {} : cliente)
  const destinoDeEsta = correosDe(clienteDeEsta.email || clienteDeEsta.correo || clienteDeEsta.mail)
  const nombreDeEsta = String(clienteDeEsta.razon || (empresaId ? "cliente" : nombreCliente))
  void xmlAutorizado
  const adjuntos = [
    xml ? { filename: `factura-${numero || "sri"}.xml`, content: xml, contentType: "application/xml" } : null,
    pdf?.length ? { filename: `factura-${numero || "sri"}.pdf`, content: pdf, contentType: "application/pdf" } : null,
  ].filter(Boolean)
  const atencion = lineaAtencion(origen)
  const receptor = htmlCorreoReceptor({ cliente: nombreDeEsta, numero, total, fecha, empresa, ruc, direccion, telefono, logo, atencion })
  const emisorHtml = htmlCorreoEmisor({ cliente: nombreDeEsta, numero, autorizacion, correo: destinoDeEsta[0] || "sin correo", cuando: hora, autorizado, motivo, empresa, ruc, direccion, telefono, logo, atencion })
  const mail = llave ? null : transporte()
  const fallaBase = !llave && !mail
    ? "falta la clave de Resend"
    : !xml || !pdf?.length
      ? "faltan el XML o el PDF"
      : ""
  const fallos: string[] = []
  const adjuntosCorreo = adjuntos as { filename: string; content: string | Buffer; contentType: string }[]
  async function mandar(para: string, asunto: string, mensaje: { texto: string; html: string }) {
    if (!para || fallaBase) return "Fallido"
    if (llave) {
      await enviarResend(llave, { from, to: para, replyTo: emisorCorreo || undefined, subject: asunto, text: mensaje.texto, html: mensaje.html, attachments: adjuntosCorreo })
      return "Enviado"
    }
    await mail!.sendMail({
      from,
      to: para,
      replyTo: emisorCorreo || undefined,
      subject: asunto,
      text: mensaje.texto,
      html: mensaje.html,
      attachments: adjuntosCorreo,
    })
    return "Enviado"
  }
  let estadoReceptor = "Fallido"
  if (!destinoDeEsta.length) fallos.push("sin correo del cliente")
  else {
    try {
      estadoReceptor = await mandar(destinoDeEsta.join(","), `Factura No. ${numero} - ${empresa}`, receptor)
      if (estadoReceptor === "Fallido" && fallaBase) fallos.push(fallaBase)
    } catch (error) {
      estadoReceptor = "Fallido"
      fallos.push(motivoSmtp(error))
    }
  }
  let estadoEmisor = "Fallido"
  if (emisorCorreo) {
    try {
      estadoEmisor = await mandar(emisorCorreo, `Copia de Factura No. ${numero} enviada a ${nombreCliente}`, emisorHtml)
    } catch (error) {
      estadoEmisor = "Fallido"
      if (!fallos.length) fallos.push(motivoSmtp(error))
    }
  }
  const linea = `Correo enviado a ${destinoDeEsta[0] || "sin correo"} el ${hora} - Estado: ${estadoReceptor}`
  const copia = emisorCorreo ? `. Copia al emisor ${emisorCorreo} - Estado: ${estadoEmisor}` : ""
  return `${linea}${copia}${fallos.length ? `. ${fallos[0]}` : ""}`
}
