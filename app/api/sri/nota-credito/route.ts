import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { claveAcceso49 } from "@/lib/sri/clave"
import { ambienteDeEmpresa, SRI_AMBIENTES } from "@/lib/sri/ambiente"
import { enviarAlSri } from "@/lib/sri/cliente-sri"
import { firmarXmlEmpresa } from "@/lib/sri/firmar"
import { sanitizarTextoXml as xml } from "@/lib/sri/sanitizar"
import { ipDe } from "@/lib/seguridad"
import { validarEsquemaSri } from "@/lib/sri/validar-xsd"
import { guardarRespaldo } from "@/lib/sri/respaldo"

function obtenerFechaEcuador() {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date())
}

function fechaGuardada(valor: unknown) {
  const texto = String(valor || "").trim()
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) return texto
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  const fecha = new Date(texto)
  if (Number.isNaN(fecha.getTime())) return texto
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fecha)
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

function aplicaIva(item: Record<string, unknown>) {
  const cod = String(item.codigoPorcentaje ?? "")
  const tarifa = Number(item.tarifa ?? item.iva ?? 0)
  return cod === "4" || tarifa === 15
}

export async function GET(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ mensaje: sesion.error }, { status: sesion.status })
    const numero = normalizarNumero(new URL(req.url).searchParams.get("numero"))
    if (!numero) return NextResponse.json({ mensaje: "Escribe el número completo, por ejemplo 001-002-000000147." }, { status: 400 })
    const filas = await prisma.facturaEmitida.findMany({
      where: { empresaId: sesion.empresa.id },
      orderBy: { createdAt: "desc" },
      take: 500,
    })
    const factura = filas.find((fila) => {
      const p = (fila.payload || {}) as Record<string, any>
      if (String(p.tipoComprobante || p.codDoc || "01") === "04") return false
      if (!String(p.fechaAutorizacion || "").trim()) return false
      if (String(fila.estado || p.estadoSRI || "").toUpperCase() !== "AUTORIZADO") return false
      return numeroFactura(p.establecimiento, p.secuencial) === numero || normalizarNumero(p.secuencial) === numero
    })
    if (!factura) return NextResponse.json({ mensaje: "No hay una factura autorizada con ese número." }, { status: 404 })
    const p = (factura.payload || {}) as Record<string, any>
    const devuelto = new Map<string, number>()
    for (const fila of filas) {
      const nota = (fila.payload || {}) as Record<string, any>
      if (String(nota.tipoComprobante || nota.codDoc || "") !== "04") continue
      if (!String(nota.fechaAutorizacion || "").trim()) continue
      if (normalizarNumero(nota.numDocModificado) !== numero) continue
      const lineas = Array.isArray(nota.productos) ? nota.productos : []
      for (const linea of lineas) {
        const codigo = String(linea?.codigo || "")
        devuelto.set(codigo, (devuelto.get(codigo) || 0) + Number(linea?.cantidadDevolver || 0))
      }
    }
    const productos = (Array.isArray(p.items) ? p.items : []).map((item: Record<string, unknown>) => {
      const codigo = String(item.codigo || item.codigoPrincipal || "")
      const original = Number(item.cant ?? item.cantidad ?? 0)
      const disponible = Math.max(0, original - (devuelto.get(codigo) || 0))
      return {
        codigo,
        descripcion: String(item.descripcion || ""),
        cantidadOriginal: disponible,
        cantidadDevolver: 0,
        precioUnitario: Number(item.pUnit ?? item.precioUnitario ?? 0),
        aplicaIva: aplicaIva(item),
      }
    }).filter((item) => item.codigo && item.cantidadOriginal > 0)
    const extra = sesion.empresa.datosRegistro && typeof sesion.empresa.datosRegistro === "object" && !Array.isArray(sesion.empresa.datosRegistro)
      ? sesion.empresa.datosRegistro as Record<string, unknown>
      : {}
    const id = String(p.cliente?.identificacion || "").replace(/\D/g, "")
    return NextResponse.json({
      numero,
      cliente: String(p.cliente?.razon || ""),
      identificacion: id,
      tipoId: id.length === 13 ? "04" : id.length === 10 ? "05" : "07",
      fecha: fechaGuardada(p.fechaEmisionFormato || p.fechaEmision),
      productos,
      emisor: {
        razon: sesion.empresa.razonSocial,
        ruc: sesion.empresa.ruc,
        matriz: String(extra.dirMatriz || sesion.empresa.direccion || ""),
        ambiente: String(extra.ambiente || ""),
      },
    })
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : "No se pudo leer la factura."
    return NextResponse.json({ mensaje }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ autorizado: false, mensaje: sesion.error }, { status: sesion.status })
    const body = await req.json()
    const numero = normalizarNumero(body?.numDocModificado)
    const productos = Array.isArray(body?.productos) ? body.productos : []
    const motivo = String(body?.motivo || "").trim()
    const subtotal0 = Number(body?.subtotal0)
    const subtotal15 = Number(body?.subtotal15)
    const iva15 = Number(body?.iva15)
    const total = Number(body?.total)
    if (!numero) return NextResponse.json({ autorizado: false, mensaje: "La factura modificada debe tener el formato 001-002-000000147." }, { status: 400 })
    if (motivo.length < 5) return NextResponse.json({ autorizado: false, mensaje: "El motivo es obligatorio." }, { status: 400 })
    if (!productos.length || productos.some((p: { cantidadDevolver?: number; precioUnitario?: number }) => Number(p.cantidadDevolver) <= 0 || Number(p.precioUnitario) < 0)) {
      return NextResponse.json({ autorizado: false, mensaje: "Selecciona al menos un producto con cantidad válida." }, { status: 400 })
    }
    if (![subtotal0, subtotal15, iva15, total].every((n) => Number.isFinite(n) && n >= 0)) {
      return NextResponse.json({ autorizado: false, mensaje: "Los montos no pueden ser negativos." }, { status: 400 })
    }
    const filas = await prisma.facturaEmitida.findMany({ where: { empresaId: sesion.empresa.id }, orderBy: { createdAt: "desc" }, take: 500 })
    const factura = filas.find((fila) => {
      const p = (fila.payload || {}) as Record<string, any>
      if (String(p.tipoComprobante || "01") === "04" || !String(p.fechaAutorizacion || "").trim()) return false
      return numeroFactura(p.establecimiento, p.secuencial) === numero
    })
    if (!factura) return NextResponse.json({ autorizado: false, mensaje: "Esa factura no está autorizada." }, { status: 404 })
    const origen = (factura.payload || {}) as Record<string, any>
    const [estab, pto] = numero.split("-")
    const usados = new Set<string>()
    const extra = sesion.empresa.datosRegistro && typeof sesion.empresa.datosRegistro === "object" && !Array.isArray(sesion.empresa.datosRegistro)
      ? sesion.empresa.datosRegistro as Record<string, unknown>
      : {}
    const mapa = extra.secuenciales04 && typeof extra.secuenciales04 === "object" ? extra.secuenciales04 as Record<string, string> : {}
    const guardado = String(mapa[`${estab}-${pto}`] || "").replace(/\D/g, "")
    if (guardado) usados.add(guardado.padStart(9, "0").slice(-9))
    for (const fila of filas) {
      const nota = (fila.payload || {}) as Record<string, any>
      if (String(nota.tipoComprobante || nota.codDoc || "") !== "04") continue
      if (`${nota.establecimiento}` !== `${estab}-${pto}`) continue
      const n = String(nota.secuencial || "").replace(/\D/g, "").padStart(9, "0").slice(-9)
      if (n && n !== "000000000") usados.add(n)
    }
    let mayor = 0
    for (const n of usados) mayor = Math.max(mayor, Number(n))
    const secuencial = String(mayor + 1).padStart(9, "0")
    const ambiente = ambienteDeEmpresa(sesion.empresa)
    const ruc = String(sesion.empresa.ruc || "").replace(/\D/g, "")
    const fechaHoyEcuador = obtenerFechaEcuador()
    const claveAcceso = claveAcceso49({
      fecha: fechaHoyEcuador.replace(/\D/g, ""),
      tipoComprobante: "04",
      ruc,
      ambiente,
      establecimiento: estab,
      puntoEmision: pto,
      secuencial,
    })
    const totalSinImpuestos = subtotal0 + subtotal15
    let totalConImpuestosXml = "<totalConImpuestos>"
    if (subtotal0 > 0) {
      totalConImpuestosXml += `<totalImpuesto><codigo>2</codigo><codigoPorcentaje>0</codigoPorcentaje><baseImponible>${subtotal0.toFixed(2)}</baseImponible><valor>0.00</valor></totalImpuesto>`
    }
    if (subtotal15 > 0) {
      totalConImpuestosXml += `<totalImpuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje><baseImponible>${subtotal15.toFixed(2)}</baseImponible><valor>${iva15.toFixed(2)}</valor></totalImpuesto>`
    }
    totalConImpuestosXml += "</totalConImpuestos>"
    const direccion = String(extra.dirMatriz || sesion.empresa.direccion || "")
    const sucursal = String(extra.dirEstablecimiento || direccion)
    const obligado = String(extra.obligadoConta || extra.obligado || "NO").toUpperCase() === "SI" ? "SI" : "NO"
    const idCliente = String(body.clienteIdentificacion || origen.cliente?.identificacion || "").replace(/\D/g, "")
    const tipoId = idCliente.length === 13 ? "04" : idCliente.length === 10 ? "05" : "07"
    const xmlSinFirmar = `<?xml version="1.0" encoding="UTF-8"?>
<notaCredito id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${xml(sesion.empresa.razonSocial)}</razonSocial>
    <ruc>${ruc}</ruc>
    <claveAcceso>${claveAcceso}</claveAcceso>
    <codDoc>04</codDoc>
    <estab>${estab}</estab>
    <ptoEmi>${pto}</ptoEmi>
    <secuencial>${secuencial}</secuencial>
    <dirMatriz>${xml(direccion)}</dirMatriz>
  </infoTributaria>
  <infoNotaCredito>
    <fechaEmision>${fechaHoyEcuador}</fechaEmision>
    <dirEstablecimiento>${xml(sucursal)}</dirEstablecimiento>
    <tipoIdentificacionComprador>${tipoId}</tipoIdentificacionComprador>
    <razonSocialComprador>${xml(body.clienteNombre || origen.cliente?.razon)}</razonSocialComprador>
    <identificacionComprador>${xml(idCliente)}</identificacionComprador>
    <obligadoContabilidad>${obligado}</obligadoContabilidad>
    <codDocModificado>01</codDocModificado>
    <numDocModificado>${numero}</numDocModificado>
    <fechaEmisionDocSustento>${xml(fechaGuardada(body.fechaEmisionDocSustento || origen.fechaEmisionFormato))}</fechaEmisionDocSustento>
    <totalSinImpuestos>${totalSinImpuestos.toFixed(2)}</totalSinImpuestos>
    <valorModificacion>${total.toFixed(2)}</valorModificacion>
    <moneda>DOLAR</moneda>
    ${totalConImpuestosXml}
    <motivo>${xml(motivo)}</motivo>
  </infoNotaCredito>
  <detalles>
    ${productos.map((prod: { codigo?: string; descripcion?: string; cantidadDevolver?: number; precioUnitario?: number; aplicaIva?: boolean }) => {
      const cantidad = Number(prod.cantidadDevolver)
      const precio = Number(prod.precioUnitario)
      const base = cantidad * precio
      const valorIva = prod.aplicaIva ? base * 0.15 : 0
      return `<detalle><codigoInterno>${xml(prod.codigo)}</codigoInterno><descripcion>${xml(prod.descripcion)}</descripcion><cantidad>${cantidad.toFixed(2)}</cantidad><precioUnitario>${precio.toFixed(2)}</precioUnitario><descuento>0.00</descuento><precioTotalSinImpuesto>${base.toFixed(2)}</precioTotalSinImpuesto><impuestos><impuesto><codigo>2</codigo><codigoPorcentaje>${prod.aplicaIva ? "4" : "0"}</codigoPorcentaje><tarifa>${prod.aplicaIva ? "15.00" : "0.00"}</tarifa><baseImponible>${base.toFixed(2)}</baseImponible><valor>${valorIva.toFixed(2)}</valor></impuesto></impuestos></detalle>`
    }).join("")}
  </detalles>
</notaCredito>`
    const esquema = await validarEsquemaSri(xmlSinFirmar)
    if (esquema) return NextResponse.json({ autorizado: false, mensaje: esquema }, { status: 400 })
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
    const payload = {
      tipoComprobante: "04",
      codDoc: "04",
      claveAcceso,
      establecimiento: `${estab}-${pto}`,
      secuencial,
      numDocModificado: numero,
      fechaEmisionDocSustento: fechaGuardada(body.fechaEmisionDocSustento || origen.fechaEmisionFormato),
      fechaEmisionFormato: fechaHoyEcuador,
      motivo,
      cliente: { razon: body.clienteNombre || origen.cliente?.razon, identificacion: idCliente, tipoDoc: tipoId },
      productos,
      items: productos.map((prod: { codigo?: string; descripcion?: string; cantidadDevolver?: number; precioUnitario?: number }) => ({
        codigo: prod.codigo,
        descripcion: prod.descripcion,
        cant: Number(prod.cantidadDevolver),
        pUnit: Number(prod.precioUnitario),
      })),
      totales: { subtotalSin: totalSinImpuestos, base0: subtotal0, base15: subtotal15, iva15, total, propina: 0, descuento: 0 },
      configEmisor: { razon: sesion.empresa.razonSocial, ruc, matriz: direccion, sucursal, obligado, ambiente: ambiente === "2" ? "PRODUCCIÓN" : "PRUEBAS" },
      xmlContent: firmado,
      fechaAutorizacion: fechaSri,
      estadoSRI: fechaSri ? "AUTORIZADO" : "PENDIENTE",
      sriAutorizacion: real.autorizacion,
    }
    const respaldo = await guardarRespaldo(sesion.empresa.id, claveAcceso, firmado, real, payload)
    await prisma.facturaEmitida.create({
      data: {
        empresaId: sesion.empresa.id,
        estado: fechaSri ? "AUTORIZADO" : "PENDIENTE",
        sriStatus: fechaSri ? "AUTORIZADO" : "PENDIENTE",
        payload: payload as object,
      },
    })
    if (fechaSri) {
      const siguiente = { ...mapa, [`${estab}-${pto}`]: secuencial }
      await prisma.empresa.update({ where: { id: sesion.empresa.id }, data: { datosRegistro: { ...extra, secuenciales04: siguiente } } })
      for (const prod of productos as Array<{ codigo?: string; cantidadDevolver?: number; descripcion?: string }>) {
        const row = await prisma.producto.findFirst({ where: { empresaId: sesion.empresa.id, codigo: String(prod.codigo || "") } })
        if (!row) continue
        const cantidad = Number(prod.cantidadDevolver || 0)
        await prisma.producto.update({ where: { id: row.id }, data: { stock: Number(row.stock) + cantidad } })
        await prisma.movimientoInventario.create({
          data: { tipo: "ENTRADA", cantidad, motivo: `Nota de crédito ${numero}`, productoId: row.id, empresaId: sesion.empresa.id },
        })
      }
    }
    prisma.seguridadLog.create({ data: { empresaId: sesion.empresa.id, usuario: sesion.usuario.nombre, ip: ipDe(req), accion: fechaSri ? "NOTA_CREDITO_AUTORIZADA" : "NOTA_CREDITO_PENDIENTE", detalle: claveAcceso } }).catch(() => {})
    return NextResponse.json({
      autorizado: Boolean(fechaSri),
      fechaAutorizacion: fechaSri,
      claveAcceso,
      mensaje: `${fechaSri ? "Nota de crédito autorizada por el SRI." : (real.mensajes.filter(Boolean).join(" ") || real.error || "El SRI no devolvió fecha de autorización.")}${respaldo.respaldoOk ? "" : ` ${respaldo.respaldoError}`}`,
      respaldoOk: respaldo.respaldoOk,
      respaldoError: respaldo.respaldoError,
    })
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : "No se pudo enviar la nota de crédito."
    return NextResponse.json({ autorizado: false, mensaje }, { status: 500 })
  }
}
