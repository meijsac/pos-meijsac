import { DOCUMENTOS_ADICIONALES, moduloPorSlug, nombreDocumentoAdicional } from "@/app/dashboard/comprobantes-adicionales/catalogo"
import { CARPETAS_PLAN } from "@/lib/suscripcion"

function lista(modulos: string[] | null | undefined) {
  return Array.isArray(modulos) && modulos.length > 0 ? modulos : null
}

export function seccionPermitida(modulos: string[] | null | undefined, seccion: string) {
  const nombres = lista(modulos)
  if (!nombres) return true
  return nombres.includes(seccion)
}

export function carpetaPermitida(modulos: string[] | null | undefined, carpeta: string) {
  const nombres = lista(modulos)
  if (!nombres) return true
  if (!nombres.includes("CONFIGURACIÓN")) return false
  if (!CARPETAS_PLAN.some((nombre) => nombres.includes(nombre))) return true
  return nombres.includes(carpeta)
}

export function documentoAdicionalPermitido(modulos: string[] | null | undefined, nombre: string) {
  const nombres = lista(modulos)
  if (!nombres) return true
  if (!nombres.includes("COMPROBANTES ADICIONALES")) return false
  if (!DOCUMENTOS_ADICIONALES.some((item) => nombres.includes(item))) return true
  return nombres.includes(nombre)
}

function documentoDeRuta(ruta: string) {
  if (ruta === "/dashboard/proforma" || ruta.startsWith("/dashboard/proforma?")) return "Proforma"
  if (ruta.startsWith("/dashboard/proforma/emitidas")) return "Proformas emitidas"
  const partes = ruta.match(/^\/dashboard\/comprobantes-adicionales\/([^/]+)\/([^/]+)/)
  if (!partes) return ""
  const modulo = moduloPorSlug(partes[1])
  if (!modulo) return ""
  if (partes[2] === "imprimir") return nombreDocumentoAdicional(modulo.titulo, "Historia clínica")
  const documento = modulo.documentos?.find((item) => item.slug === partes[2])
  if (!documento) return ""
  return nombreDocumentoAdicional(modulo.titulo, documento.titulo)
}

const SECCIONES: [string, string][] = [
  ["/dashboard/configuracion", "CONFIGURACIÓN"],
  ["/dashboard/comprobantes", "COMPROBANTES ELECTRÓNICOS"],
  ["/dashboard/factura-xml", "COMPROBANTES ELECTRÓNICOS"],
  ["/dashboard/nota-credito-xml", "COMPROBANTES ELECTRÓNICOS"],
  ["/dashboard/nota-debito-xml", "COMPROBANTES ELECTRÓNICOS"],
  ["/dashboard/guia-remision-xml", "COMPROBANTES ELECTRÓNICOS"],
  ["/dashboard/liquidacion-xml", "COMPROBANTES ELECTRÓNICOS"],
  ["/dashboard/retencion-xml", "COMPROBANTES ELECTRÓNICOS"],
  ["/dashboard/pos-ticket", "POS TICKET"],
  ["/dashboard/restaurante", "RESTAURANTE POS"],
  ["/dashboard/contabilidad", "CONTABILIDAD"],
  ["/dashboard/cxc", "CUENTAS POR COBRAR"],
  ["/dashboard/productos", "INVENTARIO"],
  ["/dashboard/caja", "CAJA"],
  ["/dashboard/clientes", "CLIENTES"],
  ["/dashboard/reportes", "REPORTES"],
  ["/dashboard/respaldo", "RESPALDO / RESTAURAR"],
]

export function rutaDePlanPermitida(ruta: string, modulos: string[] | null | undefined) {
  if (!ruta.startsWith("/dashboard") || ruta === "/dashboard") return true
  const documento = documentoDeRuta(ruta)
  if (documento) return documentoAdicionalPermitido(modulos, documento)
  if (ruta.startsWith("/dashboard/comprobantes-adicionales") || ruta.startsWith("/dashboard/proforma")) {
    return seccionPermitida(modulos, "COMPROBANTES ADICIONALES")
  }
  if (ruta.startsWith("/dashboard/configuracion/catalogo-sri") || ruta.startsWith("/dashboard/catalogos-sri")) {
    return seccionPermitida(modulos, "CONFIGURACIÓN") && carpetaPermitida(modulos, "Catálogo SRI")
  }
  const seccion = SECCIONES.find(([prefijo]) => ruta === prefijo || ruta.startsWith(`${prefijo}/`))
  if (!seccion) return true
  return seccionPermitida(modulos, seccion[1])
}
