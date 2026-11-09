export const URL_RECEPCION_PRUEBAS = "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl"
export const URL_AUTORIZACION_PRUEBAS = "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl"
export const URL_RECEPCION_PRODUCCION = "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl"
export const URL_AUTORIZACION_PRODUCCION = "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl"

export const SRI_AMBIENTES = {
  "1": {
    codigo: "1" as const,
    nombre: "PRUEBAS",
    recepcion: URL_RECEPCION_PRUEBAS,
    autorizacion: URL_AUTORIZACION_PRUEBAS,
  },
  "2": {
    codigo: "2" as const,
    nombre: "PRODUCCION",
    recepcion: URL_RECEPCION_PRODUCCION,
    autorizacion: URL_AUTORIZACION_PRODUCCION,
  },
}

export type CodigoAmbiente = "1" | "2"

export function codigoAmbiente(valor: unknown): CodigoAmbiente {
  const texto = String(valor || "").trim().toUpperCase()
  if (texto === "2" || texto.includes("PROD")) return "2"
  return "1"
}

export function ambienteSri(valor: unknown) {
  return SRI_AMBIENTES[codigoAmbiente(valor)]
}

export function envioSriPermitido() {
  return process.env.SRI_ENVIO_AUTORIZADO === "1"
}
