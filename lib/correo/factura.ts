import nodemailer from "nodemailer"
import { pdfRide } from "@/lib/sri/ride-archivo"

const PERSONALES = new Set(["gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com", "yahoo.com", "yahoo.es", "icloud.com", "me.com"])
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

function dominioDe(correo: string) {
  return correo.split("@")[1]?.toLowerCase() || ""
}

function esDominioEmpresa(correo: string) {
  const dominio = dominioDe(correo)
  return Boolean(dominio) && !PERSONALES.has(dominio)
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

function remitente(empresa: string, correoEmpresa: string) {
  const configurado = String(process.env.SMTP_FROM || "").trim()
  const elegido = esDominioEmpresa(configurado) ? configurado : (esDominioEmpresa(correoEmpresa) ? correoEmpresa : "")
  if (!elegido) return ""
  const nombre = empresa.replace(/"/g, "").slice(0, 80) || "Facturación"
  return `"${nombre}" <${elegido}>`
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

function transporte() {
  const host = String(process.env.SMTP_HOST || "").trim()
  const user = String(process.env.SMTP_USER || "").trim()
  const pass = String(process.env.SMTP_PASS || "")
  if (!host || !user || !pass) return null
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_PORT || "") === "465",
    auth: { user, pass },
  })
}

export async function enviarCorreosFactura(body: Record<string, any>, xmlAutorizado: string) {
  const tipo = String(body.tipoComprobante || body.codDoc || "01")
  const estado = String(body.estadoSRI || "").toUpperCase()
  if (tipo !== "01" || !["AUTORIZADO", "DEVUELTA", "NO AUTORIZADO"].includes(estado)) return ""
  const emisor = body.configEmisor && typeof body.configEmisor === "object" ? body.configEmisor : {}
  const cliente = body.cliente && typeof body.cliente === "object" ? body.cliente : {}
  const empresa = String(emisor.razon || emisor.razonSocial || "Empresa")
  const ruc = String(emisor.ruc || "")
  const direccion = String(emisor.matriz || emisor.direccion || "")
  const telefono = String(emisor.telefono || "")
  const logo = String(emisor.logo || "")
  const nombreCliente = String(cliente.razon || "cliente")
  const numero = numeroDe(body)
  const fecha = String(body.fechaEmisionFormato || body.fechaAutorizacion || "")
  const total = dinero(body.totales?.total)
  const autorizado = estado === "AUTORIZADO"
  const motivo = String(body.mensajeSri || "sin motivo informado por el SRI")
  const autorizacion = String(body.numeroAutorizacion || "")
  const hora = cuando()
  const destino = correosDe(cliente.email)
  const emisorCorreo = correosDe(emisor.email)[0] || ""
  const from = remitente(empresa, emisorCorreo)
  const xml = String(xmlAutorizado || body.xmlContent || "")
  let pdf: Buffer | null = null
  try { pdf = pdfRide(body, String(body.fechaAutorizacion || fecha)) } catch { pdf = null }
  const adjuntos = [
    xml ? { filename: `factura-${numero || "sri"}.xml`, content: xml, contentType: "application/xml" } : null,
    pdf?.length ? { filename: `factura-${numero || "sri"}.pdf`, content: pdf, contentType: "application/pdf" } : null,
  ].filter(Boolean)
  const receptor = htmlCorreoReceptor({ cliente: nombreCliente, numero, total, fecha, empresa, ruc, direccion, telefono, logo })
  const emisorHtml = htmlCorreoEmisor({ cliente: nombreCliente, numero, autorizacion, correo: destino[0] || "sin correo", cuando: hora, autorizado, motivo, empresa, ruc, direccion, telefono, logo })
  const mail = transporte()
  const fallaBase = !from
    ? "el remitente debe ser del dominio de la empresa, no un correo personal"
    : !mail
      ? "falta configurar el SMTP del dominio de la empresa"
      : !xml || !pdf?.length
        ? "faltan el XML o el PDF"
        : ""
  const fallos: string[] = []
  async function mandar(para: string, asunto: string, mensaje: { texto: string; html: string }) {
    if (!para || fallaBase) return "Fallido"
    await mail!.sendMail({
      from,
      to: para,
      replyTo: esDominioEmpresa(emisorCorreo) ? emisorCorreo : undefined,
      subject: asunto,
      text: mensaje.texto,
      html: mensaje.html,
      attachments: adjuntos as { filename: string; content: string | Buffer; contentType: string }[],
    })
    return "Enviado"
  }
  let estadoReceptor = "Fallido"
  if (!destino.length) fallos.push("sin correo del cliente")
  else {
    try {
      estadoReceptor = await mandar(destino.join(","), `Factura No. ${numero} - ${empresa}`, receptor)
      if (estadoReceptor === "Fallido" && fallaBase) fallos.push(fallaBase)
    } catch {
      estadoReceptor = "Fallido"
      fallos.push("no se pudo entregar al cliente")
    }
  }
  let estadoEmisor = "Fallido"
  if (emisorCorreo) {
    try {
      estadoEmisor = await mandar(emisorCorreo, `Copia de Factura No. ${numero} enviada a ${nombreCliente}`, emisorHtml)
    } catch {
      estadoEmisor = "Fallido"
    }
  }
  const linea = `Correo enviado a ${destino[0] || "sin correo"} el ${hora} - Estado: ${estadoReceptor}`
  const copia = emisorCorreo ? `. Copia al emisor ${emisorCorreo} - Estado: ${estadoEmisor}` : ""
  return `${linea}${copia}${fallos.length ? `. ${fallos[0]}` : ""}`
}
