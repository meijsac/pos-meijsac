import { XMLParser } from "fast-xml-parser"
import { URL_AUTORIZACION_PRODUCCION, URL_AUTORIZACION_PRUEBAS, URL_RECEPCION_PRODUCCION, URL_RECEPCION_PRUEBAS, codigoAmbiente, type CodigoAmbiente } from "@/lib/sri/ambiente"
import type { SriAutorizacionResponse, SriRecepcionResponse } from "@/lib/sri/tipos"

const ESPERA_MS = 10000

export const URLS_SRI = {
  "1": { recepcion: URL_RECEPCION_PRUEBAS, autorizacion: URL_AUTORIZACION_PRUEBAS },
  "2": { recepcion: URL_RECEPCION_PRODUCCION, autorizacion: URL_AUTORIZACION_PRODUCCION },
} as const

/** WSDL Offline: soapAction vacío. No se envía el nombre validarComprobante. */
export const SOAP_ACTION_WSDL = ""

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  isArray: (nombre) => nombre === "mensaje" || nombre === "autorizacion" || nombre === "comprobante",
})

export class SriRedError extends Error {
  conectado = false as const
  codigo: "Timeout" | "ENOTFOUND" | "ECONNREFUSED"
  constructor(codigo: "Timeout" | "ENOTFOUND" | "ECONNREFUSED") {
    super(codigo === "Timeout"
      ? "El SRI tardó demasiado en responder (Timeout)."
      : "No se pudo establecer conexión física con los servidores del SRI. Revisa tu internet o el estado del SRI.")
    this.codigo = codigo
  }
}

export type ResultadoConexion = {
  conectado: boolean
  error?: string
  status: "RECEPCIONADO" | "DEVUELTA" | "AUTORIZADO" | "RECHAZADO" | "PENDIENTE" | "EN PROCESO" | "ERROR_SRI"
  fechaAutorizacion: string
  numeroAutorizacion: string
  mensajes: string[]
  recepcion: SriRecepcionResponse | null
  autorizacion: SriAutorizacionResponse | null
  ambiente: CodigoAmbiente
}

function endpoint(wsdl: string) {
  return wsdl.replace(/\?wsdl$/i, "")
}

function buscar(nodo: unknown, nombre: string): any {
  if (!nodo || typeof nodo !== "object") return null
  if (Array.isArray(nodo)) {
    for (const item of nodo) {
      const hallado = buscar(item, nombre)
      if (hallado) return hallado
    }
    return null
  }
  const obj = nodo as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(obj, nombre)) return obj[nombre]
  for (const valor of Object.values(obj)) {
    const hallado = buscar(valor, nombre)
    if (hallado) return hallado
  }
  return null
}

function tipoMensaje(valor: unknown): "ERROR" | "INFORMATIVO" {
  return String(valor || "").toUpperCase() === "INFORMATIVO" ? "INFORMATIVO" : "ERROR"
}

function mensajesDe(nodo: any): { mensaje: { identificador: string; mensaje: string; informacionAdicional?: string; tipo: "ERROR" | "INFORMATIVO" }[] } | undefined {
  const crudo = nodo?.mensajes?.mensaje ?? nodo?.mensaje
  const lista = Array.isArray(crudo) ? crudo : crudo ? [crudo] : []
  const mensaje = lista.map((m: any) => ({
    identificador: String(m?.identificador || ""),
    mensaje: String(m?.mensaje || ""),
    ...(m?.informacionAdicional ? { informacionAdicional: String(m.informacionAdicional) } : {}),
    tipo: tipoMensaje(m?.tipo),
  })).filter((m) => m.mensaje || m.identificador)
  return mensaje.length ? { mensaje } : undefined
}

function textos(mensajes?: { mensaje: { identificador: string; mensaje: string; informacionAdicional?: string }[] }) {
  return (mensajes?.mensaje || []).map((m) => [m.identificador, m.mensaje, m.informacionAdicional].filter(Boolean).join(" - ")).filter(Boolean)
}

