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

export function obtenerFechaEcuador(): string {
  const ahora = new Date()
  const opciones: Intl.DateTimeFormatOptions = {
    timeZone: "America/Guayaquil",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }
  return new Intl.DateTimeFormat("es-EC", opciones).format(ahora)
}

export async function POST(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ autorizado: false, mensaje: sesion.error }, { status: sesion.status })
    const body = await req.json()
    const motivos = Array.isArray(body?.motivos) ? body.motivos : []
    const subtotal = Number(body?.subtotal)
    const iva = Number(body?.iva)
    const total = Number(body?.total)
    if (!String(body?.numDocModificado || "").trim()) return NextResponse.json({ autorizado: false, mensaje: "Falta la factura que se modifica." }, { status: 400 })
    if (!motivos.length || motivos.some((m: { razon?: string; valor?: number }) => !String(m?.razon || "").trim() || Number(m?.valor) < 0)) {
      return NextResponse.json({ autorizado: false, mensaje: "Cada cargo necesita un motivo y un valor de cero o más." }, { status: 400 })
    }
    if (![subtotal, iva, total].every((n) => Number.isFinite(n) && n >= 0)) {
      return NextResponse.json({ autorizado: false, mensaje: "Los montos no pueden ser negativos." }, { status: 400 })
    }
    const extra = sesion.empresa.datosRegistro && typeof sesion.empresa.datosRegistro === "object" && !Array.isArray(sesion.empresa.datosRegistro)
      ? sesion.empresa.datosRegistro as Record<string, unknown>
      : {}
    const ambiente = ambienteDeEmpresa(sesion.empresa)
    const ruc = String(sesion.empresa.ruc || "").replace(/\D/g, "")
    const serie = String(extra.establecimiento || extra.serie || "001-001")
    const [estab, pto] = serie.split("-")
    const secuencial = "000000001"
    const fecha = obtenerFechaEcuador()
    const claveAcceso = claveAcceso49({
      fecha: fecha.replace(/\D/g, ""),
      tipoComprobante: "05",
      ruc,
      ambiente,
      establecimiento: estab || "001",
      puntoEmision: pto || "001",
      secuencial,
    })
    const id = String(body.identificacion || "").replace(/\D/g, "")
    const tipoId = id.length === 13 ? "04" : id.length === 10 ? "05" : "06"
    const xmlSinFirmar = `<?xml version="1.0" encoding="UTF-8"?>
<notaDebito id="comprobante" version="1.0.0">
  <infoTributaria>
    <ambiente>${ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${xml(sesion.empresa.razonSocial)}</razonSocial>
    <ruc>${ruc}</ruc>
    <claveAcceso>${claveAcceso}</claveAcceso>
    <codDoc>05</codDoc>
    <estab>${xml(estab || "001")}</estab>
    <ptoEmi>${xml(pto || "001")}</ptoEmi>
    <secuencial>${secuencial}</secuencial>
    <dirMatriz>${xml(extra.dirMatriz || sesion.empresa.direccion || "")}</dirMatriz>
  </infoTributaria>
  <infoNotaDebito>
    <fechaEmision>${fecha}</fechaEmision>
    <dirEstablecimiento>${xml(extra.dirEstablecimiento || extra.dirMatriz || sesion.empresa.direccion || "")}</dirEstablecimiento>
    <tipoIdentificacionComprador>${tipoId}</tipoIdentificacionComprador>
    <razonSocialComprador>${xml(body.cliente)}</razonSocialComprador>
    <identificacionComprador>${xml(id)}</identificacionComprador>
    <obligadoContabilidad>${String(extra.obligadoConta || extra.obligado || "NO").toUpperCase() === "SI" ? "SI" : "NO"}</obligadoContabilidad>
    <codDocModificado>01</codDocModificado>
    <numDocModificado>${xml(body.numDocModificado)}</numDocModificado>
    <fechaEmisionDocSustento>${xml(body.fechaEmisionDocSustento)}</fechaEmisionDocSustento>
    <totalSinImpuestos>${subtotal.toFixed(2)}</totalSinImpuestos>
    <impuestos>
      <impuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>4</codigoPorcentaje>
        <tarifa>15</tarifa>
        <baseImponible>${subtotal.toFixed(2)}</baseImponible>
        <valor>${iva.toFixed(2)}</valor>
      </impuesto>
    </impuestos>
    <valorTotal>${total.toFixed(2)}</valorTotal>
    <pagos>
      <pago>
        <formaPago>01</formaPago>
        <total>${total.toFixed(2)}</total>
      </pago>
    </pagos>
  </infoNotaDebito>
  <motivos>
    ${motivos.map((m: { razon?: string; valor?: number }) => `<motivo><razon>${xml(m.razon)}</razon><valor>${Number(m.valor).toFixed(2)}</valor></motivo>`).join("")}
  </motivos>
</notaDebito>`
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
    prisma.seguridadLog.create({ data: { empresaId: sesion.empresa.id, usuario: sesion.usuario.nombre, ip: ipDe(req), accion: fechaSri ? "NOTA_DEBITO_AUTORIZADA" : "NOTA_DEBITO_PENDIENTE", detalle: claveAcceso } }).catch(() => {})
    return NextResponse.json({
      autorizado: Boolean(fechaSri),
      fechaAutorizacion: fechaSri,
      claveAcceso,
      mensaje: fechaSri ? "Nota de débito autorizada por el SRI." : (real.mensajes.filter(Boolean).join(" ") || real.error || "El SRI no devolvió fecha de autorización."),
    })
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : "No se pudo enviar la nota de débito."
    return NextResponse.json({ autorizado: false, mensaje }, { status: 500 })
  }
}
