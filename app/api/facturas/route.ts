import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { accesoEmpresa, ipDe, navegadorDe, puede, sanitizarTexto } from "@/lib/seguridad"
import { anotarFacturaCaja } from "@/lib/login-memoria"
import { FaltanDatosSri, armarXmlFactura } from "@/lib/sri/xml-factura"
import { firmarFacturaXml } from "@/lib/sri/firmar"
import { codigoAmbiente, envioSriPermitido } from "@/lib/sri/ambiente"
import { enviarComprobante } from "@/lib/sri/soap"
import { desencriptarBytes } from "@/lib/seguridad"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
    if (!puede(sesion.usuario.rol, "facturar")) return NextResponse.json({ error: "Tu rol no puede facturar" }, { status: 403 })
    const body = await req.json()
    const caja = String(body?.caja || sesion.usuario.id)
    if (anotarFacturaCaja(caja, Date.now()) > 30) return NextResponse.json({ error: "Demasiadas facturas por minuto" }, { status: 429 })
    if (body?.cliente) body.cliente.razon = sanitizarTexto(body.cliente.razon)
    const claveFirma = String(body?.claveFirma || "")
    delete body.claveFirma
    if (body?.firma) delete body.firma.clave
    let armado: ReturnType<typeof armarXmlFactura>
    try {
      armado = armarXmlFactura(sesion.empresa, body)
    } catch (e) {
      if (e instanceof FaltanDatosSri) return NextResponse.json({ error: e.message, faltantes: e.faltantes }, { status: 400 })
      throw e
    }
    const extra = sesion.empresa.datosRegistro && typeof sesion.empresa.datosRegistro === "object" && !Array.isArray(sesion.empresa.datosRegistro)
      ? sesion.empresa.datosRegistro as Record<string, unknown>
      : {}
    const ambiente = codigoAmbiente(extra.ambiente || extra.ambienteCodigo || body?.configEmisor?.ambiente)
    const enviar = envioSriPermitido(ambiente)
    let xml = armado.xml
    let firmado = false
    if (enviar) {
      if (!claveFirma) return NextResponse.json({ error: "Escribe la contraseña del .p12. Se usa solo para firmar este envío y no se guarda." }, { status: 400 })
      const firma = await prisma.firmaElectronica.findUnique({ where: { empresaId: sesion.empresa.id } })
      if (!firma) return NextResponse.json({ error: "Falta el archivo .p12. Súbelo en Configuración, pestaña Firma." }, { status: 400 })
      try {
        xml = firmarFacturaXml(xml, desencriptarBytes(firma.p12Cifrado), claveFirma)
        firmado = true
      } catch (e: any) {
        return NextResponse.json({ error: e.message || "No se pudo firmar el XML" }, { status: 400 })
      }
    }
    body.claveAcceso = armado.claveAcceso
    body.establecimiento = `${armado.estab}-${armado.pto}`
    body.secuencial = armado.secuencial
    body.xmlContent = xml
    body.firmado = firmado
    body.estadoSRI = "PENDIENTE_DE_AUTORIZAR"
    body.envioSri = enviar ? (ambiente === "1" ? "PRUEBAS" : "PRODUCCION") : "PRODUCCION_BLOQUEADA"
    body.auditoria = { ip: ipDe(req), dispositivo: navegadorDe(req), usuario: sesion.usuario.nombre, caja, fecha: new Date().toISOString() }
    const plazo = Number(body.plazo)
    const cuotas = Number(body.cuotas)
    const vence = body.fecha_vencimiento ? new Date(body.fecha_vencimiento) : null
    const factura = await prisma.facturaEmitida.create({
      data: {
        empresaId: sesion.empresa.id,
        estado: "PENDIENTE_DE_AUTORIZAR",
        payload: body,
        tipoCobro: body.tipo_cobro ? String(body.tipo_cobro) : null,
        estadoPago: body.estado_pago ? String(body.estado_pago) : null,
        plazo: Number.isFinite(plazo) && plazo > 0 ? Math.round(plazo) : null,
        unidadPlazo: body.unidad_plazo ? String(body.unidad_plazo) : null,
        cuotas: Number.isFinite(cuotas) && cuotas > 0 ? Math.round(cuotas) : null,
        fechaVencimiento: vence && !Number.isNaN(vence.getTime()) ? vence : null,
      },
    })
    if (body.modo_negocio === "RESTAURANTE" || body.modo_negocio === "GENERAL") {
      const prev = sesion.empresa.datosRegistro && typeof sesion.empresa.datosRegistro === "object" && !Array.isArray(sesion.empresa.datosRegistro)
        ? sesion.empresa.datosRegistro as Record<string, unknown>
        : {}
      await prisma.empresa.update({
        where: { id: sesion.empresa.id },
        data: { datosRegistro: { ...prev, modo_negocio: body.modo_negocio } },
      })
    }
    const resultado = enviar
      ? await enviarComprobante({ xmlFirmado: xml, claveAcceso: armado.claveAcceso, ambiente })
      : { enviado: false, bloqueado: true, estado: "PENDIENTE_DE_AUTORIZAR" as const, mensaje: "Producción bloqueada. No se envió ningún comprobante al SRI.", mensajes: [] as string[], numeroAutorizacion: "", fechaAutorizacion: "" }
    body.estadoSRI = resultado.estado
    body.mensajeSri = resultado.mensaje
    body.mensajesSri = resultado.mensajes
    body.numeroAutorizacion = resultado.numeroAutorizacion || ""
    body.fechaAutorizacion = resultado.fechaAutorizacion || ""
    body.enviado = resultado.enviado
    try {
      await prisma.facturaEmitida.update({
        where: { id: factura.id },
        data: { estado: resultado.estado, payload: body },
      })
    } catch {}
    return NextResponse.json({
      id: factura.id,
      claveAcceso: armado.claveAcceso,
      estado: resultado.estado,
      mensaje: resultado.mensaje,
      mensajes: resultado.mensajes,
      numeroAutorizacion: resultado.numeroAutorizacion || "",
      fechaAutorizacion: resultado.fechaAutorizacion || "",
      xml,
      firmado,
      enviado: resultado.enviado,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudo guardar la factura" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
    const idPedido = new URL(req.url).searchParams.get("id")
    if (idPedido) {
      const una = await prisma.facturaEmitida.findUnique({ where: { id: idPedido } })
      if (una && accesoEmpresa(sesion.empresa.id, una.empresaId) === 403) return NextResponse.json({ error: "No puedes ver datos de otra empresa" }, { status: 403 })
      if (!una) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
    }
    const filas = await prisma.facturaEmitida.findMany({
      where: { empresaId: sesion.empresa.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    return NextResponse.json(filas.map((f) => {
      const p = (f.payload || {}) as any
      return {
        id: f.id,
        facturaId: f.id,
        tipoComprobante: "01",
        secuencial: p.establecimiento && p.secuencial ? `${p.establecimiento}-${p.secuencial}` : p.secuencial || f.id,
        claveAcceso: p.claveAcceso || "",
        fechaEmision: p.fechaEmisionFormato || f.createdAt.toLocaleDateString("es-EC"),
        receptorIdentificacion: p.cliente?.identificacion || "",
        receptorNombre: p.cliente?.razon || "",
        valorTotal: Number(p.totales?.total || 0),
        estadoSRI: f.estado,
        tipo_cobro: f.tipoCobro || p.tipo_cobro || "",
        estado_pago: f.estadoPago || p.estado_pago || "",
        plazo: f.plazo ?? p.plazo ?? null,
        unidad_plazo: f.unidadPlazo || p.unidad_plazo || "",
        cuotas: f.cuotas ?? p.cuotas ?? null,
        fecha_vencimiento: f.fechaVencimiento ? f.fechaVencimiento.toLocaleDateString("es-EC") : p.fecha_vencimiento || "",
      }
    }))
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudieron leer las facturas" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
    const body = await req.json().catch(() => ({}))
    const id = String(body?.id || "")
    if (!id) return NextResponse.json({ error: "Falta la factura" }, { status: 400 })
    const ajena = await prisma.facturaEmitida.findUnique({ where: { id } })
    if (ajena && accesoEmpresa(sesion.empresa.id, ajena.empresaId) === 403) return NextResponse.json({ error: "No puedes ver datos de otra empresa" }, { status: 403 })
    if (body?.accion === "ANULAR" && !puede(sesion.usuario.rol, "anular")) return NextResponse.json({ error: "Tu rol no puede anular" }, { status: 403 })
    const actual = await prisma.facturaEmitida.findFirst({ where: { id, empresaId: sesion.empresa.id } })
    if (!actual) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
    const payload = { ...((actual.payload || {}) as any), estado_pago: "PAGADO", saldo_pendiente: 0 }
    const factura = await prisma.facturaEmitida.update({
      where: { id },
      data: { estadoPago: "PAGADO", payload },
    })
    return NextResponse.json({ id: factura.id, estado_pago: "PAGADO" })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudo registrar el pago" }, { status: 500 })
  }
}
