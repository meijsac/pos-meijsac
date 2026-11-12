import { NextResponse } from "next/server"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { htmlGuiaRemision, htmlGuiaTicket, htmlRide, htmlTicket } from "@/lib/sri/ride-html"
import { facturaPorClave } from "@/lib/sri/buscar-comprobante"
import { pdfRide } from "@/lib/sri/ride-archivo"
import { leerComprobanteArchivado } from "@/lib/security/storage"
import { guardarRespaldo } from "@/lib/sri/respaldo"

export const dynamic = "force-dynamic"

function pagina(titulo: string, texto: string, status = 200) {
  const html = `<!DOCTYPE html><html lang="es"><body style="font-family:Arial,sans-serif;padding:24px;color:#0f172a"><h1 style="font-size:18px">${titulo}</h1><p>${texto}</p></body></html>`
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
}

export async function GET(req: Request, context: { params: Promise<{ clave: string }> }) {
  const { clave: crudo } = await context.params
  const clave = String(crudo || "").replace(/\D/g, "")
  if (clave.length !== 49) return pagina("Comprobante", "La clave de acceso no tiene 49 dígitos.", 400)
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return pagina("Sesión", "Vuelve a entrar para ver el comprobante.", 401)
  const fila = await facturaPorClave(sesion.empresa.id, clave)
  const xmlGuardado = await leerComprobanteArchivado(sesion.empresa.id, clave, "xml")
  const htmlGuardado = await leerComprobanteArchivado(sesion.empresa.id, clave, "html")
  const pdfGuardado = await leerComprobanteArchivado(sesion.empresa.id, clave, "pdf")
  if (!fila && !xmlGuardado && !htmlGuardado && !pdfGuardado) return pagina("Comprobante", "No encontré esta factura.", 404)
  const p = ((fila?.payload || {}) as Record<string, any>)
  const emisor = p.configEmisor || {}
  const cliente = p.cliente || {}
  const t = p.totales || {}
  const fecha = String(p.fechaAutorizacion || "").trim()
  const autorizado = String(fila?.estado || p.estadoSRI || "").toUpperCase() === "AUTORIZADO" && fecha.length > 0
  const numero = [p.establecimiento, p.secuencial].filter(Boolean).join("-")
  const xmlAutorizado = (() => {
    const aut = p.sriAutorizacion?.RespuestaAutorizacionComprobante?.autorizaciones?.autorizacion
    const comp = Array.isArray(aut) ? aut.find((a: { estado?: string }) => a?.estado === "AUTORIZADO")?.comprobante || aut[0]?.comprobante : aut?.comprobante
    return String(comp || p.xmlContent || "")
  })()
  const pedido = new URL(req.url)
  const vuelto = Number(p.pagos?.vuelto || p.vuelto || 0)
  const recibido = Number(p.pagos?.efectivoRecibido || p.efectivoRecibido || p.pagos?.entregado || 0)
  if (pedido.searchParams.get("xml") === "1") {
    const cuerpo = xmlAutorizado || xmlGuardado?.toString("utf8") || ""
    if (!cuerpo) return pagina("XML", "Esta factura no tiene XML.", 404)
    return new NextResponse(cuerpo, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${String(p.tipoComprobante || p.codDoc || "") === "06" ? "guia" : "factura"}-${clave}.xml"`,
        "Cache-Control": "no-store",
      },
    })
  }
  if (pedido.searchParams.get("pdf") === "1") {
    const archivo = pdfGuardado || (fila ? pdfRide(p, fecha) : null)
    if (!archivo) return pagina("RIDE", "Este comprobante no tiene el PDF guardado.", 404)
    return new NextResponse(new Uint8Array(archivo), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ride-${clave}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  }
  if (autorizado && !htmlGuardado && (xmlAutorizado || p.xmlContent)) {
    void guardarRespaldo(sesion.empresa.id, clave, xmlAutorizado || String(p.xmlContent || ""), { estado: "AUTORIZADO", fechaAutorizacion: fecha }, p)
  }
  if (pedido.searchParams.get("ticket") !== "1" && htmlGuardado) {
    return new NextResponse(htmlGuardado.toString("utf8"), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
  }
  if (String(p.tipoComprobante || p.codDoc || "") === "06") {
    const destinos = (Array.isArray(p.destinatarios) ? p.destinatarios : []).map((dest: Record<string, any>) => ({
      identificacion: dest.identificacionDestinatario,
      razon: dest.razonSocialDestinatario,
      direccion: dest.dirDestinatario,
      motivo: dest.motivoTraslado,
      documento: dest.codDocSustento === "04" ? "Nota de crédito" : dest.codDocSustento === "03" ? "Liquidación" : "Factura",
      numero: dest.numDocSustento,
      fecha: dest.fechaEmisionDocSustento,
      productos: (Array.isArray(dest.productos) ? dest.productos : []).map((item: Record<string, any>) => ({
        codigo: item.codigoInterno || item.codigo,
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad ?? item.cantidadEnviar ?? 0),
      })),
    }))
    const guia = {
      razonSocial: emisor.razon || "",
      nombreComercial: emisor.comercial || "",
      ruc: emisor.ruc || "",
      numero,
      claveAcceso: clave,
      fechaAutorizacion: autorizado ? fecha : "",
      ambiente: clave[23] === "2" ? "PRODUCCIÓN" : "PRUEBAS",
      transportista: p.transportista?.razon || "",
      placa: p.transportista?.placa || "",
      inicio: p.fechaIniTransporte || "",
      fin: p.fechaFinTransporte || "",
      destinatarios: destinos,
    }
    const cuerpo = pedido.searchParams.get("ticket") === "1"
      ? htmlGuiaTicket(guia)
      : htmlGuiaRemision({
        ...guia,
        dirMatriz: emisor.matriz || "",
        obligado: emisor.obligado || "",
        regimen: emisor.regimen || "",
        fechaEmision: p.fechaEmisionFormato || "",
        identificacionTransportista: p.transportista?.identificacion || "",
        partida: p.dirPartida || "",
        xmlUrl: `/dashboard/factura-xml/pdf/${clave}?xml=1`,
      })
    return new NextResponse(cuerpo, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
  }
  const html = htmlRide({
    razonSocial: emisor.razon || "",
    nombreComercial: emisor.comercial || "",
    ruc: emisor.ruc || "",
    dirMatriz: emisor.matriz || "",
    dirSucursal: emisor.sucursal || "",
    obligado: emisor.obligado || "",
    regimen: emisor.regimen || "",
    logoUrl: emisor.logo || "",
    numeroFactura: numero,
    claveAcceso: clave,
    fechaAutorizacion: autorizado ? fecha : "",
    ambiente: clave[23] === "2" ? "PRODUCCIÓN" : "PRUEBAS",
    cliente: cliente.razon || "",
    identificacion: cliente.identificacion || "",
    fechaEmision: p.fechaEmisionFormato || "",
    email: cliente.email || "",
    direccionCliente: cliente.direccion || "",
    formaPago: p.formaPago || "",
    items: Array.isArray(p.items) ? p.items : [],
    base15: t.base15,
    base0: t.base0,
    baseNoObjeto: t.baseNoObjeto,
    baseExento: t.baseExento,
    subtotalSin: t.subtotalSin,
    descuento: t.descuento,
    ice: t.valorICE,
    iva: t.iva15,
    propina: t.propina,
    total: t.total,
    mensajeSri: autorizado ? "" : (p.mensajeSri || ""),
    xmlUrl: `/dashboard/factura-xml/pdf/${clave}?xml=1`,
    vuelto,
    recibido,
  })
  if (pedido.searchParams.get("ticket") === "1") {
    return new NextResponse(htmlTicket({
      razonSocial: emisor.razon || "",
      nombreComercial: emisor.comercial || "",
      ruc: emisor.ruc || "",
      dirMatriz: emisor.matriz || "",
      dirSucursal: emisor.sucursal || "",
      obligado: emisor.obligado || "",
      regimen: emisor.regimen || "",
      logoUrl: "",
      numeroFactura: numero,
      claveAcceso: clave,
      fechaAutorizacion: autorizado ? fecha : "",
      ambiente: clave[23] === "2" ? "PRODUCCIÓN" : "PRUEBAS",
      cliente: cliente.razon || "",
      identificacion: cliente.identificacion || "",
      fechaEmision: p.fechaEmisionFormato || "",
      email: cliente.email || "",
      direccionCliente: cliente.direccion || "",
      formaPago: p.formaPago || "",
      items: Array.isArray(p.items) ? p.items : [],
      base15: t.base15, base0: t.base0, baseNoObjeto: t.baseNoObjeto, baseExento: t.baseExento,
      subtotalSin: t.subtotalSin, descuento: t.descuento, ice: t.valorICE, iva: t.iva15,
      propina: t.propina, total: t.total, vuelto, recibido,
    }), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
  }
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
}
