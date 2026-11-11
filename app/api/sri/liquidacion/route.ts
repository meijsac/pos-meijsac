import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { claveAcceso49 } from "@/lib/sri/clave"
import { codigoAmbiente, SRI_AMBIENTES } from "@/lib/sri/ambiente"
import { enviarAlSri } from "@/lib/sri/cliente-sri"
import { firmarFacturaXml } from "@/lib/sri/firmar"
import { desencriptar, desencriptarBytes, ipDe } from "@/lib/seguridad"
function xml(valor: unknown) {
  return String(valor ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
function dinero(valor: number) {
  return (Number.isFinite(valor) ? valor : 0).toFixed(2)
}
function obtenerFechaEcuador() {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date())
}
function extraDe(datos: unknown) {
  return datos && typeof datos === "object" && !Array.isArray(datos) ? datos as Record<string, unknown> : {}
}
function puntoDocumento(secuenciales: unknown, codigoDoc: string) {
  const lista = Array.isArray(secuenciales) ? secuenciales : []
  const candidatos = lista.map((fila: any, indice: number) => ({ fila, indice })).filter(({ fila }) => {
    const codigo = String(fila?.codigo || "").replace(/\D/g, "").padStart(2, "0").slice(-2)
    const estado = String(fila?.estado || "ACTIVO").toUpperCase()
    return codigo === codigoDoc && !estado.includes("INACTIV") && !estado.includes("BAJA") && estado !== "OFF"
  })
  const elegida = candidatos.find(({ fila }) => String(fila?.estado || "").toUpperCase() === "ACTIVO") || candidatos[0]
  if (!elegida) return null
  const estab = String(elegida.fila?.estab || "").replace(/\D/g, "").padStart(3, "0").slice(-3)
  const pto = String(elegida.fila?.pto || "").replace(/\D/g, "").padStart(3, "0").slice(-3)
  const ultimo = String(elegida.fila?.ultimo || "").replace(/\D/g, "").padStart(9, "0").slice(-9)
  if (!estab || estab === "000" || !pto || pto === "000") return null
  return { estab, pto, ultimo, indice: elegida.indice }
}

function siguiente(filas: Array<{ payload: unknown }>, tipo: string, serie: string, mapa: Record<string, string>) {
  const usados = new Set<string>()
  const guardado = String(mapa[serie] || "").replace(/\D/g, "")
  if (guardado) usados.add(guardado.padStart(9, "0").slice(-9))
  for (const fila of filas) {
    const nota = (fila.payload || {}) as Record<string, any>
    if (String(nota.tipoComprobante || nota.codDoc || "") !== tipo) continue
    if (`${nota.establecimiento}` !== serie) continue
    const n = String(nota.secuencial || "").replace(/\D/g, "").padStart(9, "0").slice(-9)
    if (n && n !== "000000000") usados.add(n)
  }
  let mayor = 0
  for (const n of usados) mayor = Math.max(mayor, Number(n))
  return String(mayor + 1).padStart(9, "0")
}

export async function POST(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ autorizado: false, mensaje: sesion.error }, { status: sesion.status })
    const body = await req.json()
    const proveedor = body?.proveedor || {}
    const tipoId = String(proveedor.tipoIdentificacion || "")
    const identificacion = String(proveedor.identificacion || "").trim()
    const digitos = identificacion.replace(/\D/g, "")
    const nombre = String(proveedor.razonSocial || "").trim()
    const direccionProveedor = String(proveedor.direccion || "").trim()
    const formaPago = body?.formaPago === "20" ? "20" : body?.formaPago === "01" ? "01" : ""
    const tipoCompra = body?.tipoCompra === "SERVICIOS" ? "SERVICIOS" : "BIENES"
    const items = (Array.isArray(body?.items) ? body.items : []).filter((item: { descripcion?: string; cantidad?: number; precioUnitario?: number }) => String(item.descripcion || "").trim() && Number(item.cantidad) > 0 && Number(item.precioUnitario) >= 0)
    if (!["05", "06", "08"].includes(tipoId)) return NextResponse.json({ autorizado: false, mensaje: "La liquidación solo admite cédula, pasaporte o identificación del exterior." }, { status: 400 })
    if (digitos.length === 13) return NextResponse.json({ autorizado: false, mensaje: "No se puede emitir una liquidación de compra a un RUC." }, { status: 400 })
    if (tipoId === "05" && !/^\d{10}$/.test(digitos)) return NextResponse.json({ autorizado: false, mensaje: "La cédula debe tener 10 dígitos." }, { status: 400 })
    if (tipoId === "06" && identificacion.length < 3) return NextResponse.json({ autorizado: false, mensaje: "Escribe el pasaporte del proveedor." }, { status: 400 })
    if (tipoId === "08" && identificacion.length < 3) return NextResponse.json({ autorizado: false, mensaje: "Escribe la identificación del exterior." }, { status: 400 })
    if (!nombre || !direccionProveedor) return NextResponse.json({ autorizado: false, mensaje: "El nombre y la dirección del proveedor son obligatorios." }, { status: 400 })
    if (!formaPago) return NextResponse.json({ autorizado: false, mensaje: "Elige efectivo o transferencia." }, { status: 400 })
    if (!items.length) return NextResponse.json({ autorizado: false, mensaje: "Agrega al menos un ítem con cantidad y precio." }, { status: 400 })
    if (items.some((item: { codigoPrincipal?: string }) => !String(item.codigoPrincipal || "").trim())) {
      return NextResponse.json({ autorizado: false, mensaje: "Cada ítem necesita su código." }, { status: 400 })
    }

    const extra = extraDe(sesion.empresa.datosRegistro)
    const punto = puntoDocumento(extra.secuenciales, "03")
    const puntoRetencion = puntoDocumento(extra.secuenciales, "07")
    if (!punto) return NextResponse.json({ autorizado: false, mensaje: "En Configuración falta el punto de emisión de la liquidación, código 03." }, { status: 400 })
    if (!puntoRetencion) return NextResponse.json({ autorizado: false, mensaje: "En Configuración falta el punto de emisión de la retención, código 07." }, { status: 400 })
    const filas = await prisma.facturaEmitida.findMany({ where: { empresaId: sesion.empresa.id }, orderBy: { createdAt: "desc" }, take: 500 })
    const serie = `${punto.estab}-${punto.pto}`
    const mapa03 = extra.secuenciales03 && typeof extra.secuenciales03 === "object" ? extra.secuenciales03 as Record<string, string> : {}
    const base03 = String(Math.max(Number(punto.ultimo || 0), Number(String(mapa03[serie] || "").replace(/\D/g, "") || 0))).padStart(9, "0")
    const secuencial = siguiente(filas, "03", serie, { ...mapa03, [serie]: base03 })
    const ambiente = codigoAmbiente(extra.ambiente)
    const ruc = String(sesion.empresa.ruc || "").replace(/\D/g, "")
    const fechaHoy = obtenerFechaEcuador()
    const claveLiquidacion = claveAcceso49({ fecha: fechaHoy.replace(/\D/g, ""), tipoComprobante: "03", ruc, ambiente, establecimiento: punto.estab, puntoEmision: punto.pto, secuencial })
    const lineas = items.map((item: { codigoPrincipal?: string; descripcion?: string; cantidad?: number; precioUnitario?: number; aplicaIva?: boolean }) => {
      const cantidad = Number(item.cantidad)
      const precio = Number(item.precioUnitario)
      const base = cantidad * precio
      const aplica = Boolean(item.aplicaIva)
      return { codigo: String(item.codigoPrincipal || "").trim(), descripcion: String(item.descripcion), cantidad, precio, base, aplica, iva: aplica ? base * 0.15 : 0 }
    })
    const subtotal15 = lineas.filter((l: { aplica: boolean }) => l.aplica).reduce((s: number, l: { base: number }) => s + l.base, 0)
    const subtotal0 = lineas.filter((l: { aplica: boolean }) => !l.aplica).reduce((s: number, l: { base: number }) => s + l.base, 0)
    const iva15 = subtotal15 * 0.15
    const total = subtotal15 + subtotal0 + iva15
    const direccion = String(extra.dirMatriz || sesion.empresa.direccion || "")
    const sucursal = String(extra.dirEstablecimiento || direccion)
    const obligado = String(extra.obligadoConta || extra.obligado || "NO").toUpperCase() === "SI" ? "SI" : "NO"
    const impuestos = [
      subtotal15 > 0 ? `<totalImpuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje><baseImponible>${dinero(subtotal15)}</baseImponible><valor>${dinero(iva15)}</valor></totalImpuesto>` : "",
      subtotal0 > 0 ? `<totalImpuesto><codigo>2</codigo><codigoPorcentaje>0</codigoPorcentaje><baseImponible>${dinero(subtotal0)}</baseImponible><valor>0.00</valor></totalImpuesto>` : "",
    ].filter(Boolean).join("") || `<totalImpuesto><codigo>2</codigo><codigoPorcentaje>0</codigoPorcentaje><baseImponible>0.00</baseImponible><valor>0.00</valor></totalImpuesto>`
    const xmlLiquidacion = `<?xml version="1.0" encoding="UTF-8"?>
<liquidacionCompra id="comprobante" version="1.1.0">
  <infoTributaria><ambiente>${ambiente}</ambiente><tipoEmision>1</tipoEmision><razonSocial>${xml(sesion.empresa.razonSocial)}</razonSocial><ruc>${ruc}</ruc><claveAcceso>${claveLiquidacion}</claveAcceso><codDoc>03</codDoc><estab>${punto.estab}</estab><ptoEmi>${punto.pto}</ptoEmi><secuencial>${secuencial}</secuencial><dirMatriz>${xml(direccion)}</dirMatriz></infoTributaria>
  <infoLiquidacionCompra><fechaEmision>${fechaHoy}</fechaEmision><dirEstablecimiento>${xml(sucursal)}</dirEstablecimiento><obligadoContabilidad>${obligado}</obligadoContabilidad><tipoIdentificacionProveedor>${tipoId}</tipoIdentificacionProveedor><razonSocialProveedor>${xml(nombre)}</razonSocialProveedor><identificacionProveedor>${xml(tipoId === "05" ? digitos : identificacion)}</identificacionProveedor><direccionProveedor>${xml(direccionProveedor)}</direccionProveedor><totalSinImpuestos>${dinero(subtotal15 + subtotal0)}</totalSinImpuestos><totalDescuento>0.00</totalDescuento><totalConImpuestos>${impuestos}</totalConImpuestos><importeTotal>${dinero(total)}</importeTotal><moneda>DOLAR</moneda><pagos><pago><formaPago>${formaPago}</formaPago><total>${dinero(total)}</total></pago></pagos></infoLiquidacionCompra>
  <detalles>${lineas.map((l: { codigo: string; descripcion: string; cantidad: number; precio: number; base: number; aplica: boolean; iva: number }) => `<detalle><codigoPrincipal>${xml(l.codigo)}</codigoPrincipal><descripcion>${xml(l.descripcion)}</descripcion><cantidad>${dinero(l.cantidad)}</cantidad><precioUnitario>${dinero(l.precio)}</precioUnitario><descuento>0.00</descuento><precioTotalSinImpuesto>${dinero(l.base)}</precioTotalSinImpuesto><impuestos><impuesto><codigo>2</codigo><codigoPorcentaje>${l.aplica ? "4" : "0"}</codigoPorcentaje><tarifa>${l.aplica ? "15.00" : "0.00"}</tarifa><baseImponible>${dinero(l.base)}</baseImponible><valor>${dinero(l.iva)}</valor></impuesto></impuestos></detalle>`).join("")}</detalles>
</liquidacionCompra>`
    const firma = await prisma.firmaElectronica.findUnique({ where: { empresaId: sesion.empresa.id } })
    if (!firma?.p12Cifrado || !firma.claveCifrada) return NextResponse.json({ autorizado: false, mensaje: "Falta la firma electrónica en Configuración." }, { status: 400 })
    const p12 = desencriptarBytes(firma.p12Cifrado)
    const claveP12 = desencriptar(firma.claveCifrada)
    const firmado = firmarFacturaXml(xmlLiquidacion, p12, claveP12)
    const urls = SRI_AMBIENTES[ambiente]
    const real = await enviarAlSri({ xmlFirmado: firmado, claveAcceso: claveLiquidacion, ambiente, recepcionUrl: urls.recepcion, autorizacionUrl: urls.autorizacion })
    const fechaSri = String(real.fechaAutorizacion || "").trim()
    const payloadBase = {
      tipoComprobante: "03", codDoc: "03", claveAcceso: claveLiquidacion, establecimiento: serie, secuencial,
      fechaEmisionFormato: fechaHoy, formaPago, cliente: { razon: nombre, identificacion: tipoId === "05" ? digitos : identificacion, tipoDoc: tipoId, direccion: direccionProveedor },
      items: lineas.map((l: { codigo: string; descripcion: string; cantidad: number; precio: number; base: number }) => ({ codigo: l.codigo, descripcion: l.descripcion, cant: l.cantidad, pUnit: l.precio, total: l.base })),
      totales: { subtotalSin: subtotal15 + subtotal0, base15: subtotal15, base0: subtotal0, iva15, total, propina: 0, descuento: 0 },
      configEmisor: { razon: sesion.empresa.razonSocial, comercial: sesion.empresa.nombreComercial || "", ruc, matriz: direccion, sucursal, obligado, regimen: String(extra.regimen || ""), ambiente: ambiente === "2" ? "PRODUCCIÓN" : "PRUEBAS" },
      xmlContent: firmado, fechaAutorizacion: fechaSri, estadoSRI: fechaSri ? "AUTORIZADO" : "PENDIENTE", sriAutorizacion: real.autorizacion,
    }
    await prisma.facturaEmitida.create({ data: { empresaId: sesion.empresa.id, estado: fechaSri ? "AUTORIZADO" : "PENDIENTE", sriStatus: fechaSri ? "AUTORIZADO" : "PENDIENTE", payload: payloadBase } })
    let mensajeRetencion = ""
    let claveRetencion = ""
    let sec07 = ""
    const serie07 = `${puntoRetencion.estab}-${puntoRetencion.pto}`
    const mapa07 = extra.secuenciales07 && typeof extra.secuenciales07 === "object" ? extra.secuenciales07 as Record<string, string> : {}
    if (fechaSri) {
      const porcentaje = tipoCompra === "BIENES" ? 2 : 2.75
      const codigoRenta = tipoCompra === "BIENES" ? "312" : "3440"
      const base = subtotal15 + subtotal0
      const valorRenta = Number(((base * porcentaje) / 100).toFixed(2))
      const base07 = String(Math.max(Number(puntoRetencion.ultimo || 0), Number(String(mapa07[serie07] || "").replace(/\D/g, "") || 0))).padStart(9, "0")
      sec07 = siguiente(filas, "07", serie07, { ...mapa07, [serie07]: base07 })
      const clave07 = claveAcceso49({ fecha: fechaHoy.replace(/\D/g, ""), tipoComprobante: "07", ruc, ambiente, establecimiento: puntoRetencion.estab, puntoEmision: puntoRetencion.pto, secuencial: sec07 })
      const numDoc = `${punto.estab}${punto.pto}${secuencial}`
      const xmlRetencion = `<?xml version="1.0" encoding="UTF-8"?><comprobanteRetencion id="comprobante" version="2.0.0"><infoTributaria><ambiente>${ambiente}</ambiente><tipoEmision>1</tipoEmision><razonSocial>${xml(sesion.empresa.razonSocial)}</razonSocial><ruc>${ruc}</ruc><claveAcceso>${clave07}</claveAcceso><codDoc>07</codDoc><estab>${puntoRetencion.estab}</estab><ptoEmi>${puntoRetencion.pto}</ptoEmi><secuencial>${sec07}</secuencial><dirMatriz>${xml(direccion)}</dirMatriz></infoTributaria><infoCompRetencion><fechaEmision>${fechaHoy}</fechaEmision><dirEstablecimiento>${xml(sucursal)}</dirEstablecimiento><obligadoContabilidad>${obligado}</obligadoContabilidad><tipoIdentificacionSujetoRetenido>${tipoId}</tipoIdentificacionSujetoRetenido><parteRel>NO</parteRel><razonSocialSujetoRetenido>${xml(nombre)}</razonSocialSujetoRetenido><identificacionSujetoRetenido>${xml(tipoId === "05" ? digitos : identificacion)}</identificacionSujetoRetenido><periodoFiscal>${fechaHoy.slice(3)}</periodoFiscal></infoCompRetencion><docsSustento><docSustento><codSustento>01</codSustento><codDocSustento>03</codDocSustento><numDocSustento>${numDoc}</numDocSustento><fechaEmisionDocSustento>${fechaHoy}</fechaEmisionDocSustento><numAutDocSustento>${claveLiquidacion}</numAutDocSustento><pagoLocExt>01</pagoLocExt><totalSinImpuestos>${dinero(base)}</totalSinImpuestos><importeTotal>${dinero(total)}</importeTotal><impuestosDocSustento>${subtotal15 > 0 ? `<impuestoDocSustento><codImpuestoDocSustento>2</codImpuestoDocSustento><codigoPorcentaje>4</codigoPorcentaje><baseImponible>${dinero(subtotal15)}</baseImponible><tarifa>15.00</tarifa><valorImpuesto>${dinero(iva15)}</valorImpuesto></impuestoDocSustento>` : ""}${subtotal0 > 0 ? `<impuestoDocSustento><codImpuestoDocSustento>2</codImpuestoDocSustento><codigoPorcentaje>0</codigoPorcentaje><baseImponible>${dinero(subtotal0)}</baseImponible><tarifa>0.00</tarifa><valorImpuesto>0.00</valorImpuesto></impuestoDocSustento>` : ""}</impuestosDocSustento><retenciones><retencion><codigo>1</codigo><codigoRetencion>${codigoRenta}</codigoRetencion><baseImponible>${dinero(base)}</baseImponible><porcentajeRetener>${dinero(porcentaje)}</porcentajeRetener><valorRetenido>${dinero(valorRenta)}</valorRetenido></retencion>${iva15 > 0 ? `<retencion><codigo>2</codigo><codigoRetencion>3</codigoRetencion><baseImponible>${dinero(iva15)}</baseImponible><porcentajeRetener>100.00</porcentajeRetener><valorRetenido>${dinero(iva15)}</valorRetenido></retencion>` : ""}</retenciones><pagos><pago><formaPago>${formaPago}</formaPago><total>${dinero(total)}</total></pago></pagos></docSustento></docsSustento></comprobanteRetencion>`
      const firmado07 = firmarFacturaXml(xmlRetencion, p12, claveP12)
      const real07 = await enviarAlSri({ xmlFirmado: firmado07, claveAcceso: clave07, ambiente, recepcionUrl: urls.recepcion, autorizacionUrl: urls.autorizacion })
      const fecha07 = String(real07.fechaAutorizacion || "").trim()
      claveRetencion = clave07
      await prisma.facturaEmitida.create({
        data: {
          empresaId: sesion.empresa.id,
          estado: fecha07 ? "AUTORIZADO" : "PENDIENTE",
          sriStatus: fecha07 ? "AUTORIZADO" : "PENDIENTE",
          payload: { tipoComprobante: "07", codDoc: "07", claveAcceso: clave07, establecimiento: serie07, secuencial: sec07, numDocSustento: numDoc, fechaEmisionDocSustento: fechaHoy, periodoFiscal: fechaHoy.slice(3), fechaEmisionFormato: fechaHoy, cliente: payloadBase.cliente, configEmisor: payloadBase.configEmisor, xmlContent: firmado07, fechaAutorizacion: fecha07, estadoSRI: fecha07 ? "AUTORIZADO" : "PENDIENTE", sriAutorizacion: real07.autorizacion },
        },
      })
      const listaPuntos = Array.isArray(extra.secuenciales) ? extra.secuenciales.map((fila) => ({ ...(fila as object) })) : []
      if (listaPuntos[punto.indice]) (listaPuntos[punto.indice] as { ultimo?: string }).ultimo = secuencial
      if (fecha07 && listaPuntos[puntoRetencion.indice]) (listaPuntos[puntoRetencion.indice] as { ultimo?: string }).ultimo = sec07
      await prisma.empresa.update({
        where: { id: sesion.empresa.id },
        data: {
          datosRegistro: {
            ...extra,
            secuenciales: listaPuntos,
            secuenciales03: { ...mapa03, [serie]: secuencial },
            secuenciales07: fecha07 ? { ...mapa07, [serie07]: sec07 } : mapa07,
          },
        },
      })
      mensajeRetencion = fecha07 ? "" : (real07.mensajes.filter(Boolean).join(" ") || real07.error || "La liquidación se autorizó. La retención quedó pendiente.")
    }
    prisma.seguridadLog.create({ data: { empresaId: sesion.empresa.id, usuario: sesion.usuario.nombre, ip: ipDe(req), accion: fechaSri ? "LIQUIDACION_AUTORIZADA" : "LIQUIDACION_PENDIENTE", detalle: claveLiquidacion } }).catch(() => {})
    return NextResponse.json({
      autorizado: Boolean(fechaSri),
      fechaAutorizacion: fechaSri,
      claveAccesoLiquidacion: claveLiquidacion,
      claveAccesoRetencion: claveRetencion,
      mensaje: fechaSri ? (mensajeRetencion || "Liquidación autorizada por el SRI.") : (real.mensajes.filter(Boolean).join(" ") || real.error || "El SRI no devolvió fecha de autorización."),
      mensajeRetencion,
    })
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : "No se pudo enviar la liquidación."
    return NextResponse.json({ autorizado: false, mensaje }, { status: 500 })
  }
}
