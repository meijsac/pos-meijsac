import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { htmlRide, htmlTicket } from "@/lib/sri/ride-html"

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
  const filas = await prisma.facturaEmitida.findMany({
    where: { empresaId: sesion.empresa.id },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { payload: true, estado: true },
  })
  const fila = filas.find((f) => String((f.payload as { claveAcceso?: string } | null)?.claveAcceso || "").replace(/\D/g, "") === clave)
  if (!fila) return pagina("Comprobante", "No encontré esta factura.", 404)
  const p = (fila.payload || {}) as Record<string, any>
  const emisor = p.configEmisor || {}
  const cliente = p.cliente || {}
  const t = p.totales || {}
  const fecha = String(p.fechaAutorizacion || "").trim()
  const autorizado = String(fila.estado || p.estadoSRI || "").toUpperCase() === "AUTORIZADO" && fecha.length > 0
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
    if (!xmlAutorizado) return pagina("XML", "Esta factura no tiene XML.", 404)
    return new NextResponse(xmlAutorizado, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="factura-${clave}.xml"`,
        "Cache-Control": "no-store",
      },
    })
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
