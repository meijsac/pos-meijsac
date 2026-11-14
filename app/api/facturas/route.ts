import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { accesoEmpresa, ipDe, navegadorDe, puede, sanitizarTexto } from "@/lib/seguridad"
import { anotarFacturaCaja } from "@/lib/login-memoria"
import { FaltanDatosSri, armarXmlFactura } from "@/lib/sri/xml-factura"
import { validarEsquemaSri } from "@/lib/sri/validar-xsd"
import { guardarRespaldo } from "@/lib/sri/respaldo"
import { firmarXmlEmpresa } from "@/lib/sri/firmar"
import { ambienteDeEmpresa } from "@/lib/sri/ambiente"
import { enviarComprobante } from "@/lib/sri/soap"
import { clasificarEstadoSri } from "@/lib/sri/estado-visible"
import { elegirSecuencial, serieDeAmbiente } from "@/lib/sri/punto-emision"
import { validarEntradaFactura } from "@/lib/factura-entrada"
import { ambienteDeComprobante } from "@/lib/ambiente-datos"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
    if (!puede(sesion.usuario.rol, "facturar")) return NextResponse.json({ error: "Tu rol no puede facturar" }, { status: 403 })
    const body = await req.json()
    const rechazo = validarEntradaFactura(body)
    if (rechazo) {
      prisma.seguridadLog.create({ data: { empresaId: sesion.empresa.id, usuario: sesion.usuario.nombre, ip: ipDe(req), accion: "FACTURA_RECHAZADA", dispositivo: navegadorDe(req), detalle: rechazo } }).catch(() => {})
      return NextResponse.json({ error: rechazo }, { status: 400 })
    }
    const caja = String(body?.caja || sesion.usuario.id)
    if (anotarFacturaCaja(caja, Date.now()) > 30) return NextResponse.json({ error: "Demasiadas facturas por minuto" }, { status: 429 })
    if (body?.cliente) body.cliente.razon = sanitizarTexto(body.cliente.razon)
    if (body?.firma) delete body.firma.clave
    delete body.claveFirma
    const ambientePrevio = ambienteDeEmpresa(sesion.empresa)
    if (body?.estadoSRI !== "BORRADOR") {
      const pedida = String(body?.establecimiento || "").trim()
      const serie = /^\d{3}-\d{3}$/.test(pedida) ? pedida : serieDeAmbiente(ambientePrevio)
      const previas = await prisma.facturaEmitida.findMany({
        where: { empresaId: sesion.empresa.id },
        select: { payload: true },
        orderBy: { createdAt: "desc" },
        take: 400,
      })
      const usados = new Set<string>()
      for (const fila of previas) {
        const p = (fila.payload || {}) as any
        if (String(p.establecimiento || "") !== serie) continue
        const n = String(p.secuencial || "").replace(/\D/g, "").padStart(9, "0").slice(-9)
        if (n && n !== "000000000") usados.add(n)
      }
      body.establecimiento = serie
      body.secuencial = elegirSecuencial(String(body.secuencial || ""), String(body.ultimoSecuencial || ""), usados)
    }
    let armado: ReturnType<typeof armarXmlFactura>
    try {
      armado = armarXmlFactura(sesion.empresa, body)
    } catch (e) {
      if (e instanceof FaltanDatosSri) return NextResponse.json({ error: e.message, faltantes: e.faltantes }, { status: 400 })
      throw e
    }
    const esquema = await validarEsquemaSri(armado.xml)
    if (esquema) return NextResponse.json({ error: esquema }, { status: 400 })
    const ambiente = ambienteDeEmpresa(sesion.empresa)
    let xml = armado.xml
    let firmado = false
    try {
      xml = await firmarXmlEmpresa(sesion.empresa.id, xml)
      firmado = true
    } catch (e: any) {
      return NextResponse.json({ error: e.message || "No se pudo firmar el XML" }, { status: 400 })
    }
    if (body?.estadoSRI !== "BORRADOR") {
      const previas = await prisma.facturaEmitida.findMany({
        where: { empresaId: sesion.empresa.id },
        select: { payload: true },
        orderBy: { createdAt: "desc" },
        take: 400,
      })
      const serie = `${armado.estab}-${armado.pto}`
      const repetida = previas.some((fila) => {
        const p = (fila.payload || {}) as any
        const est = String(p.establecimiento || "")
        const sec = String(p.secuencial || "").replace(/\D/g, "").padStart(9, "0").slice(-9)
        return est === serie && sec === armado.secuencial
      })
      if (repetida) return NextResponse.json({ error: `El secuencial ${serie}-${armado.secuencial} ya existe. No se puede emitir otra vez.` }, { status: 409 })
    }
    body.claveAcceso = armado.claveAcceso
    body.establecimiento = `${armado.estab}-${armado.pto}`
    body.secuencial = armado.secuencial
    body.xmlContent = xml
    body.firmado = firmado
    body.estadoSRI = "PENDIENTE_DE_AUTORIZAR"
    body.envioSri = ambiente === "2" ? "PRODUCCION" : "PRUEBAS"
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
    const resultado = await enviarComprobante({ xmlFirmado: xml, claveAcceso: armado.claveAcceso, ambiente })
    const fechaSri = resultado.fechaAutorizacion || ""
    const visible = clasificarEstadoSri(resultado.estado, fechaSri)
    const estadoGuardado = visible === "AUTORIZADO" ? "AUTORIZADO" : visible
    body.estadoSRI = estadoGuardado
    body.mensajeSri = resultado.mensaje
    body.mensajesSri = resultado.mensajes
    body.numeroAutorizacion = fechaSri ? (resultado.numeroAutorizacion || "") : ""
    body.fechaAutorizacion = fechaSri
    const respaldo = await guardarRespaldo(sesion.empresa.id, armado.claveAcceso, xml, { estado: estadoGuardado, fechaAutorizacion: fechaSri, numeroAutorizacion: body.numeroAutorizacion || "" }, body)
    body.respaldoOk = respaldo.respaldoOk
    body.respaldoError = respaldo.respaldoError
    body.conservarHasta = respaldo.conservarHasta
    body.estadoRecepcion = resultado.estadoRecepcion || ""
    body.mensajeRecepcion = resultado.mensajeRecepcion || ""
    body.fechaRecepcion = resultado.fechaRecepcion || ""
    body.estadoAutorizacion = resultado.estadoAutorizacion || ""
    body.mensajeAutorizacion = resultado.mensajeAutorizacion || ""
    body.enviado = resultado.enviado
    body.conectado = resultado.conectado !== false
    body.sriRecepcion = resultado.recepcionSri || null
    body.sriAutorizacion = resultado.autorizacionSri || null
    try {
      await prisma.facturaEmitida.update({
        where: { id: factura.id },
        data: { estado: estadoGuardado, payload: body },
      })
    } catch {}
    return NextResponse.json({
      id: factura.id,
      claveAcceso: armado.claveAcceso,
      establecimiento: `${armado.estab}-${armado.pto}`,
      secuencial: armado.secuencial,
      estado: estadoGuardado,
      mensaje: resultado.mensaje,
      mensajes: resultado.mensajes,
      numeroAutorizacion: fechaSri ? (resultado.numeroAutorizacion || "") : "",
      fechaAutorizacion: fechaSri,
      estadoRecepcion: resultado.estadoRecepcion || "",
      mensajeRecepcion: resultado.mensajeRecepcion || "",
      fechaRecepcion: resultado.fechaRecepcion || "",
      xml,
      firmado,
      enviado: resultado.enviado,
      conectado: resultado.conectado !== false,
      error: resultado.errorRed || "",
      status: resultado.estado === "DEVUELTA" || resultado.estadoRecepcion === "DEVUELTA" ? "DEVUELTA" : estadoGuardado,
      sriRecepcion: resultado.recepcionSri || null,
      sriAutorizacion: resultado.autorizacionSri || null,
      respaldoOk: respaldo.respaldoOk,
      respaldoError: respaldo.respaldoError,
      conservarHasta: respaldo.conservarHasta,
    })
  } catch (e: any) {
    const code = String(e?.cause?.code || e?.code || e?.codigo || "")
    if (e?.name === "TimeoutError" || code === "Timeout" || code === "ETIMEDOUT") {
      return NextResponse.json({ conectado: false, error: "Timeout" })
    }
    if (code === "ENOTFOUND" || code === "ECONNREFUSED") {
      return NextResponse.json({ conectado: false, error: code })
    }
    return NextResponse.json({ conectado: false, error: e.message || "No se pudo guardar la factura" }, { status: 500 })
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
        estadoSRI: String(p.estadoSRI || p.estado || f.estado || "").toUpperCase().includes("ANUL") ? "ANULADO" : clasificarEstadoSri(p.estadoSRI || f.estado, p.fechaAutorizacion),
        estadoCrudo: p.estadoSRI || f.estado,
        fechaAutorizacion: p.fechaAutorizacion || "",
        numeroAutorizacion: p.numeroAutorizacion || "",
        mensajeSri: p.mensajeSri || p.mensajeAutorizacion || "",
        estadoRecepcion: p.estadoRecepcion || "",
        mensajeRecepcion: p.mensajeRecepcion || "",
        fechaRecepcion: p.fechaRecepcion || "",
        xmlContent: p.xmlContent || "",
        tipo_cobro: f.tipoCobro || p.tipo_cobro || "",
        estado_pago: f.estadoPago || p.estado_pago || "",
        plazo: f.plazo ?? p.plazo ?? null,
        unidad_plazo: f.unidadPlazo || p.unidad_plazo || "",
        cuotas: f.cuotas ?? p.cuotas ?? null,
        fecha_vencimiento: f.fechaVencimiento ? f.fechaVencimiento.toLocaleDateString("es-EC") : p.fecha_vencimiento || "",
        envioSri: ambienteDeComprobante(p) === "2" ? "PRODUCCION" : "PRUEBAS",
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
    if (body?.accion === "ANULAR") {
      const previo = (actual.payload || {}) as any
      const payload = { ...previo, estadoSRI: "ANULADO", estado: "ANULADO", motivoAnulacion: "Anulado en SRI en Linea", fechaAnulacion: new Date().toISOString() }
      const factura = await prisma.facturaEmitida.update({
        where: { id },
        data: { estado: "ANULADO", sriStatus: "ANULADO", payload },
      })
      return NextResponse.json({ id: factura.id, estadoSRI: "ANULADO" })
    }
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

export async function DELETE(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
    if (!puede(sesion.usuario.rol, "eliminar")) return NextResponse.json({ error: "Tu rol no puede eliminar" }, { status: 403 })
    const body = await req.json().catch(() => ({}))
    const id = String(body?.id || "")
    const secPedido = String(body?.secuencial || "")
    if (!id && !secPedido) return NextResponse.json({ error: "Falta la factura" }, { status: 400 })
    const filas = await prisma.facturaEmitida.findMany({
      where: { empresaId: sesion.empresa.id },
      orderBy: { createdAt: "desc" },
      take: 400,
    })
    const visibles = (p: any) => (p?.establecimiento && p?.secuencial ? `${p.establecimiento}-${p.secuencial}` : String(p?.secuencial || ""))
    const candidatas = filas.filter((f) => f.id === id || (secPedido && visibles(f.payload) === secPedido))
    if (!candidatas.length) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
    const reales = candidatas.filter((f) => String(((f.payload || {}) as any).fechaAutorizacion || "").trim())
    if (reales.length === candidatas.length) {
      return NextResponse.json({ error: "Este comprobante sí fue autorizado por el SRI. Anúlalo en el portal; aquí queda como Anulado." }, { status: 409 })
    }
    const borrar = candidatas.filter((f) => !String(((f.payload || {}) as any).fechaAutorizacion || "").trim())
    await prisma.facturaEmitida.deleteMany({ where: { id: { in: borrar.map((f) => f.id) }, empresaId: sesion.empresa.id } })
    return NextResponse.json({ ok: true, eliminadas: borrar.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudo eliminar" }, { status: 500 })
  }
}
