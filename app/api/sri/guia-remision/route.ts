import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { claveAcceso49 } from "@/lib/sri/clave"
import { ambienteDeEmpresa, SRI_AMBIENTES } from "@/lib/sri/ambiente"
import { enviarAlSri } from "@/lib/sri/cliente-sri"
import { firmarXmlEmpresa } from "@/lib/sri/firmar"
import { sanitizarTextoXml as xml } from "@/lib/sri/sanitizar"
import { ipDe } from "@/lib/seguridad"
import { archivarComprobante } from "@/lib/security/storage"
import { puntoActivoFactura } from "@/lib/sri/punto-emision"

function obtenerFechaEcuador() {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date())
}

function soloFecha(valor: unknown) {
  const texto = String(valor || "").trim()
  const dmy = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (dmy) return `${dmy[1]}/${dmy[2]}/${dmy[3]}`
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return ""
}

function numeroFactura(estab: unknown, secuencial: unknown) {
  const serie = String(estab || "")
  const partes = serie.split("-")
  const e = String(partes[0] || "").replace(/\D/g, "").padStart(3, "0").slice(-3)
  const p = String(partes[1] || "").replace(/\D/g, "").padStart(3, "0").slice(-3)
  const s = String(secuencial || "").replace(/\D/g, "").padStart(9, "0").slice(-9)
  if (!e || e === "000" || !p || !s || s === "000000000") return ""
  return `${e}-${p}-${s}`
}

function normalizarNumero(valor: unknown) {
  const texto = String(valor || "").trim()
  if (/^\d{3}-\d{3}-\d{9}$/.test(texto)) return texto
  const digitos = texto.replace(/\D/g, "")
  if (digitos.length < 15) return ""
  const quince = digitos.slice(-15)
  return `${quince.slice(0, 3)}-${quince.slice(3, 6)}-${quince.slice(6)}`
}

const MOTIVOS: Record<string, string> = {
  "01": "VENTA",
  "02": "COMPRA",
  "03": "TRASLADO ENTRE LOCALES",
  "04": "CONSIGNACION",
  "05": "DEVOLUCION",
  "06": "TRASLADO ENTRE BODEGAS",
  "07": "IMPORTACION",
  "08": "TRANSFORMACION",
}

function motivoTexto(valor: unknown) {
  const texto = String(valor || "").trim().toUpperCase()
  return MOTIVOS[texto] || texto
}

function extraDe(datos: unknown) {
  return datos && typeof datos === "object" && !Array.isArray(datos) ? datos as Record<string, unknown> : {}
}

function autorizado(fila: { estado: string; payload: unknown }) {
  const p = (fila.payload || {}) as Record<string, any>
  return String(fila.estado || p.estadoSRI || "").toUpperCase() === "AUTORIZADO" && String(p.fechaAutorizacion || "").trim().length > 0
}

function tipoDe(payload: Record<string, any>) {
  return String(payload.tipoComprobante || payload.codDoc || "01")
}

function enviadoAntes(filas: Array<{ estado: string; payload: unknown }>, numero: string) {
  const mapa = new Map<string, number>()
  for (const fila of filas) {
    if (!autorizado(fila)) continue
    const guia = (fila.payload || {}) as Record<string, any>
    if (tipoDe(guia) !== "06") continue
    const destinos = Array.isArray(guia.destinatarios) ? guia.destinatarios : []
    for (const dest of destinos) {
      if (normalizarNumero(dest?.numDocSustento) !== numero) continue
      const productos = Array.isArray(dest?.productos) ? dest.productos : []
      for (const linea of productos) {
        const codigo = String(linea?.codigoInterno || linea?.codigo || "")
        const cantidad = Number(linea?.cantidad ?? linea?.cantidadEnviar ?? linea?.cantidadTransportada ?? 0)
        mapa.set(codigo, (mapa.get(codigo) || 0) + cantidad)
      }
    }
  }
  return mapa
}

