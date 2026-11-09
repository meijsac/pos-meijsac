import { ambienteSri, envioSriPermitido, type CodigoAmbiente } from "@/lib/sri/ambiente"

const ESPERA_MS = 25000
const REINTENTOS = 2

export type ResultadoSri = {
  enviado: boolean
  bloqueado: boolean
  estado: "RECIBIDA" | "DEVUELTA" | "AUTORIZADO" | "NO AUTORIZADO" | "PENDIENTE_DE_AUTORIZAR"
  mensaje: string
  numeroAutorizacion?: string
  fechaAutorizacion?: string
  mensajes: string[]
}

function textoTag(xml: string, tag: string) {
  const encontrado = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
  return encontrado ? encontrado[1].trim() : ""
}

function mensajesSri(xml: string) {
  const lista: string[] = []
  const bloques = xml.match(/<mensaje>[\s\S]*?<\/mensaje>/g) || []
  for (const bloque of bloques) {
    const id = textoTag(bloque, "identificador")
    const texto = textoTag(bloque, "mensaje")
    const info = textoTag(bloque, "informacionAdicional")
    if (texto) lista.push([id, texto, info].filter(Boolean).join(" - "))
  }
  return lista
}

function sobreRecepcion(xmlFirmado: string) {
  const b64 = Buffer.from(xmlFirmado, "utf8").toString("base64")
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion"><soapenv:Header/><soapenv:Body><ec:validarComprobante><xml>${b64}</xml></ec:validarComprobante></soapenv:Body></soapenv:Envelope>`
}

function sobreAutorizacion(clave: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion"><soapenv:Header/><soapenv:Body><ec:autorizacionComprobante><claveAccesoComprobante>${clave}</claveAccesoComprobante></ec:autorizacionComprobante></soapenv:Body></soapenv:Envelope>`
}

async function postSoap(url: string, cuerpo: string, soapAction: string) {
  let ultimo = "El servicio del SRI no respondió"
  for (let intento = 0; intento <= REINTENTOS; intento++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: soapAction },
        body: cuerpo,
        signal: AbortSignal.timeout(ESPERA_MS),
        cache: "no-store",
      })
      const texto = await res.text()
      if (!res.ok) {
        ultimo = `SRI respondió HTTP ${res.status}`
        continue
      }
      return texto
    } catch (e: any) {
      ultimo = e?.name === "TimeoutError" ? "Tiempo de espera agotado con el SRI" : (e?.message || ultimo)
    }
  }
  throw new Error(ultimo)
}

function esperar(ms: number) {
  return new Promise((resolver) => setTimeout(resolver, ms))
}

function zona(xml: string, tag: string) {
  const bloque = xml.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "i"))
  return bloque ? bloque[0] : ""
}

export async function enviarComprobante(entrada: { xmlFirmado: string; claveAcceso: string; ambiente: CodigoAmbiente }): Promise<ResultadoSri> {
  if (!envioSriPermitido(entrada.ambiente)) {
    return {
      enviado: false,
      bloqueado: true,
      estado: "PENDIENTE_DE_AUTORIZAR",
      mensaje: "Producción bloqueada. No se envió ningún comprobante al SRI.",
      mensajes: [],
    }
  }
  const urls = ambienteSri(entrada.ambiente)
  let recepcion = ""
  try {
    recepcion = await postSoap(urls.recepcion, sobreRecepcion(entrada.xmlFirmado), "validarComprobante")
  } catch (e: any) {
    return { enviado: false, bloqueado: false, estado: "PENDIENTE_DE_AUTORIZAR", mensaje: e.message, mensajes: [] }
  }
  const cajaRecepcion = zona(recepcion, "RespuestaRecepcionComprobante") || recepcion
  const estadoRecepcion = textoTag(cajaRecepcion, "estado")
  const avisos = mensajesSri(cajaRecepcion)
  if (estadoRecepcion === "DEVUELTA") {
    return { enviado: true, bloqueado: false, estado: "DEVUELTA", mensaje: avisos.join(" | ") || "DEVUELTA", mensajes: avisos }
  }
  if (estadoRecepcion !== "RECIBIDA") {
    const falla = textoTag(recepcion, "faultstring")
    return { enviado: true, bloqueado: false, estado: "PENDIENTE_DE_AUTORIZAR", mensaje: falla || avisos.join(" | ") || "El SRI no respondió RECIBIDA ni DEVUELTA", mensajes: avisos }
  }
  let leido = { estado: "", numero: "", fecha: "", mensajes: [] as string[] }
  for (let intento = 0; intento < 3; intento++) {
    if (intento > 0) await esperar(3000)
    let autorizacion = ""
    try {
      autorizacion = await postSoap(urls.autorizacion, sobreAutorizacion(entrada.claveAcceso), "autorizacionComprobante")
    } catch (e: any) {
      if (intento === 2) {
        return { enviado: true, bloqueado: false, estado: "PENDIENTE_DE_AUTORIZAR", mensaje: `Recibida por el SRI. Autorización pendiente: ${e.message}`, mensajes: avisos }
      }
      continue
    }
    const caja = zona(autorizacion, "autorizacion")
    leido = {
      estado: caja ? textoTag(caja, "estado") : "",
      numero: caja ? textoTag(caja, "numeroAutorizacion") : "",
      fecha: caja ? textoTag(caja, "fechaAutorizacion") : "",
      mensajes: mensajesSri(caja || autorizacion),
    }
    if (leido.estado === "AUTORIZADO" || leido.estado === "NO AUTORIZADO") break
  }
  if (leido.estado === "AUTORIZADO") {
    return {
      enviado: true,
      bloqueado: false,
      estado: "AUTORIZADO",
      mensaje: leido.mensajes.join(" | "),
      numeroAutorizacion: leido.numero,
      fechaAutorizacion: leido.fecha,
      mensajes: leido.mensajes,
    }
  }
  if (leido.estado === "NO AUTORIZADO") {
    return { enviado: true, bloqueado: false, estado: "NO AUTORIZADO", mensaje: leido.mensajes.join(" | ") || "NO AUTORIZADO", mensajes: leido.mensajes }
  }
  return { enviado: true, bloqueado: false, estado: "PENDIENTE_DE_AUTORIZAR", mensaje: leido.mensajes.join(" | ") || "El SRI recibió el comprobante y todavía no devuelve autorización", mensajes: leido.mensajes }
}
