import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

export const dynamic = "force-dynamic"

function dia(valor: string, fin: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const fecha = new Date(`${valor}T${fin ? "23:59:59" : "00:00:00"}-05:00`)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

function venta(payload: any, estado: string) {
  const tipo = String(payload?.tipoComprobante || payload?.codDoc || "01").replace(/\D/g, "").padStart(2, "0").slice(-2)
  const visible = String(payload?.estadoSRI || estado || "").toUpperCase()
  if (tipo !== "01") return false
  if (visible.includes("ANUL")) return false
  return visible === "AUTORIZADO" || Boolean(payload?.fechaAutorizacion)
}

function plata(valor: unknown) {
  const n = Number(valor)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function pagosDe(payload: any) {
  const pagos = payload?.pagos && typeof payload.pagos === "object" ? payload.pagos : {}
  const efectivo = plata(pagos.efectivo)
  const tarjeta = plata(pagos.tarjeta) + plata(pagos.debito)
  const transferencia = plata(pagos.redBancaria)
  if (efectivo || tarjeta || transferencia) return { efectivo, tarjeta, transferencia }
  const total = plata(payload?.totales?.total)
  const forma = String(payload?.formaPago || "")
  if (forma.startsWith("16") || forma.startsWith("19")) return { efectivo: 0, tarjeta: total, transferencia: 0 }
  if (forma.startsWith("20")) return { efectivo: 0, tarjeta: 0, transferencia: total }
  return { efectivo: total, tarjeta: 0, transferencia: 0 }
}

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const url = new URL(req.url)
  const desde = dia(url.searchParams.get("desde") || "", false)
  const hasta = dia(url.searchParams.get("hasta") || "", true)
  const trabajador = String(url.searchParams.get("usuarioId") || "")
  const empresaId = sesion.empresa.id
  const filas = await prisma.facturaEmitida.findMany({
    where: {
      empresaId,
      ...(desde || hasta ? { createdAt: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  })
  const equipo = await prisma.usuario.findMany({
    where: { empresaId },
    select: { id: true, nombre: true },
  })
  const nombres = new Map(equipo.map((u) => [u.id, u.nombre]))
  const facturas = filas.flatMap((fila) => {
    const payload = (fila.payload || {}) as any
    if (!venta(payload, fila.estado)) return []
    const usuarioId = String(fila.usuarioId || payload.usuarioId || "")
    if (trabajador && usuarioId !== trabajador) return []
    const pagos = pagosDe(payload)
    const productos = Array.isArray(payload.items) ? payload.items.map((item: { descripcion?: string; nombre?: string }) => item.descripcion || item.nombre || "").filter(Boolean).join(", ") : ""
    return [{
      id: fila.id,
      fecha: fila.createdAt.toISOString().slice(0, 10),
      secuencial: [payload.establecimiento, payload.secuencial].filter(Boolean).join("-"),
      cliente: String(payload.cliente?.razon || ""),
      ruc: String(payload.cliente?.identificacion || ""),
      monto: plata(payload.totales?.total),
      usuarioId,
      vendedor: nombres.get(usuarioId) || String(payload.atendidoPor || "Sin trabajador"),
      caja: String(payload.establecimiento || ""),
      productos,
      ...pagos,
    }]
  })
  const porTrabajador = new Map<string, { usuarioId: string; nombre: string; total: number; documentos: number }>()
  const porCaja = new Map<string, { caja: string; efectivo: number; tarjeta: number; transferencia: number; total: number }>()
  for (const f of facturas) {
    const persona = porTrabajador.get(f.usuarioId) || { usuarioId: f.usuarioId, nombre: f.vendedor, total: 0, documentos: 0 }
    persona.total = plata(persona.total + f.monto)
    persona.documentos += 1
    porTrabajador.set(f.usuarioId, persona)
    const caja = porCaja.get(f.caja || "—") || { caja: f.caja || "—", efectivo: 0, tarjeta: 0, transferencia: 0, total: 0 }
    caja.efectivo = plata(caja.efectivo + f.efectivo)
    caja.tarjeta = plata(caja.tarjeta + f.tarjeta)
    caja.transferencia = plata(caja.transferencia + f.transferencia)
    caja.total = plata(caja.total + f.monto)
    porCaja.set(caja.caja, caja)
  }
  const notas = filas.flatMap((fila) => {
    const payload = (fila.payload || {}) as any
    const tipo = String(payload?.tipoComprobante || payload?.codDoc || "").replace(/\D/g, "").padStart(2, "0").slice(-2)
    if (tipo !== "04") return []
    const usuarioId = String(fila.usuarioId || payload.usuarioId || "")
    if (trabajador && usuarioId !== trabajador) return []
    const productos = Array.isArray(payload.items) ? payload.items.map((item: { descripcion?: string; nombre?: string }) => item.descripcion || item.nombre || "").filter(Boolean).join(", ") : ""
    return [{
      id: fila.id,
      fecha: fila.createdAt.toISOString().slice(0, 10),
      secuencial: [payload.establecimiento, payload.secuencial].filter(Boolean).join("-"),
      cliente: String(payload.cliente?.razon || ""),
      ruc: String(payload.cliente?.identificacion || ""),
      monto: plata(payload.totales?.total),
      usuarioId,
      vendedor: nombres.get(usuarioId) || String(payload.atendidoPor || "Sin trabajador"),
      caja: String(payload.establecimiento || ""),
      productos,
      efectivo: 0,
      tarjeta: 0,
      transferencia: 0,
    }]
  })
  const clientes = await prisma.cliente.findMany({
    where: {
      empresaId,
      creadoPorUsuarioId: trabajador ? trabajador : { not: null },
      ...(desde || hasta ? { createdAt: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } } : {}),
    },
    select: { id: true, identificacion: true, razonSocial: true, creadoPorUsuarioId: true, createdAt: true },
  })
  const ids = new Set(clientes.map((c) => c.identificacion))
  const compras = new Map<string, number>()
  if (ids.size) {
    const historial = await prisma.facturaEmitida.findMany({
      where: { empresaId },
      select: { estado: true, payload: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    })
    for (const fila of historial) {
      const payload = (fila.payload || {}) as any
      if (!venta(payload, fila.estado)) continue
      const identificacion = String(payload.cliente?.identificacion || "")
      if (!ids.has(identificacion)) continue
      compras.set(identificacion, plata((compras.get(identificacion) || 0) + plata(payload.totales?.total)))
    }
  }
  const captacion = new Map<string, { usuarioId: string; nombre: string; nuevos: number; comprado: number }>()
  for (const cliente of clientes) {
    const usuarioId = cliente.creadoPorUsuarioId || ""
    const fila = captacion.get(usuarioId) || { usuarioId, nombre: nombres.get(usuarioId) || "Sin trabajador", nuevos: 0, comprado: 0 }
    fila.nuevos += 1
    fila.comprado = plata(fila.comprado + (compras.get(cliente.identificacion) || 0))
    captacion.set(usuarioId, fila)
  }
  return NextResponse.json({
    facturas,
    notas,
    trabajadores: equipo.map((u) => ({ id: u.id, nombre: u.nombre })),
    porTrabajador: [...porTrabajador.values()],
    porCaja: [...porCaja.values()],
    captacion: [...captacion.values()],
  })
}