export async function GET(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ mensaje: sesion.error }, { status: sesion.status })
    const numero = normalizarNumero(new URL(req.url).searchParams.get("numero"))
    const tipo = String(new URL(req.url).searchParams.get("tipo") || "01")
    if (!numero) return NextResponse.json({ mensaje: "Escribe el número completo, por ejemplo 001-002-000000147." }, { status: 400 })
    const filas = await prisma.facturaEmitida.findMany({
      where: { empresaId: sesion.empresa.id },
      orderBy: { createdAt: "desc" },
      take: 500,
    })
    const factura = filas.find((fila) => {
      const p = (fila.payload || {}) as Record<string, any>
      if (tipoDe(p) !== tipo || !autorizado(fila)) return false
      return numeroFactura(p.establecimiento, p.secuencial) === numero || normalizarNumero(p.secuencial) === numero
    })
    if (!factura) return NextResponse.json({ mensaje: "No hay un comprobante autorizado con ese número." }, { status: 404 })
    const p = (factura.payload || {}) as Record<string, any>
    const clave = String(p.claveAcceso || "").replace(/\D/g, "")
    if (clave.length !== 49) return NextResponse.json({ mensaje: "Ese comprobante no tiene una autorización de 49 dígitos." }, { status: 422 })
    const yaEnviado = enviadoAntes(filas, numero)
    const productos = (Array.isArray(p.items) ? p.items : []).map((item: Record<string, unknown>) => {
      const codigo = String(item.codigo || item.codigoPrincipal || "")
      const original = Number(item.cant ?? item.cantidad ?? 0)
      const pendiente = Math.max(0, original - (yaEnviado.get(codigo) || 0))
      return { codigo, descripcion: String(item.descripcion || ""), cantidadFacturada: original, cantidadPendiente: pendiente }
    }).filter((item) => item.codigo && item.cantidadPendiente > 0)
    const id = String(p.cliente?.identificacion || "").replace(/\D/g, "")
    return NextResponse.json({
      numero,
      cliente: String(p.cliente?.razon || ""),
      identificacion: id,
      direccion: String(p.cliente?.direccion || p.cliente?.dir || ""),
      fecha: soloFecha(p.fechaEmisionFormato || p.fechaEmision),
      autorizacion: clave,
      productos,
    })
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : "No se pudo leer el comprobante."
    return NextResponse.json({ mensaje }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ autorizado: false, mensaje: sesion.error }, { status: sesion.status })
    const body = await req.json()
    const extra = extraDe(sesion.empresa.datosRegistro)
    const punto = puntoActivoFactura(extra.secuenciales, extra.ambiente)
    if (!punto.punto.estab || !punto.punto.pto) return NextResponse.json({ autorizado: false, mensaje: punto.aviso || "Configura el punto de emisión." }, { status: 400 })
    const placa = String(body?.placa || "").toUpperCase().replace(/[^A-Z0-9-]/g, "")
    const tipoId = String(body?.tipoIdentificacionTransportista || "")
    const idTransporte = String(body?.rucTransportista || "").trim()
    const transportista = String(body?.razonSocialTransportista || "").trim()
    const partida = String(body?.dirPartida || "").trim()
    const inicio = soloFecha(body?.fechaIniTransporte)
    const fin = soloFecha(body?.fechaFinTransporte)
    const destinatarios = Array.isArray(body?.destinatarios) ? body.destinatarios : []
    if (!transportista || !partida) return NextResponse.json({ autorizado: false, mensaje: "Faltan el transportista o el punto de partida." }, { status: 400 })
    if (!/^[A-Z0-9-]{1,8}$/.test(placa)) return NextResponse.json({ autorizado: false, mensaje: "La placa debe tener hasta 8 caracteres, letras, números o guion." }, { status: 400 })
    if (!["04", "05", "06"].includes(tipoId)) return NextResponse.json({ autorizado: false, mensaje: "Elige RUC, cédula o pasaporte del transportista." }, { status: 400 })
    if (tipoId === "04" && !/^\d{13}$/.test(idTransporte)) return NextResponse.json({ autorizado: false, mensaje: "El RUC del transportista debe tener 13 dígitos." }, { status: 400 })
    if (tipoId === "05" && !/^\d{10}$/.test(idTransporte)) return NextResponse.json({ autorizado: false, mensaje: "La cédula del transportista debe tener 10 dígitos." }, { status: 400 })
    if (tipoId === "06" && idTransporte.length < 3) return NextResponse.json({ autorizado: false, mensaje: "Escribe el pasaporte del transportista." }, { status: 400 })
    if (!inicio || !fin) return NextResponse.json({ autorizado: false, mensaje: "Las fechas del traslado deben ir en día/mes/año, sin hora." }, { status: 400 })
    if (!destinatarios.length) return NextResponse.json({ autorizado: false, mensaje: "Agrega al menos una entrega." }, { status: 400 })

    const filas = await prisma.facturaEmitida.findMany({ where: { empresaId: sesion.empresa.id }, orderBy: { createdAt: "desc" }, take: 500 })
    const limpios = []
    for (const dest of destinatarios) {
      const numero = normalizarNumero(dest?.numDocSustento)
      const codDoc = String(dest?.codDocSustento || "01")
      const autorizacion = String(dest?.numAutDocSustento || "").replace(/\D/g, "")
      const fechaDoc = soloFecha(dest?.fechaEmisionDocSustento)
      const motivo = motivoTexto(dest?.motivoTraslado)
      if (!numero || !fechaDoc || !motivo || !String(dest?.razonSocialDestinatario || "").trim() || !String(dest?.dirDestinatario || "").trim()) {
        return NextResponse.json({ autorizado: false, mensaje: "Cada entrega necesita cliente, dirección, motivo, factura y fecha." }, { status: 400 })
      }
      if (autorizacion.length !== 49 && autorizacion.length !== 10) {
        return NextResponse.json({ autorizado: false, mensaje: "La autorización del sustento debe tener 49 dígitos, o 10 si es un comprobante físico." }, { status: 400 })
      }
      const origen = filas.find((fila) => {
        const p = (fila.payload || {}) as Record<string, any>
        return tipoDe(p) === codDoc && autorizado(fila) && (numeroFactura(p.establecimiento, p.secuencial) === numero || normalizarNumero(p.secuencial) === numero)
      })
      if (codDoc === "01" && !origen) return NextResponse.json({ autorizado: false, mensaje: `La factura ${numero} no está autorizada.` }, { status: 404 })
      if (origen) {
        const clave = String(((origen.payload || {}) as Record<string, any>).claveAcceso || "").replace(/\D/g, "")
        if (autorizacion !== clave) return NextResponse.json({ autorizado: false, mensaje: `La autorización de ${numero} no coincide con la factura.` }, { status: 400 })
      }
      const productos = (Array.isArray(dest?.productos) ? dest.productos : [])
        .map((prod: { codigoInterno?: string; codigo?: string; descripcion?: string; cantidadEnviar?: number; cantidad?: number }) => ({
          codigoInterno: String(prod.codigoInterno || prod.codigo || ""),
          descripcion: String(prod.descripcion || ""),
          cantidad: Number(prod.cantidadEnviar ?? prod.cantidad ?? 0),
        }))
        .filter((prod: { cantidad: number }) => prod.cantidad > 0)
      if (!productos.length) return NextResponse.json({ autorizado: false, mensaje: `La entrega ${numero} no tiene productos por enviar.` }, { status: 400 })
      limpios.push({
        identificacionDestinatario: String(dest.identificacionDestinatario || "").trim(),
        razonSocialDestinatario: String(dest.razonSocialDestinatario).trim(),
        dirDestinatario: String(dest.dirDestinatario).trim(),
        motivoTraslado: motivo,
        codDocSustento: codDoc,
        numDocSustento: numero,
        numAutDocSustento: autorizacion,
        fechaEmisionDocSustento: fechaDoc,
        productos,
      })
    }

    const pedido = new Map<string, Map<string, number>>()
    for (const dest of limpios) {
      const porCodigo = pedido.get(dest.numDocSustento) || new Map<string, number>()
      for (const prod of dest.productos) porCodigo.set(prod.codigoInterno, (porCodigo.get(prod.codigoInterno) || 0) + prod.cantidad)
      pedido.set(dest.numDocSustento, porCodigo)
    }
    for (const [numero, porCodigo] of pedido) {
      const origen = filas.find((fila) => {
        const p = (fila.payload || {}) as Record<string, any>
        return autorizado(fila) && (numeroFactura(p.establecimiento, p.secuencial) === numero || normalizarNumero(p.secuencial) === numero)
      })
      if (!origen) continue
      const items = Array.isArray(((origen.payload || {}) as Record<string, any>).items) ? ((origen.payload || {}) as Record<string, any>).items : []
      const ya = enviadoAntes(filas, numero)
      for (const [codigo, cantidad] of porCodigo) {
        const item = items.find((linea: Record<string, unknown>) => String(linea.codigo || linea.codigoPrincipal || "") === codigo)
        const original = Number(item?.cant ?? item?.cantidad ?? 0)
        const pendiente = Math.max(0, original - (ya.get(codigo) || 0))
        if (!item || cantidad > pendiente + 0.0001) {
          return NextResponse.json({ autorizado: false, mensaje: `La cantidad de ${codigo} supera lo pendiente de la factura ${numero}.` }, { status: 400 })
        }
      }
    }

    const { estab, pto } = punto.punto
    const usados = new Set<string>()
    const mapa = extra.secuenciales06 && typeof extra.secuenciales06 === "object" ? extra.secuenciales06 as Record<string, string> : {}
    const guardado = String(mapa[`${estab}-${pto}`] || "").replace(/\D/g, "")
    if (guardado) usados.add(guardado.padStart(9, "0").slice(-9))
    for (const fila of filas) {
      const guia = (fila.payload || {}) as Record<string, any>
      if (tipoDe(guia) !== "06" || `${guia.establecimiento}` !== `${estab}-${pto}`) continue
      const n = String(guia.secuencial || "").replace(/\D/g, "").padStart(9, "0").slice(-9)
      if (n && n !== "000000000") usados.add(n)
    }
    let mayor = 0
    for (const n of usados) mayor = Math.max(mayor, Number(n))
    const secuencial = String(mayor + 1).padStart(9, "0")
    const ambiente = ambienteDeEmpresa(sesion.empresa)
    const ruc = String(sesion.empresa.ruc || "").replace(/\D/g, "")
    const fechaHoy = obtenerFechaEcuador()
    const claveAcceso = claveAcceso49({
      fecha: fechaHoy.replace(/\D/g, ""),
      tipoComprobante: "06",
      ruc,
      ambiente,
      establecimiento: estab,
      puntoEmision: pto,
      secuencial,
    })
    const direccion = String(extra.dirMatriz || sesion.empresa.direccion || "")
    const sucursal = String(extra.dirEstablecimiento || direccion)
    const obligado = String(extra.obligadoConta || extra.obligado || "NO").toUpperCase() === "SI" ? "SI" : "NO"
    const xmlSinFirmar = `<?xml version="1.0" encoding="UTF-8"?>
<guiaRemision id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${xml(sesion.empresa.razonSocial)}</razonSocial>
    <ruc>${ruc}</ruc>
    <claveAcceso>${claveAcceso}</claveAcceso>
    <codDoc>06</codDoc>
    <estab>${estab}</estab>
    <ptoEmi>${pto}</ptoEmi>
    <secuencial>${secuencial}</secuencial>
    <dirMatriz>${xml(direccion)}</dirMatriz>
  </infoTributaria>
  <infoGuiaRemision>
    <dirEstablecimiento>${xml(sucursal)}</dirEstablecimiento>
    <dirPartida>${xml(partida)}</dirPartida>
    <razonSocialTransportista>${xml(transportista)}</razonSocialTransportista>
    <tipoIdentificacionTransportista>${tipoId}</tipoIdentificacionTransportista>
    <rucTransportista>${xml(idTransporte)}</rucTransportista>
    <obligadoContabilidad>${obligado}</obligadoContabilidad>
    <fechaIniTransporte>${inicio}</fechaIniTransporte>
    <fechaFinTransporte>${fin}</fechaFinTransporte>
    <placa>${xml(placa)}</placa>
  </infoGuiaRemision>
  <destinatarios>
    ${limpios.map((dest) => `<destinatario>
      <identificacionDestinatario>${xml(dest.identificacionDestinatario)}</identificacionDestinatario>
      <razonSocialDestinatario>${xml(dest.razonSocialDestinatario)}</razonSocialDestinatario>
      <dirDestinatario>${xml(dest.dirDestinatario)}</dirDestinatario>
      <motivoTraslado>${xml(dest.motivoTraslado)}</motivoTraslado>
      <codDocSustento>${xml(dest.codDocSustento)}</codDocSustento>
      <numDocSustento>${xml(dest.numDocSustento)}</numDocSustento>
      <numAutDocSustento>${dest.numAutDocSustento}</numAutDocSustento>
      <fechaEmisionDocSustento>${dest.fechaEmisionDocSustento}</fechaEmisionDocSustento>
      <detalles>
        ${dest.productos.map((prod) => `<detalle><codigoInterno>${xml(prod.codigoInterno)}</codigoInterno><descripcion>${xml(prod.descripcion)}</descripcion><cantidad>${prod.cantidad.toFixed(2)}</cantidad></detalle>`).join("")}
      </detalles>
    </destinatario>`).join("")}
  </destinatarios>
</guiaRemision>`
    let firmado = ""
    try {
      firmado = await firmarXmlEmpresa(sesion.empresa.id, xmlSinFirmar)
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : "No se pudo firmar"
      return NextResponse.json({ autorizado: false, mensaje }, { status: 400 })
    }
    const urls = SRI_AMBIENTES[ambiente]
    const real = await enviarAlSri({ xmlFirmado: firmado, claveAcceso, ambiente, recepcionUrl: urls.recepcion, autorizacionUrl: urls.autorizacion })
    const fechaSri = String(real.fechaAutorizacion || "").trim()
    archivarComprobante(sesion.empresa.id, claveAcceso, firmado, real).catch(() => {})
    await prisma.facturaEmitida.create({
      data: {
        empresaId: sesion.empresa.id,
        estado: fechaSri ? "AUTORIZADO" : "PENDIENTE",
        sriStatus: fechaSri ? "AUTORIZADO" : "PENDIENTE",
        payload: {
          tipoComprobante: "06",
          codDoc: "06",
          claveAcceso,
          establecimiento: `${estab}-${pto}`,
          secuencial,
          fechaEmisionFormato: fechaHoy,
          fechaIniTransporte: inicio,
          fechaFinTransporte: fin,
          dirPartida: partida,
          transportista: { razon: transportista, tipoId, identificacion: idTransporte, placa },
          destinatarios: limpios,
          configEmisor: {
            razon: sesion.empresa.razonSocial,
            comercial: sesion.empresa.nombreComercial || sesion.empresa.nombre || "",
            ruc,
            matriz: direccion,
            sucursal,
            obligado,
            regimen: String(extra.regimen || ""),
            ambiente: ambiente === "2" ? "PRODUCCIÓN" : "PRUEBAS",
          },
          xmlContent: firmado,
          fechaAutorizacion: fechaSri,
          estadoSRI: fechaSri ? "AUTORIZADO" : "PENDIENTE",
          sriAutorizacion: real.autorizacion,
        },
      },
    })
    if (fechaSri) {
      await prisma.empresa.update({
        where: { id: sesion.empresa.id },
        data: { datosRegistro: { ...extra, secuenciales06: { ...mapa, [`${estab}-${pto}`]: secuencial } } },
      })
    }
    prisma.seguridadLog.create({ data: { empresaId: sesion.empresa.id, usuario: sesion.usuario.nombre, ip: ipDe(req), accion: fechaSri ? "GUIA_AUTORIZADA" : "GUIA_PENDIENTE", detalle: claveAcceso } }).catch(() => {})
    return NextResponse.json({
      autorizado: Boolean(fechaSri),
      fechaAutorizacion: fechaSri,
      claveAcceso,
      mensaje: fechaSri ? "Guía de remisión autorizada por el SRI." : (real.mensajes.filter(Boolean).join(" ") || real.error || "El SRI no devolvió fecha de autorización."),
    })
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : "No se pudo enviar la guía de remisión."
    return NextResponse.json({ autorizado: false, mensaje }, { status: 500 })
  }
}
