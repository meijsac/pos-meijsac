import { prisma } from "@/lib/prisma"
import { clasificarEstadoSri } from "@/lib/sri/estado-visible"
import type { ResultadoConexion } from "@/lib/sri/cliente-sri"

export function sriStatusDe(estado: string, fecha: string) {
  if (estado === "BORRADOR") return "BORRADOR"
  return clasificarEstadoSri(estado, fecha)
}

export async function guardarRespuestaSri(facturaId: string, body: any, real: ResultadoConexion) {
  const resultado = {
    fechaAutorizacion: real.fechaAutorizacion,
    estado: real.status === "AUTORIZADO" ? "AUTORIZADO" : real.status === "DEVUELTA" ? "DEVUELTA" : real.status === "RECHAZADO" ? "NO AUTORIZADO" : "PENDIENTE_DE_AUTORIZAR",
    mensaje: real.mensajes.join(" | ") || real.error || real.status,
    mensajes: real.mensajes,
    numeroAutorizacion: real.fechaAutorizacion ? real.numeroAutorizacion : "",
    estadoRecepcion: real.recepcion?.RespuestaRecepcionComprobantes.estado || "",
    estadoAutorizacion: real.status === "AUTORIZADO" && real.fechaAutorizacion ? "AUTORIZADO" : real.status === "RECHAZADO" ? "RECHAZADO" : "",
    conectado: real.conectado,
    statusSri: real.status,
    errorRed: real.error || "",
    recepcionSri: real.recepcion,
    autorizacionSri: real.autorizacion,
  }
  const fechaSri = resultado.fechaAutorizacion || ""
  const visible = clasificarEstadoSri(resultado.estado, fechaSri)
  const estadoGuardado = visible === "AUTORIZADO" ? "AUTORIZADO" : visible
  body.estadoSRI = estadoGuardado
  body.mensajeSri = resultado.mensaje
  body.mensajesSri = resultado.mensajes
  body.numeroAutorizacion = fechaSri ? (resultado.numeroAutorizacion || "") : ""
  body.fechaAutorizacion = fechaSri
  body.estadoRecepcion = resultado.estadoRecepcion || ""
  body.mensajeRecepcion = resultado.mensaje
  body.estadoAutorizacion = resultado.estadoAutorizacion || ""
  body.mensajeAutorizacion = resultado.mensaje
  body.enviado = real.conectado
  body.conectado = real.conectado !== false
  body.sriRecepcion = resultado.recepcionSri || null
  body.sriAutorizacion = resultado.autorizacionSri || null
  const sriStatus = sriStatusDe(estadoGuardado, fechaSri)
  await prisma.facturaEmitida.update({
    where: { id: facturaId },
    data: { estado: estadoGuardado, sriStatus, payload: body },
  })
  return {
    estado: estadoGuardado,
    sriStatus,
    mensaje: resultado.mensaje,
    mensajes: resultado.mensajes,
    numeroAutorizacion: fechaSri ? (resultado.numeroAutorizacion || "") : "",
    fechaAutorizacion: fechaSri,
    estadoRecepcion: resultado.estadoRecepcion || "",
    conectado: real.conectado !== false,
    error: resultado.errorRed || "",
    status: resultado.statusSri === "ERROR_SRI" || resultado.statusSri === "DEVUELTA" ? resultado.statusSri : (resultado.estado === "DEVUELTA" || resultado.estadoRecepcion === "DEVUELTA" ? "DEVUELTA" : estadoGuardado),
    sriRecepcion: resultado.recepcionSri || null,
    sriAutorizacion: resultado.autorizacionSri || null,
  }
}
