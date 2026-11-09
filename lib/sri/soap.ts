import { ambienteSri, type CodigoAmbiente } from "@/lib/sri/ambiente"

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
  const fechaRecepcion = new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" })
  if (estadoRecepcion === "DEVUELTA") {
    return {
      enviado: true, bloqueado: false, estado: "DEVUELTA",
      mensaje: avisos.join(" | ") || "DEVUELTA", mensajes: avisos,
      estadoRecepcion: "DEVUELTA", mensajeRecepcion: avisos.join(" | ") || "DEVUELTA", fechaRecepcion,
    }
  }
  if (estadoRecepcion !== "RECIBIDA") {
    const falla = textoTag(recepcion, "faultstring")
    return {
      enviado: true, bloqueado: false, estado: "PENDIENTE_DE_AUTORIZAR",
      mensaje: falla || avisos.join(" | ") || "El SRI no respondió RECIBIDA ni DEVUELTA", mensajes: avisos,
      estadoRecepcion, mensajeRecepcion: falla || avisos.join(" | "), fechaRecepcion,
    }
  }
  let leido = { estado: "", numero: "", fecha: "", mensajes: [] as string[] }
  for (let intento = 0; intento < 3; intento++) {
    if (intento > 0) await esperar(3000)
    let autorizacion = ""
    try {
      autorizacion = await postSoap(urls.autorizacion, sobreAutorizacion(entrada.claveAcceso), "autorizacionComprobante")
    } catch (e: any) {
      if (intento === 2) {
        return {
          enviado: true, bloqueado: false, estado: "PENDIENTE_DE_AUTORIZAR",
          mensaje: `El SRI recibió el comprobante y todavía no autoriza: ${e.message}`, mensajes: avisos,
          estadoRecepcion: "RECIBIDA", mensajeRecepcion: avisos.join(" | ") || "RECIBIDA", fechaRecepcion,
        }
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
  if (leido.estado === "AUTORIZADO" && leido.fecha) {
    return {
      enviado: true,
      bloqueado: false,
      estado: "AUTORIZADO",
      mensaje: leido.mensajes.join(" | ") || "AUTORIZADO",
      numeroAutorizacion: leido.numero || entrada.claveAcceso,
      fechaAutorizacion: leido.fecha,
      mensajes: leido.mensajes,
      estadoRecepcion: "RECIBIDA",
      mensajeRecepcion: avisos.join(" | ") || "RECIBIDA",
      fechaRecepcion: new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" }),
      estadoAutorizacion: "AUTORIZADO",
      mensajeAutorizacion: leido.mensajes.join(" | ") || "AUTORIZADO",
    }
  }
  if (leido.estado === "AUTORIZADO" && !leido.fecha) {
    return {
      enviado: true,
      bloqueado: false,
      estado: "PENDIENTE_DE_AUTORIZAR",
      mensaje: "El SRI respondió AUTORIZADO, pero no devolvió la fecha de autorización.",
      numeroAutorizacion: leido.numero || "",
      fechaAutorizacion: "",
      mensajes: leido.mensajes,
      estadoRecepcion: "RECIBIDA",
      mensajeRecepcion: avisos.join(" | ") || "RECIBIDA",
      fechaRecepcion: new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" }),
      estadoAutorizacion: "",
      mensajeAutorizacion: "Sin fecha de autorización del SRI",
    }
  }
  if (leido.estado === "NO AUTORIZADO") {
    return {
      enviado: true,
      bloqueado: false,
      estado: "NO AUTORIZADO",
      mensaje: leido.mensajes.join(" | ") || "NO AUTORIZADO",
      mensajes: leido.mensajes,
      estadoRecepcion: "RECIBIDA",
      mensajeRecepcion: avisos.join(" | ") || "RECIBIDA",
      fechaRecepcion: new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" }),
      estadoAutorizacion: "NO AUTORIZADO",
      mensajeAutorizacion: leido.mensajes.join(" | ") || "NO AUTORIZADO",
    }
  }
  return {
    enviado: true,
    bloqueado: false,
    estado: "PENDIENTE_DE_AUTORIZAR",
    mensaje: leido.mensajes.join(" | ") || "El SRI recibió el comprobante y todavía no devuelve autorización",
    mensajes: leido.mensajes,
    estadoRecepcion: "RECIBIDA",
    mensajeRecepcion: avisos.join(" | ") || "RECIBIDA",
    fechaRecepcion: new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" }),
    estadoAutorizacion: "",
    mensajeAutorizacion: "",
  }
}

export async function consultarAutorizacion(entrada: { claveAcceso: string; ambiente: CodigoAmbiente }): Promise<ResultadoSri> {
  const urls = ambienteSri(entrada.ambiente)
  let autorizacion = ""
  try {
    autorizacion = await postSoap(urls.autorizacion, sobreAutorizacion(entrada.claveAcceso), "autorizacionComprobante")
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