export function mapearRecepcion(xml: string): SriRecepcionResponse | null {
  let json: unknown
  try { json = parser.parse(xml) } catch { return null }
  const caja = buscar(json, "RespuestaRecepcionComprobantes") || buscar(json, "RespuestaRecepcionComprobante")
  if (!caja || typeof caja !== "object") return null
  const crudo = String((caja as any).estado || "").toUpperCase()
  const estado: "RECEPCIONADO" | "DEVUELTA" = crudo.includes("DEVUELT") ? "DEVUELTA" : "RECEPCIONADO"
  const comprobantes = (caja as any).comprobantes?.comprobante || (caja as any).comprobante || []
  const primero = Array.isArray(comprobantes) ? comprobantes[0] : comprobantes
  return {
    RespuestaRecepcionComprobantes: {
      estado,
      comprobantes: {
        comprobantee: {
          claveAcceso: String(primero?.claveAcceso || ""),
          mensajes: mensajesDe(primero || caja),
        },
      },
    },
  }
}

export function mapearAutorizacion(xml: string): SriAutorizacionResponse | null {
  let json: unknown
  try { json = parser.parse(xml) } catch { return null }
  const caja = buscar(json, "RespuestaAutorizacionComprobante")
  if (!caja || typeof caja !== "object") return null
  const lista = (caja as any).autorizaciones?.autorizacion || buscar(caja, "autorizacion")
  const una = Array.isArray(lista) ? lista[0] : lista
  const crudo = String(una?.estado || "").toUpperCase()
  const estado: "AUTORIZADO" | "RECHAZADO" | "EN PROCESO" =
    crudo === "AUTORIZADO" ? "AUTORIZADO" : crudo.includes("PROCESO") || !crudo ? "EN PROCESO" : "RECHAZADO"
  const ambiente: "1" | "2" = String(una?.ambiente || "") === "2" ? "2" : "1"
  return {
    RespuestaAutorizacionComprobante: {
      numeroComprobantes: String((caja as any).numeroComprobantes || (una ? "1" : "0")),
      autorizaciones: {
        autorizacion: {
          estado,
          numeroAutorizacion: String(una?.numeroAutorizacion || ""),
          fechaAutorizacion: String(una?.fechaAutorizacion || ""),
          ambiente,
          comprobante: String(una?.comprobante || ""),
          mensajes: mensajesDe(una),
        },
      },
    },
  }
}

function falloRed(error: unknown): SriRedError | null {
  const err = error as { name?: string; message?: string; code?: string; cause?: { code?: string } }
  const code = String(err?.cause?.code || err?.code || "")
  const name = String(err?.name || "")
  if (name === "TimeoutError" || name === "AbortError" || code === "ETIMEDOUT" || /timeout/i.test(String(err?.message || ""))) {
    return new SriRedError("Timeout")
  }
  if (code === "ENOTFOUND") return new SriRedError("ENOTFOUND")
  if (code === "ECONNREFUSED") return new SriRedError("ECONNREFUSED")
  return null
}

function fault(xml: string) {
  const hallado = xml.match(/<(?:[\w-]+:)?faultstring>([\s\S]*?)<\/(?:[\w-]+:)?faultstring>/i)
  return hallado ? hallado[1].trim() : ""
}

async function postSoap(urlWsdl: string, cuerpo: string) {
  try {
    const res = await fetch(endpoint(urlWsdl), {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: SOAP_ACTION_WSDL,
      },
      body: cuerpo,
      signal: AbortSignal.timeout(ESPERA_MS),
      cache: "no-store",
    })
    const texto = await res.text()
    return { texto, statusHttp: res.status }
  } catch (error) {
    const red = falloRed(error)
    if (red) throw red
    throw error
  }
}

function sobreRecepcion(xmlFirmado: string) {
  const b64 = Buffer.from(xmlFirmado, "utf8").toString("base64")
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion"><soapenv:Header/><soapenv:Body><ec:validarComprobante><xml>${b64}</xml></ec:validarComprobante></soapenv:Body></soapenv:Envelope>`
}

function sobreAutorizacion(clave: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion"><soapenv:Header/><soapenv:Body><ec:autorizacionComprobante><claveAccesoComprobante>${clave}</claveAccesoComprobante></ec:autorizacionComprobante></soapenv:Body></soapenv:Envelope>`
}

function esperar(ms: number) {
  return new Promise((resolver) => setTimeout(resolver, ms))
}

