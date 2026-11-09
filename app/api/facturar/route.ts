import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { accesoEmpresa, ipDe, navegadorDe, puede, sanitizarTexto } from "@/lib/seguridad"
import { anotarFacturaCaja } from "@/lib/login-memoria"
import { FaltanDatosSri, armarXmlFactura } from "@/lib/sri/xml-factura"
import { firmarFacturaXml } from "@/lib/sri/firmar"
import { codigoAmbiente } from "@/lib/sri/ambiente"
import { URLS_SRI, enviarAlSri } from "@/lib/sri/cliente-sri"
import { guardarRespuestaSri, sriStatusDe } from "@/lib/sri/guardar-respuesta"
import { elegirSecuencial, serieDeAmbiente } from "@/lib/sri/punto-emision"
import { desencriptarBytes, desencriptar } from "@/lib/seguridad"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
    if (!puede(sesion.usuario.rol, "facturar")) return NextResponse.json({ error: "Tu rol no puede facturar" }, { status: 403 })
    const body = await req.json()
    const caja = String(body?.caja || sesion.usuario.id)
    if (anotarFacturaCaja(caja, Date.now()) > 30) return NextResponse.json({ error: "Demasiadas facturas por minuto" }, { status: 429 })
    const diferirSri = body?.diferirSri === true
    if (body) delete body.diferirSri
    if (body?.cliente) body.cliente.razon = sanitizarTexto(body.cliente.razon)
    const claveFirma = String(body?.claveFirma || "")
    delete body.claveFirma
    if (body?.firma) delete body.firma.clave
    const extraPrevio = sesion.empresa.datosRegistro && typeof sesion.empresa.datosRegistro === "object" && !Array.isArray(sesion.empresa.datosRegistro)
      ? sesion.empresa.datosRegistro as Record<string, unknown>
      : {}
    const ambientePrevio = codigoAmbiente(extraPrevio.ambiente || extraPrevio.ambienteCodigo || body?.configEmisor?.ambiente)
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
    const extra = sesion.empresa.datosRegistro && typeof sesion.empresa.datosRegistro === "object" && !Array.isArray(sesion.empresa.datosRegistro)
      ? sesion.empresa.datosRegistro as Record<string, unknown>
      : {}
    const ambiente = codigoAmbiente(extra.ambiente || extra.ambienteCodigo || body?.configEmisor?.ambiente)
    let xml = armado.xml
    let firmado = false
    const firma = await prisma.firmaElectronica.findUnique({ where: { empresaId: sesion.empresa.id } })
    if (!firma) return NextResponse.json({ error: "Falta el archivo .p12. Súbelo en Configuración, pestaña Firma." }, { status: 400 })
    let claveGuardada = ""
    if (firma.claveCifrada) {
      try { claveGuardada = desencriptar(firma.claveCifrada) } catch { claveGuardada = "" }
    }
    const claveUsar = claveFirma || claveGuardada
    if (!claveUsar) return NextResponse.json({ error: "Guarda la contraseña del .p12 en Configuración, pestaña Firma." }, { status: 400 })
    try {
      xml = firmarFacturaXml(xml, desencriptarBytes(firma.p12Cifrado), claveUsar)
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
        estado: "PENDIENTE",
        sriStatus: sriStatusDe(String(body.estadoSRI || "PENDIENTE"), ""),
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
    if (diferirSri) {
      return NextResponse.json({
        id: factura.id,
        claveAcceso: armado.claveAcceso,
        establecimiento: `${armado.estab}-${armado.pto}`,
        secuencial: armado.secuencial,
        estado: "PENDIENTE",
        firmado,
        fechaAutorizacion: "",
        conectado: null,
      })
    }
    const urls = URLS_SRI[ambiente]
    let real
    try {
      real = await enviarAlSri({
        xmlFirmado: xml,
        claveAcceso: armado.claveAcceso,
        ambiente,
        recepcionUrl: urls.recepcion,
        autorizacionUrl: urls.autorizacion,
      })
    } catch (error: any) {
      const code = String(error?.cause?.code || error?.code || error?.codigo || "")
      if (error?.name === "TimeoutError" || code === "Timeout" || code === "ETIMEDOUT") {
        return NextResponse.json({ conectado: false, error: "Timeout", id: factura.id, estado: "PENDIENTE" })
      }
      if (code === "ENOTFOUND" || code === "ECONNREFUSED") {
        return NextResponse.json({ conectado: false, error: code, id: factura.id, estado: "PENDIENTE" })
      }
      throw error
    }
    const cerrado = await guardarRespuestaSri(factura.id, body, real)
    return NextResponse.json({
      id: factura.id,
      claveAcceso: armado.claveAcceso,
      establecimiento: `${armado.estab}-${armado.pto}`,
      secuencial: armado.secuencial,
      xml,
      firmado,
      enviado: real.conectado,
      ...cerrado,
    })
  } catch (e: any) {
    const code = String(e?.cause?.code || e?.code || e?.codigo || "")
    if (e?.name === "TimeoutError" || code === "Timeout" || code === "ETIMEDOUT") {
      return NextResponse.json({ conectado: false, error: "El SRI tardó demasiado en responder (Timeout)." }, { status: 504 })
    }
    if (code === "ENOTFOUND" || code === "ECONNREFUSED") {
      return NextResponse.json({ conectado: false, error: "No se pudo establecer conexión física con los servidores del SRI. Revisa tu internet o el estado del SRI." }, { status: 500 })
    }
    return NextResponse.json({ conectado: false, error: e.message || "No se pudo establecer conexión física con los servidores del SRI. Revisa tu internet o el estado del SRI." }, { status: 500 })
  }
}

