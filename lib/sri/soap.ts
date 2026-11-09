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

export async function enviarComprobante(entrada: { xmlFirmado: string; claveAcceso: string; ambiente: CodigoAmbiente }): Promise<ResultadoSri> {
  if (!envioSriPermitido()) {
    return {
      enviado: false,
      bloqueado: true,
      estado: "PENDIENTE_DE_AUTORIZAR",
      mensaje: "El envío al SRI está apagado. No se envió ningún comprobante.",
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
  const estadoRecepcion = textoTag(recepcion, "estado")
  const avisos = mensajesSri(recepcion)
  if (estadoRecepcion !== "RECIBIDA") {
    return {
      enviado: true,
      bloqueado: false,
      estado: "DEVUELTA",
      mensaje: avisos[0] || "El SRI devolvió el comprobante",
      mensajes: avisos,
    }
  }
  let autorizacion = ""
  try {
    autorizacion = await postSoap(urls.autorizacion, sobreAutorizacion(entrada.claveAcceso), "autorizacionComprobante")
  } catch (e: any) {
    return { enviado: true, bloqueado: false, estado: "PENDIENTE_DE_AUTORIZAR", mensaje: `Recibida por el SRI. Autorización pendiente: ${e.message}`, mensajes: avisos }
  }
  const estado = textoTag(autorizacion, "estado")
  const detalle = mensajesSri(autorizacion)
  if (estado === "AUTORIZADO") {
    return {
      enviado: true,
      bloqueado: false,
      estado: "AUTORIZADO",
      mensaje: "Autorizado por el SRI",
      numeroAutorizacion: textoTag(autorizacion, "numeroAutorizacion"),
      fechaAutorizacion: textoTag(autorizacion, "fechaAutorizacion"),
      mensajes: detalle,
    }
  }
  if (estado === "NO AUTORIZADO") {
    return { enviado: true, bloqueado: false, estado: "NO AUTORIZADO", mensaje: detalle[0] || "No autorizado por el SRI", mensajes: detalle }
  }
  return { enviado: true, bloqueado: false, estado: "PENDIENTE_DE_AUTORIZAR", mensaje: "El SRI recibió el comprobante y todavía no lo autoriza", mensajes: detalle }
}
