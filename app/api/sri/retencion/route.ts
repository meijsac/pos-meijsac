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
import { puntoActivoFactura } from "@/lib/sri/punto-emision"

function dinero(valor: unknown) {
  const n = Number(valor)
  return (Number.isFinite(n) ? n : 0).toFixed(2)
}

function obtenerFechaEcuador() {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date())
}

function fechaDia(valor: unknown) {
  const texto = String(valor || "")
  const dia = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (dia) return `${dia[1]}/${dia[2]}/${dia[3]}`
  const iso = texto.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return ""
}

export async function POST(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ autorizado: false, mensaje: sesion.error }, { status: sesion.status })
    const body = await req.json()
    const extra = sesion.empresa.datosRegistro && typeof sesion.empresa.datosRegistro === "object" && !Array.isArray(sesion.empresa.datosRegistro)
      ? sesion.empresa.datosRegistro as Record<string, unknown>
      : {}
    const punto = puntoActivoFactura(extra.secuenciales, extra.ambiente)
    if (!punto.punto.estab || !punto.punto.pto) return NextResponse.json({ autorizado: false, mensaje: punto.aviso || "Configura el punto de emisión." }, { status: 400 })

    const proveedor = body?.proveedor || {}
    const sustento = body?.sustento || {}
    const renta = body?.retencionRenta || {}
    const iva = body?.retencionIva || {}
    const identificacion = String(proveedor.ruc || "").replace(/\D/g, "")
    const tipoId = identificacion.length === 13 ? "04" : identificacion.length === 10 ? "05" : ""
    const fechaDoc = fechaDia(sustento.fechaEmision)
    const periodo = fechaDoc ? fechaDoc.slice(3) : ""
    const numDoc = String(sustento.numeroFacturaSinGuiones || "").replace(/\D/g, "").slice(-15)
    const claveSustento = String(sustento.claveAcceso || "").replace(/\D/g, "")
    const base15 = Number(sustento.baseImponible)
    const base0 = Number(sustento.baseCero || 0)
    const baseNo = Number(sustento.baseNoObjeto || 0)
    const baseEx = Number(sustento.baseExento || 0)
    const valorIva = Number(sustento.valorIva)
    const totalFactura = Number(sustento.totalFactura)
    const porcRenta = Number(renta.porcentaje)
    const porcIva = Number(iva.porcentaje)
    if (!tipoId || !String(proveedor.razonSocial || "").trim()) return NextResponse.json({ autorizado: false, mensaje: "El proveedor necesita RUC o cédula y razón social." }, { status: 400 })
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(fechaDoc)) return NextResponse.json({ autorizado: false, mensaje: "La fecha del sustento debe ser día/mes/año, sin hora." }, { status: 400 })
    if (!/^\d{2}\/\d{4}$/.test(periodo)) return NextResponse.json({ autorizado: false, mensaje: "El periodo fiscal debe ser mes/año, por ejemplo 10/2026." }, { status: 400 })
    if (!/^\d{15}$/.test(numDoc)) return NextResponse.json({ autorizado: false, mensaje: "El número de sustento debe tener 15 dígitos, sin guiones." }, { status: 400 })
    if (claveSustento.length !== 49) return NextResponse.json({ autorizado: false, mensaje: "La clave de la factura sustento debe tener 49 dígitos." }, { status: 400 })
    if (![base15, base0, baseNo, baseEx, valorIva, totalFactura, porcRenta, porcIva].every((n) => Number.isFinite(n) && n >= 0)) {
      return NextResponse.json({ autorizado: false, mensaje: "Las bases y los porcentajes no pueden ser negativos." }, { status: 400 })
    }
    const valorRenta = Number(((base15 * porcRenta) / 100).toFixed(2))
    const valorIvaRet = Number(((valorIva * porcIva) / 100).toFixed(2))
    const impuestos = [
      base15 > 0 || valorIva > 0 ? { cod: "4", tarifa: "15.00", base: base15, valor: valorIva } : null,
      base0 > 0 ? { cod: "0", tarifa: "0.00", base: base0, valor: 0 } : null,
      baseNo > 0 ? { cod: "6", tarifa: "0.00", base: baseNo, valor: 0 } : null,
      baseEx > 0 ? { cod: "7", tarifa: "0.00", base: baseEx, valor: 0 } : null,
    ].filter(Boolean) as Array<{ cod: string; tarifa: string; base: number; valor: number }>
    if (!impuestos.length) impuestos.push({ cod: "0", tarifa: "0.00", base: 0, valor: 0 })
    const totalSinImpuestos = impuestos.reduce((suma, item) => suma + item.base, 0)

    const filas = await prisma.facturaEmitida.findMany({ where: { empresaId: sesion.empresa.id }, orderBy: { createdAt: "desc" }, take: 500 })
    const { estab, pto } = punto.punto
    const usados = new Set<string>()
    const mapa = extra.secuenciales07 && typeof extra.secuenciales07 === "object" ? extra.secuenciales07 as Record<string, string> : {}
    const guardado = String(mapa[`${estab}-${pto}`] || "").replace(/\D/g, "")
    if (guardado) usados.add(guardado.padStart(9, "0").slice(-9))
    for (const fila of filas) {
      const nota = (fila.payload || {}) as Record<string, any>
      if (String(nota.tipoComprobante || nota.codDoc || "") !== "07") continue
      if (`${nota.establecimiento}` !== `${estab}-${pto}`) continue
      const n = String(nota.secuencial || "").replace(/\D/g, "").padStart(9, "0").slice(-9)
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
      tipoComprobante: "07",
      ruc,
      ambiente,
      establecimiento: estab,
      puntoEmision: pto,
      secuencial,
    })
    const direccion = String(extra.dirMatriz || sesion.empresa.direccion || "")
    const sucursal = String(extra.dirEstablecimiento || direccion)
    const obligado = String(extra.obligadoConta || extra.obligado || "NO").toUpperCase() === "SI" ? "SI" : "NO"
    const comercial = String(sesion.empresa.nombreComercial || sesion.empresa.nombre || "").trim()
    const regimen = String(extra.regimen || "")
    const rimpe = regimen.toUpperCase().includes("RIMPE") ? regimen : ""
    const codDoc = String(sustento.codDocSustento || "01").replace(/\D/g, "").padStart(2, "0").slice(-2)
    const codSustento = String(sustento.codSustento || "01").replace(/\D/g, "").padStart(2, "0").slice(-2)
    const xmlSinFirmar = `<?xml version="1.0" encoding="UTF-8"?>
<comprobanteRetencion id="comprobante" version="2.0.0">
  <infoTributaria>
    <ambiente>${ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${xml(sesion.empresa.razonSocial)}</razonSocial>
    ${comercial ? `<nombreComercial>${xml(comercial)}</nombreComercial>` : ""}
    <ruc>${ruc}</ruc>
    <claveAcceso>${claveAcceso}</claveAcceso>
    <codDoc>07</codDoc>
    <estab>${estab}</estab>
    <ptoEmi>${pto}</ptoEmi>
    <secuencial>${secuencial}</secuencial>
    <dirMatriz>${xml(direccion)}</dirMatriz>
    ${rimpe ? `<contribuyenteRimpe>${xml(rimpe)}</contribuyenteRimpe>` : ""}
  </infoTributaria>
  <infoCompRetencion>
    <fechaEmision>${fechaHoy}</fechaEmision>
    <dirEstablecimiento>${xml(sucursal)}</dirEstablecimiento>
    <obligadoContabilidad>${obligado}</obligadoContabilidad>
    <tipoIdentificacionSujetoRetenido>${tipoId}</tipoIdentificacionSujetoRetenido>
    <parteRel>NO</parteRel>
    <razonSocialSujetoRetenido>${xml(proveedor.razonSocial)}</razonSocialSujetoRetenido>
    <identificacionSujetoRetenido>${identificacion}</identificacionSujetoRetenido>
    <periodoFiscal>${periodo}</periodoFiscal>
  </infoCompRetencion>
  <docsSustento>
    <docSustento>
      <codSustento>${codSustento}</codSustento>
      <codDocSustento>${codDoc}</codDocSustento>
      <numDocSustento>${numDoc}</numDocSustento>
      <fechaEmisionDocSustento>${fechaDoc}</fechaEmisionDocSustento>
      <numAutDocSustento>${claveSustento}</numAutDocSustento>
      <pagoLocExt>01</pagoLocExt>
      <totalSinImpuestos>${dinero(totalSinImpuestos)}</totalSinImpuestos>
      <importeTotal>${dinero(totalFactura)}</importeTotal>
      <impuestosDocSustento>
        ${impuestos.map((item) => `<impuestoDocSustento><codImpuestoDocSustento>2</codImpuestoDocSustento><codigoPorcentaje>${item.cod}</codigoPorcentaje><baseImponible>${dinero(item.base)}</baseImponible><tarifa>${item.tarifa}</tarifa><valorImpuesto>${dinero(item.valor)}</valorImpuesto></impuestoDocSustento>`).join("")}
      </impuestosDocSustento>
      <retenciones>
        <retencion><codigo>1</codigo><codigoRetencion>${xml(renta.codigo)}</codigoRetencion><baseImponible>${dinero(base15)}</baseImponible><porcentajeRetener>${dinero(porcRenta)}</porcentajeRetener><valorRetenido>${dinero(valorRenta)}</valorRetenido></retencion>
        ${valorIva > 0 ? `<retencion><codigo>2</codigo><codigoRetencion>${xml(iva.codigo)}</codigoRetencion><baseImponible>${dinero(valorIva)}</baseImponible><porcentajeRetener>${dinero(porcIva)}</porcentajeRetener><valorRetenido>${dinero(valorIvaRet)}</valorRetenido></retencion>` : ""}
      </retenciones>
      <pagos><pago><formaPago>01</formaPago><total>${dinero(totalFactura)}</total></pago></pagos>
    </docSustento>
  </docsSustento>
</comprobanteRetencion>`
    const esquema = validarEsquemaSri(xmlSinFirmar)
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
      tipoComprobante: "07",
      codDoc: "07",
      claveAcceso,
      establecimiento: `${estab}-${pto}`,
      secuencial,
      numDocSustento: numDoc,
      fechaEmisionDocSustento: fechaDoc,
      periodoFiscal: periodo,
      fechaEmisionFormato: fechaHoy,
      cliente: { razon: proveedor.razonSocial, identificacion, tipoDoc: tipoId },
      configEmisor: { razon: sesion.empresa.razonSocial, comercial, ruc, matriz: direccion, sucursal, obligado, regimen, ambiente: ambiente === "2" ? "PRODUCCIÓN" : "PRUEBAS" },
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
      await prisma.empresa.update({
        where: { id: sesion.empresa.id },
        data: { datosRegistro: { ...extra, secuenciales07: { ...mapa, [`${estab}-${pto}`]: secuencial } } },
      })
    }
    prisma.seguridadLog.create({ data: { empresaId: sesion.empresa.id, usuario: sesion.usuario.nombre, ip: ipDe(req), accion: fechaSri ? "RETENCION_AUTORIZADA" : "RETENCION_PENDIENTE", detalle: claveAcceso } }).catch(() => {})
    return NextResponse.json({
      autorizado: Boolean(fechaSri),
      fechaAutorizacion: fechaSri,
      claveAcceso,
      numero: `${estab}-${pto}-${secuencial}`,
      mensaje: `${fechaSri ? "Retención autorizada por el SRI." : (real.mensajes.filter(Boolean).join(" ") || real.error || "El SRI no devolvió fecha de autorización.")}${respaldo.respaldoOk ? "" : ` ${respaldo.respaldoError}`}`,
      respaldoOk: respaldo.respaldoOk,
    })
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : "No se pudo enviar la retención."
    return NextResponse.json({ autorizado: false, mensaje }, { status: 500 })
  }
}
