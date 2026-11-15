import nodemailer from "nodemailer"
import { pdfRide } from "@/lib/sri/ride-archivo"

const LEYENDA = "Este documento es un comprobante electrónico autorizado por el SRI. Para verificar su autenticidad ingrese a www.sri.gob.ec. Este correo fue generado automáticamente, por favor no responder."

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

function esCorreoPersonal(correo: string) {
  const dominio = correo.split("@")[1]?.toLowerCase() || ""
  return ["gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com", "yahoo.com", "yahoo.es", "icloud.com", "me.com"].includes(dominio)
}

async function remitente(empresa: string, llave: string) {
  const nombre = nombreRemitente(empresa)
  const explicito = String(process.env.RESEND_FROM || process.env.EMAIL_FROM || process.env.SMTP_FROM || "").trim()
  const correoExplicito = correosDe(explicito)[0]
  const dominioExplicito = correoExplicito?.split("@")[1]?.toLowerCase() || ""
  if (!llave) {
    if (correoExplicito && !esCorreoPersonal(correoExplicito)) return `${nombre} <${correoExplicito}>`
    const buzon = correosDe(process.env.SMTP_USER)[0]
    return buzon ? `${nombre} <${buzon}>` : ""
  }
  const permitidos = await dominiosVerificados(llave).catch(() => [])
  if (correoExplicito && permitidos.includes(dominioExplicito)) return `${nombre} <${correoExplicito}>`
  if (permitidos[0]) return `${nombre} <facturacion@${permitidos[0]}>`
  return ""
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
      </div>
    </div>
  </div>`
}

export function htmlCorreoReceptor(datos: { cliente: string; numero: string; total: string; fecha: string; empresa: string; ruc: string; direccion: string; telefono: string; logo: string }) {
  const texto = `Hola ${datos.cliente}, te enviamos tu comprobante electrónico No. ${datos.numero}, por un valor de $${datos.total}, fecha ${datos.fecha}, emitido por ${datos.empresa} con RUC ${datos.ruc}. Puedes verificarlo en www.sri.gob.ec.`
  return {
    texto: `${texto}\n\n${LEYENDA}`,
    html: marco({ ...datos, cuerpo: `<p style="margin:0">${escapar(texto)}</p><p style="margin:16px 0 0;font-size:12px;color:#5c6b73">Adjuntos: XML autorizado y RIDE PDF.</p>` }),
  }
}

export function htmlCorreoEmisor(datos: { cliente: string; numero: string; autorizacion: string; correo: string; cuando: string; autorizado: boolean; motivo: string; empresa: string; ruc: string; direccion: string; telefono: string; logo: string }) {
  const texto = datos.autorizado
    ? `Tu factura No. ${datos.numero} fue AUTORIZADA por el SRI, autorización No. ${datos.autorizacion}, y ya fue enviada a ${datos.correo} el ${datos.cuando}.`
    : `Tu factura No. ${datos.numero} NO fue autorizada, motivo SRI: ${datos.motivo}.`
  return {
    texto: `${texto}\n\n${LEYENDA}`,
    html: marco({ ...datos, cuerpo: `<p style="margin:0">${escapar(texto)}</p><p style="margin:16px 0 0;font-size:12px;color:#5c6b73">Adjuntos: XML y RIDE PDF.</p>` }),
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

export async function enviarCorreosFactura(body: Record<string, any>, xmlAutorizado: string) {
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
  const destino = correosDe(cliente.email || cliente.correo || cliente.mail)
  const emisorCorreo = correosDe(emisor.email || emisor.correo)[0] || ""
  const llave = llaveResend()
  const from = await remitente(empresa, llave)
  const xml = String(xmlAutorizado || body.xmlContent || "")
  let pdf: Buffer | null = null
  try { pdf = pdfRide(body, String(body.fechaAutorizacion || fecha)) } catch { pdf = null }
  const adjuntos = [
    xml ? { filename: `factura-${numero || "sri"}.xml`, content: xml, contentType: "application/xml" } : null,
    pdf?.length ? { filename: `factura-${numero || "sri"}.pdf`, content: pdf, contentType: "application/pdf" } : null,
  ].filter(Boolean)
  const receptor = htmlCorreoReceptor({ cliente: nombreCliente, numero, total, fecha, empresa, ruc, direccion, telefono, logo })
  const emisorHtml = htmlCorreoEmisor({ cliente: nombreCliente, numero, autorizacion, correo: destino[0] || "sin correo", cuando: hora, autorizado, motivo, empresa, ruc, direccion, telefono, logo })
  const mail = llave ? null : transporte()
  const fallaBase = !llave && !mail
    ? "falta la clave de Resend"
    : !from
      ? "Resend no tiene un dominio verificado para el remitente"
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
  if (!destino.length) fallos.push("sin correo del cliente")
  else {
    try {
      estadoReceptor = await mandar(destino.join(","), `Factura No. ${numero} - ${empresa}`, receptor)
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
  const linea = `Correo enviado a ${destino[0] || "sin correo"} el ${hora} - Estado: ${estadoReceptor}`
  const copia = emisorCorreo ? `. Copia al emisor ${emisorCorreo} - Estado: ${estadoEmisor}` : ""
  return `${linea}${copia}${fallos.length ? `. ${fallos[0]}` : ""}`
}
