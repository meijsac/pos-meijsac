import { prisma } from "@/lib/prisma"
import { clasificarEstadoSri } from "@/lib/sri/estado-visible"
import { guardarRespaldo } from "@/lib/sri/respaldo"
import { enviarCorreosFactura } from "@/lib/correo/factura"
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
  const dueña = await prisma.facturaEmitida.findUnique({ where: { id: facturaId }, select: { empresaId: true } })
  const respaldo = dueña?.empresaId
    ? await guardarRespaldo(dueña.empresaId, String(body.claveAcceso || ""), String(body.xmlContent || ""), {
      estado: estadoGuardado,
      fechaAutorizacion: fechaSri,
      numeroAutorizacion: body.numeroAutorizacion || "",
      mensajes: resultado.mensajes,
    }, body)
    : { respaldoOk: false, respaldoError: "No se pudo guardar el XML y el RIDE. El comprobante sigue en el sistema, pero el archivo no quedó en el depósito.", conservarHasta: "" }
  body.respaldoOk = respaldo.respaldoOk
  body.respaldoError = respaldo.respaldoError
  body.conservarHasta = respaldo.conservarHasta
  const xmlAutorizado = String(real.autorizacion?.RespuestaAutorizacionComprobante.autorizaciones.autorizacion.comprobante || "")
  body.correoRegistro = await enviarCorreosFactura(body, xmlAutorizado.startsWith("<") ? xmlAutorizado : String(body.xmlContent || "")).catch(() => "")
  await prisma.facturaEmitida.update({
    where: { id: facturaId },
    data: { payload: body },
  }).catch(() => {})
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
    respaldoOk: respaldo.respaldoOk,
    respaldoError: respaldo.respaldoError,
    conservarHasta: respaldo.conservarHasta,
  }
}