export async function enviarAlSri(entrada: { xmlFirmado: string; claveAcceso: string; ambiente: unknown; recepcionUrl?: string; autorizacionUrl?: string }): Promise<ResultadoConexion> {
  const ambiente = codigoAmbiente(entrada.ambiente)
  const urls = {
    recepcion: entrada.recepcionUrl || URLS_SRI[ambiente].recepcion,
    autorizacion: entrada.autorizacionUrl || URLS_SRI[ambiente].autorizacion,
  }
  const vacio: ResultadoConexion = {
    conectado: false,
    status: "PENDIENTE",
    fechaAutorizacion: "",
    numeroAutorizacion: "",
    mensajes: [],
    recepcion: null,
    autorizacion: null,
    ambiente,
  }
  let recepcionXml = ""
  try {
    const respuesta = await postSoap(urls.recepcion, sobreRecepcion(entrada.xmlFirmado))
    recepcionXml = respuesta.texto
    if (respuesta.statusHttp < 200 || respuesta.statusHttp >= 300) {
      const fallaHttp = fault(recepcionXml)
      return {
        ...vacio,
        conectado: true,
        status: "ERROR_SRI",
        error: `Servidor SRI respondió con estado ${respuesta.statusHttp}`,
        mensajes: [fallaHttp, `Servidor SRI respondió con estado ${respuesta.statusHttp}`].filter(Boolean),
      }
    }
  } catch (error) {
    if (error instanceof SriRedError) return { ...vacio, conectado: false, error: error.message }
    return { ...vacio, conectado: false, error: error instanceof Error ? error.message : "El servicio del SRI no respondió" }
  }
  const recepcion = mapearRecepcion(recepcionXml)
  const falla = fault(recepcionXml)
  if (!recepcion) {
    return {
      ...vacio,
      conectado: true,
      status: "DEVUELTA",
      mensajes: [falla || "El SRI respondió, pero no devolvió RespuestaRecepcionComprobante."],
      error: falla || undefined,
    }
  }
  const mensajesRecepcion = textos(recepcion.RespuestaRecepcionComprobantes.comprobantes.comprobantee.mensajes)
  if (recepcion.RespuestaRecepcionComprobantes.estado === "DEVUELTA") {
    return {
      ...vacio,
      conectado: true,
      status: "DEVUELTA",
      mensajes: mensajesRecepcion.length ? mensajesRecepcion : [falla || "DEVUELTA"],
      recepcion,
    }
  }
  let autorizacion: SriAutorizacionResponse | null = null
  for (let intento = 0; intento < 3; intento++) {
    if (intento > 0) await esperar(3000)
    try {
      const respuesta = await postSoap(urls.autorizacion, sobreAutorizacion(entrada.claveAcceso))
      autorizacion = mapearAutorizacion(respuesta.texto)
      const estado = autorizacion?.RespuestaAutorizacionComprobante.autorizaciones.autorizacion.estado
      if (estado === "AUTORIZADO" || estado === "RECHAZADO") break
    } catch (error) {
      if (error instanceof SriRedError && intento === 2) {
        return {
          ...vacio,
          conectado: true,
          status: "PENDIENTE",
          mensajes: mensajesRecepcion,
          recepcion,
          error: error.message,
        }
      }
    }
  }
  const aut = autorizacion?.RespuestaAutorizacionComprobante.autorizaciones.autorizacion
  const fecha = String(aut?.fechaAutorizacion || "").trim()
  const mensajesAut = textos(aut?.mensajes)
  if (aut?.estado === "AUTORIZADO" && fecha) {
    return {
      conectado: true,
      status: "AUTORIZADO",
      fechaAutorizacion: fecha,
      numeroAutorizacion: aut.numeroAutorizacion || entrada.claveAcceso,
      mensajes: mensajesAut,
      recepcion,
      autorizacion,
      ambiente,
    }
  }
  if (aut?.estado === "RECHAZADO") {
    return {
      conectado: true,
      status: "RECHAZADO",
      fechaAutorizacion: "",
      numeroAutorizacion: "",
      mensajes: mensajesAut.length ? mensajesAut : ["RECHAZADO"],
      recepcion,
      autorizacion,
      ambiente,
    }
  }
  return {
    conectado: true,
    status: aut?.estado === "EN PROCESO" ? "EN PROCESO" : "PENDIENTE",
    fechaAutorizacion: "",
    numeroAutorizacion: "",
    mensajes: mensajesAut.length ? mensajesAut : mensajesRecepcion.length ? mensajesRecepcion : ["El SRI recibió el comprobante y todavía no devuelve la fecha de autorización."],
    recepcion,
    autorizacion,
    ambiente,
  }
}
