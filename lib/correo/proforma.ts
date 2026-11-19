import nodemailer from "nodemailer"
import { correosDe } from "@/lib/proforma/calculos"

function escapar(valor: unknown) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function nombreRemitente(empresa: string) {
  return empresa.replace(/["<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "Proforma"
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

async function remitente(llave: string, nombreEmpresa: string, correoEmpresa: string) {
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

function esGmail(host: string) {
  return /gmail|googlemail|google/i.test(host)
}

function transporte() {
  const hostIngresado = String(process.env.SMTP_HOST || "").trim()
  const user = String(process.env.SMTP_USER || "").trim()
  const cruda = String(process.env.SMTP_PASS || "")
  const pass = esGmail(hostIngresado) ? cruda.replace(/\s/g, "") : cruda
  if (!hostIngresado || !user || !pass) return null
  const gmail = esGmail(hostIngresado)
  return nodemailer.createTransport({
    host: gmail ? "smtp.gmail.com" : hostIngresado,
    port: gmail ? 465 : (Number(String(process.env.SMTP_PORT || "587").trim()) || 587),
    secure: gmail || Number(String(process.env.SMTP_PORT || "587").trim()) === 465,
    auth: { user, pass },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
    tls: { minVersion: "TLSv1.2" },
  })
}

export async function enviarCorreoProforma(datos: {
  empresa: string
  correoEmpresa: string
  numero: string
  cliente: string
  total: string
  destinos: string[]
  pdf: Buffer
}) {
  const destinos = datos.destinos.filter(Boolean)
  if (!destinos.length) return { ok: false as const, error: "Escribe al menos un correo" }
  const llave = llaveResend()
  const from = llave ? await remitente(llave, datos.empresa, datos.correoEmpresa) : (datos.correoEmpresa ? `${nombreRemitente(datos.empresa)} <${datos.correoEmpresa}>` : "")
  if (!from) return { ok: false as const, error: "Verifica el dominio de envío en Resend. Un correo de Gmail no puede ser el remitente." }
  const aviso = "Esta proforma no es una factura y no tiene autorización del SRI."
  const texto = `Hola, te enviamos la proforma No. ${datos.numero} de ${datos.cliente}, por un valor de $${datos.total}, emitida por ${datos.empresa}. ${aviso}`
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c2830;padding:24px"><p>${escapar(texto)}</p><p style="font-size:12px;color:#5c6b73">Adjunto: PDF de la proforma.</p></div>`
  const asunto = `Proforma No. ${datos.numero} - ${datos.empresa}`
  if (llave) {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: destinos,
        reply_to: datos.correoEmpresa || undefined,
        subject: asunto,
        text: texto,
        html,
        attachments: [{ filename: `proforma-${datos.numero}.pdf`, content: datos.pdf.toString("base64") }],
      }),
    })
    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}))
      return { ok: false as const, error: String(data?.message || data?.error || "No se pudo entregar la proforma") }
    }
    return { ok: true as const, enviados: destinos }
  }
  const mail = transporte()
  if (!mail) return { ok: false as const, error: "Falta la clave de correo" }
  await mail.sendMail({
    from,
    to: destinos.join(","),
    replyTo: datos.correoEmpresa || undefined,
    subject: asunto,
    text: texto,
    html,
    attachments: [{ filename: `proforma-${datos.numero}.pdf`, content: datos.pdf, contentType: "application/pdf" }],
  })
  return { ok: true as const, enviados: destinos }
}
