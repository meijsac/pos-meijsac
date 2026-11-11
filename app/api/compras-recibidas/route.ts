import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

function extraDe(datos: unknown) {
  return datos && typeof datos === "object" && !Array.isArray(datos) ? datos as Record<string, unknown> : {}
}

function fechaLimpia(fecha: unknown) {
  const dia = String(fecha || "").match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (dia) return `${dia[1]}/${dia[2]}/${dia[3]}`
  const iso = String(fecha || "").match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return ""
}

function listaDe(extra: Record<string, unknown>) {
  return Array.isArray(extra.comprasRecibidas) ? extra.comprasRecibidas as Record<string, any>[] : []
}

function publicar(c: Record<string, any>) {
  const base = Number(c.subtotalIva15 || 0) + Number(c.subtotalIva0 || 0) + Number(c.subtotalNoObjeto || 0) + Number(c.subtotalExento || 0)
  return {
    id: String(c.id),
    claveAcceso: String(c.claveAccesoProveedor || ""),
    proveedorRuc: String(c.rucProveedor || ""),
    proveedorNombre: String(c.razonSocialProveedor || ""),
    numeroFactura: String(c.secuencial || ""),
    fechaEmision: fechaLimpia(c.fechaEmision),
    baseImponible: base,
    valorIva: Number(c.valorIva || 0),
    totalFactura: Number(c.totalDocumento || 0),
    estadoRetencion: c.estadoAts === "RETENIDO" ? "RETENIDO" : "POR_RETENER",
    claveRetencion: String(c.claveRetencion || ""),
    subtotalIva15: Number(c.subtotalIva15 || 0),
    subtotalIva0: Number(c.subtotalIva0 || 0),
    subtotalNoObjeto: Number(c.subtotalNoObjeto || 0),
    subtotalExento: Number(c.subtotalExento || 0),
    sustento: String(c.sustento || "01"),
    tipo: String(c.tipo || "01 - FACTURA"),
  }
}

function periodoDe(fecha: string) {
  return fecha.length === 10 ? `${fecha.slice(6)}-${fecha.slice(3, 5)}` : ""
}

export async function GET(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ mensaje: sesion.error }, { status: sesion.status })
    const url = new URL(req.url)
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase()
    const periodo = String(url.searchParams.get("periodo") || "")
    const extra = extraDe(sesion.empresa.datosRegistro)
    const compras = listaDe(extra).map(publicar).filter((c) => {
      const texto = `${c.proveedorNombre} ${c.proveedorRuc} ${c.numeroFactura}`.toLowerCase()
      return (!q || texto.includes(q)) && (!periodo || periodoDe(c.fechaEmision) === periodo)
    })
    return NextResponse.json(compras)
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : "No se pudieron leer las compras."
    return NextResponse.json({ mensaje }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ mensaje: sesion.error }, { status: sesion.status })
    const body = await req.json()
    const extra = extraDe(sesion.empresa.datosRegistro)
    const actuales = listaDe(extra)
    const lote = Array.isArray(body?.compras)
    const entrantes = lote ? body.compras : [body]
    const claves = new Set(actuales.map((c) => String(c.claveAccesoProveedor || "")))
    const nuevas = []
    for (const item of entrantes) {
      const clave = String(item?.claveAcceso || item?.claveAccesoProveedor || "").replace(/\D/g, "")
      if (clave.length !== 49) {
        if (lote) continue
        return NextResponse.json({ mensaje: "La clave de acceso debe tener 49 dígitos." }, { status: 400 })
      }
      if (claves.has(clave)) continue
      claves.add(clave)
      nuevas.push({
        id: String(item.id || `${Date.now()}-${nuevas.length}`),
        claveAccesoProveedor: clave,
        secuencial: String(item.numeroFactura || item.secuencial || ""),
        rucProveedor: String(item.proveedorRuc || item.rucProveedor || ""),
        razonSocialProveedor: String(item.proveedorNombre || item.razonSocialProveedor || "").toUpperCase(),
        fechaEmision: fechaLimpia(item.fechaEmision),
        subtotalNoObjeto: Number(item.subtotalNoObjeto || 0),
        subtotalIva0: Number(item.subtotalIva0 || 0),
        subtotalIva15: Number(item.subtotalIva15 || item.baseImponible || 0),
        subtotalExento: Number(item.subtotalExento || 0),
        valorIva: Number(item.valorIva || 0),
        totalDocumento: Number(item.totalFactura || item.totalDocumento || 0),
        sustento: String(item.sustento || "01"),
        tipo: String(item.tipo || "01 - FACTURA"),
        estadoAts: "POR RETENER",
      })
    }
    if (!nuevas.length) return NextResponse.json({ mensaje: "Esa factura ya está registrada." }, { status: 409 })
    await prisma.empresa.update({
      where: { id: sesion.empresa.id },
      data: { datosRegistro: { ...extra, comprasRecibidas: [...nuevas, ...actuales] } },
    })
    return NextResponse.json({ guardadas: nuevas.length })
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : "No se pudo guardar la compra."
    return NextResponse.json({ mensaje }, { status: 500 })
  }
}
