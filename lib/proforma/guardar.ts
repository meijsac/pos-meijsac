import { prisma } from "@/lib/prisma"
import { datosRegistroDe } from "@/lib/empresa-sesion"
import { itemProforma, numeroProforma, texto, totalesProforma, type ItemProforma } from "@/lib/proforma/calculos"
import { pdfProforma, type EmisorProforma } from "@/lib/proforma/pdf"
import { puntoActivoFactura } from "@/lib/sri/punto-emision"

export function emisorDeEmpresa(empresa: { razonSocial: string; nombreComercial: string | null; ruc: string; direccion: string | null; telefono: string | null; email: string | null; datosRegistro: unknown }): EmisorProforma {
  const extra = datosRegistroDe(empresa.datosRegistro)
  const sucursales = Array.isArray(extra.sucursales) ? extra.sucursales : []
  let sucursalDir = ""
  for (const fila of sucursales) {
    if (!fila || typeof fila !== "object") continue
    const dato = fila as Record<string, unknown>
    sucursalDir = texto(dato.dir || dato.direccion || "", 180)
    if (sucursalDir) break
  }
  return {
    razon: texto(extra.razonSocial || empresa.razonSocial, 180),
    comercial: texto(extra.nombreComercial || empresa.nombreComercial || "", 180),
    ruc: texto(empresa.ruc, 13),
    matriz: texto(extra.dirMatriz || empresa.direccion || "", 180),
    sucursal: texto(sucursalDir || extra.dirEstablecimiento || "", 180),
    obligado: texto(extra.obligadoConta || extra.obligadoContabilidad || extra.obligado || "NO", 20),
    regimen: texto(extra.regimen || "", 80),
    email: texto(empresa.email || extra.email || extra.correo || "", 120),
    telefono: texto(empresa.telefono || extra.telefono || extra.celular || "", 40),
  }
}

export function serieProforma(empresa: { ambienteSri?: string | null; datosRegistro: unknown }) {
  const extra = datosRegistroDe(empresa.datosRegistro)
  const punto = puntoActivoFactura(extra.secuenciales, empresa.ambienteSri || extra.ambiente || extra.ambienteCodigo).punto
  if (!punto.estab || !punto.pto) return ""
  return `${punto.estab}-${punto.pto}`
}

export function numeroVisible(numero: number, serie: string, guardado = "") {
  const propio = texto(guardado, 40)
  if (propio.includes("-")) return propio
  const correlativo = numeroProforma(numero)
  return serie ? `${serie}-${correlativo}` : correlativo
}

export function fechaHoy() {
  return new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date())
}

export function armarPayload(body: unknown, emisor: EmisorProforma, atendidoPor: string) {
  const pedido = body && typeof body === "object" ? body as Record<string, unknown> : {}
  const clienteRaw = pedido.cliente && typeof pedido.cliente === "object" ? pedido.cliente as Record<string, unknown> : {}
  const items = (Array.isArray(pedido.items) ? pedido.items : []).slice(0, 80).map(itemProforma).filter((item): item is ItemProforma => Boolean(item))
  if (!items.length) return { error: "Agrega al menos un producto con tarifa IVA" }
  const razon = texto(clienteRaw.razon, 180)
  const identificacion = texto(clienteRaw.identificacion, 20)
  if (!razon || !identificacion) return { error: "Falta el cliente" }
  const propina = Boolean(pedido.propina)
  const totales = totalesProforma(items, propina)
  if (!Number.isFinite(totales.total)) return { error: "No se puede calcular el total" }
  const cliente = {
    tipoDoc: texto(clienteRaw.tipoDoc, 4),
    identificacion,
    razon,
    direccion: texto(clienteRaw.direccion, 180),
    email: texto(clienteRaw.email, 120),
    telefono: texto(clienteRaw.telefono, 40),
  }
  return {
    payload: {
      emisor,
      cliente,
      items,
      propina,
      totales,
      fecha: fechaHoy(),
      atendidoPor: texto(atendidoPor, 80),
    },
  }
}

export async function crearProforma(empresaId: string, payload: Record<string, unknown>, serie: string) {
  for (let intento = 0; intento < 2; intento++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const maximo = await tx.proforma.aggregate({ where: { empresaId }, _max: { numero: true } })
        const numero = (maximo._max.numero || 0) + 1
        const visible = numeroVisible(numero, serie)
        return tx.proforma.create({ data: { empresaId, numero, estado: "GUARDADA", payload: { ...payload, numero: visible } } })
      })
    } catch (error) {
      if (intento === 1) throw error
    }
  }
  throw new Error("No se pudo guardar la proforma")
}

export function pdfDeProforma(numero: number, payload: Record<string, unknown>) {
  const emisor = payload.emisor && typeof payload.emisor === "object" ? payload.emisor as EmisorProforma : { razon: "", comercial: "", ruc: "", matriz: "", sucursal: "", obligado: "", regimen: "", email: "", telefono: "" }
  const clienteRaw = payload.cliente && typeof payload.cliente === "object" ? payload.cliente as Record<string, unknown> : {}
  const items = (Array.isArray(payload.items) ? payload.items : []).map(itemProforma).filter((item): item is ItemProforma => Boolean(item))
  const propina = Boolean(payload.propina)
  return pdfProforma({
    emisor,
    cliente: {
      razon: texto(clienteRaw.razon, 180),
      identificacion: texto(clienteRaw.identificacion, 20),
      direccion: texto(clienteRaw.direccion, 180),
      email: texto(clienteRaw.email, 120),
    },
    numero: numeroVisible(numero, "", texto(payload.numero, 40)),
    fecha: texto(payload.fecha, 20),
    items,
    totales: totalesProforma(items, propina),
    atendidoPor: texto(payload.atendidoPor, 80),
  })
}
