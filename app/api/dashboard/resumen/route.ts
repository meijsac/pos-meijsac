import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

function esAutorizada(estado: string) {
  const e = estado.toUpperCase()
  if (e.includes("ANUL") || e.includes("BORRADOR") || e.includes("EMITIDA") || e.includes("PENDIENTE")) return false
  return e === "AUTORIZADO" || e.includes("AUTORIZADO")
}

function pendiente(estadoPago: string | null) {
  const e = String(estadoPago || "").toUpperCase()
  if (!e || e === "PAGADO") return false
  return e.includes("PENDIENTE") || e.includes("CREDITO") || e.includes("CRÉDITO")
}

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const filas = await prisma.facturaEmitida.findMany({
    where: { empresaId: sesion.empresa.id },
    orderBy: { createdAt: "asc" },
  })
  const ahora = new Date()
  const ventas = filas.filter((f) => {
    const payload = (f.payload || {}) as any
    const textos = [f.estado, payload.estadoSRI, payload.estado].map((x) => String(x || "").toUpperCase())
    if (textos.some((t) => t.includes("ANUL") || t.includes("BORRADOR"))) return false
    return textos.some((t) => esAutorizada(t))
  }).map((f) => {
    const payload = (f.payload || {}) as any
    const total = Number(payload?.totales?.total || 0)
    const emitida = payload.fechaEmision ? new Date(payload.fechaEmision) : f.createdAt
    const fecha = Number.isNaN(emitida.getTime()) ? f.createdAt : emitida
    return { fecha, total: Number.isFinite(total) ? total : 0, estadoPago: f.estadoPago || payload.estado_pago || "" }
  })
  const porCobrar = filas.filter((f) => {
    const payload = (f.payload || {}) as any
    const estado = String(f.estado || payload.estadoSRI || payload.estado || "").toUpperCase()
    if (estado.includes("ANUL") || estado.includes("BORRADOR")) return false
    return pendiente(f.estadoPago || payload.estado_pago || "")
  }).map((f) => Number((f.payload as any)?.totales?.total || 0)).filter((n) => Number.isFinite(n))
  const mismoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const deHoy = ventas.filter((v) => mismoDia(v.fecha, ahora))
  const delMes = ventas.filter((v) => v.fecha.getFullYear() === ahora.getFullYear() && v.fecha.getMonth() === ahora.getMonth())
  const hoy = deHoy.reduce((s, v) => s + v.total, 0)
  const mes = delMes.reduce((s, v) => s + v.total, 0)
  const cxc = porCobrar.reduce((s, n) => s + n, 0)
  const enRango = (desde: Date) => ventas.filter((v) => v.fecha >= desde && v.fecha <= ahora)
  const inicioDia = new Date(ahora); inicioDia.setHours(0, 0, 0, 0)
  const inicioSemana = new Date(inicioDia); inicioSemana.setDate(inicioDia.getDate() - 6)
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const inicioAnio = new Date(ahora.getFullYear(), 0, 1)
  const serie = (desde: Date, pasos: number, salto: (d: Date) => void) => {
    const valores: number[] = []
    const cursor = new Date(desde)
    for (let i = 0; i < pasos; i++) {
      const fin = new Date(cursor)
      salto(fin)
      valores.push(ventas.filter((v) => v.fecha >= cursor && v.fecha < fin).reduce((s, v) => s + v.total, 0))
      cursor.setTime(fin.getTime())
    }
    return valores
  }
  const metricas = (lista: { total: number }[]) => {
    const suma = lista.reduce((s, v) => s + v.total, 0)
    return {
      ventas: suma,
      pedidos: lista.length,
      carrito: lista.length ? suma / lista.length : 0,
    }
  }
  return NextResponse.json({
    ventasHoy: hoy,
    pedidosHoy: deHoy.length,
    ventasMes: mes,
    pedidosMes: delMes.length,
    cxc,
    ingresosMes: mes,
    egresosMes: null,
    liquidez: null,
    nota: "FacturaEmitida con estado AUTORIZADO. No hay tabla de compras o egresos.",
    series: {
      dia: serie(inicioDia, 12, (d) => d.setHours(d.getHours() + 2)),
      semana: serie(inicioSemana, 7, (d) => d.setDate(d.getDate() + 1)),
      mes: serie(inicioMes, 4, (d) => d.setDate(d.getDate() + 7)),
      año: serie(inicioAnio, 12, (d) => d.setMonth(d.getMonth() + 1)),
    },
    metricas: {
      dia: metricas(enRango(inicioDia)),
      semana: metricas(enRango(inicioSemana)),
      mes: metricas(enRango(inicioMes)),
      año: metricas(enRango(inicioAnio)),
    },
  })
}
