import { ambienteSri, type CodigoAmbiente } from "@/lib/sri/ambiente"
import { enviarAlSri } from "@/lib/sri/cliente-sri"
import type { SriAutorizacionResponse, SriRecepcionResponse } from "@/lib/sri/tipos"

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
  estadoRecepcion?: string
  mensajeRecepcion?: string
  fechaRecepcion?: string
  estadoAutorizacion?: string
  mensajeAutorizacion?: string
  conectado?: boolean
  errorRed?: string
  recepcionSri?: SriRecepcionResponse | null
  autorizacionSri?: SriAutorizacionResponse | null
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

async function postSoap(url: string, cuerpo: string) {
  let ultimo = "El servicio del SRI no respondió"
  for (let intento = 0; intento <= REINTENTOS; intento++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "\"\"",
        },
        body: cuerpo,
        signal: AbortSignal.timeout(ESPERA_MS),
        cache: "no-store",
      })
      const texto = await res.text()
      if (!res.ok) {
        const falla = textoTag(texto, "faultstring")
        ultimo = falla || (res.status === 500
          ? "El SRI devolvió un error interno y no autorizó el comprobante."
          : "El SRI no aceptó el envío. Revisa el comprobante e inténtalo de nuevo.")
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
  const real = await enviarAlSri(entrada)
  const fecha = real.fechaAutorizacion || ""
  const estado = real.status === "AUTORIZADO" && fecha
    ? "AUTORIZADO"
    : real.status === "DEVUELTA"
      ? "DEVUELTA"
      : real.status === "RECHAZADO"
        ? "NO AUTORIZADO"
        : "PENDIENTE_DE_AUTORIZAR"
  return {
    enviado: real.conectado,
    bloqueado: false,
    estado,
    mensaje: real.mensajes.join(" | ") || real.error || real.status,
    numeroAutorizacion: fecha ? real.numeroAutorizacion : "",
    fechaAutorizacion: fecha,
    mensajes: real.mensajes,
    estadoRecepcion: real.recepcion?.RespuestaRecepcionComprobantes.estado || "",
    mensajeRecepcion: real.mensajes.join(" | "),
    estadoAutorizacion: estado === "AUTORIZADO" ? "AUTORIZADO" : real.status === "RECHAZADO" ? "RECHAZADO" : "",
    mensajeAutorizacion: real.mensajes.join(" | "),
    conectado: real.conectado,
    errorRed: real.error,
    recepcionSri: real.recepcion,
    autorizacionSri: real.autorizacion,
  }
}

export async function consultarAutorizacion(entrada: { claveAcceso: string; ambiente: CodigoAmbiente }): Promise<ResultadoSri> {
  const urls = ambienteSri(entrada.ambiente)
  let autorizacion = ""
  try {
    autorizacion = await postSoap(urls.autorizacion, sobreAutorizacion(entrada.claveAcceso))
  } catch (e: any) {
    return {
      enviado: true,
      bloqueado: false,
      estado: "PENDIENTE_DE_AUTORIZAR",
      mensaje: e.message || "No se pudo consultar la autorización en el SRI.",
      mensajes: [],
      estadoRecepcion: "RECIBIDA",
      fechaAutorizacion: "",
    }
  }
  const caja = zona(autorizacion, "autorizacion")
  const estado = caja ? textoTag(caja, "estado") : ""
  const fecha = caja ? textoTag(caja, "fechaAutorizacion") : ""
  const numero = caja ? textoTag(caja, "numeroAutorizacion") : ""
  const mensajes = mensajesSri(caja || autorizacion)
  if (estado === "AUTORIZADO" && fecha) {
    return {
      enviado: true,
      bloqueado: false,
      estado: "AUTORIZADO",
      mensaje: mensajes.join(" | ") || "AUTORIZADO",
      numeroAutorizacion: numero || entrada.claveAcceso,
      fechaAutorizacion: fecha,
      mensajes,
      estadoAutorizacion: "AUTORIZADO",
      mensajeAutorizacion: mensajes.join(" | ") || "AUTORIZADO",
    }
  }
  if (estado === "NO AUTORIZADO" || estado === "DEVUELTA") {
    return {
      enviado: true,
      bloqueado: false,
      estado: estado === "DEVUELTA" ? "DEVUELTA" : "NO AUTORIZADO",
      mensaje: mensajes.join(" | ") || estado,
      mensajes,
      fechaAutorizacion: "",
      estadoAutorizacion: estado,
      mensajeAutorizacion: mensajes.join(" | ") || estado,
    }
  }
  return {
    enviado: true,
    bloqueado: false,
    estado: "PENDIENTE_DE_AUTORIZAR",
    mensaje: mensajes.join(" | ") || "El SRI todavía no devuelve la autorización.",
    mensajes,
    fechaAutorizacion: "",
  }
}
