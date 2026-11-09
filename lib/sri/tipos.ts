export interface SriRecepcionResponse {
  RespuestaRecepcionComprobantes: {
    estado: "RECEPCIONADO" | "DEVUELTA"
    comprobantes: { comprobantee: { claveAcceso: string; mensajes?: { mensaje: { identificador: string; mensaje: string; informacionAdicional?: string; tipo: "ERROR" | "INFORMATIVO" }[] } } }
  }
}

export interface SriAutorizacionResponse {
  RespuestaAutorizacionComprobante: {
    numeroComprobantes: string
    autorizaciones: { autorizacion: {
      estado: "AUTORIZADO" | "RECHAZADO" | "EN PROCESO"
      numeroAutorizacion: string
      fechaAutorizacion: string
      ambiente: "1" | "2"
      comprobante: string
      mensajes?: { mensaje: { identificador: string; mensaje: string; informacionAdicional?: string; tipo: "ERROR" | "INFORMATIVO" }[] }
    } }
  }
}
