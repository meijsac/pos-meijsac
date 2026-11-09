import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { puede } from "@/lib/seguridad"
import { costoParaSalida, type MetodoCosteo, type MovimientoCosto } from "@/lib/kardex-costo"

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!puede(sesion.usuario.rol, "kardex")) return NextResponse.json({ error: "Tu rol no puede ver transferencias" }, { status: 403 })
  const transferencias = await prisma.transferenciaInventario.findMany({
    where: { empresaId: sesion.empresa.id },
    orderBy: { fecha: "desc" },
  })
  return NextResponse.json({
    transferencias: transferencias.map((t) => ({
      id: t.id,
      fecha: t.fecha.toISOString(),
      origen: t.origen,
      destino: t.destino,
      productoId: t.productoId,
      productoCodigo: t.productoCodigo,
      productoNombre: t.productoNombre,
      cantidad: t.cantidad,
      costo: t.costo,
      motivo: t.motivo,
      usuario: t.usuario,
    })),
  })
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!puede(sesion.usuario.rol, "transferir")) return NextResponse.json({ error: "Tu rol no puede transferir" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const origen = String(body.origen || "PRINCIPAL")
  const destino = String(body.destino || "")
  const cantidad = Number(body.cantidad)
  const productoId = String(body.productoId || "")
  if (!productoId || !destino || origen === destino) return NextResponse.json({ error: "Elige una sucursal destino distinta del origen" }, { status: 400 })
  if (!Number.isFinite(cantidad) || cantidad <= 0) return NextResponse.json({ error: "La cantidad debe ser mayor a 0" }, { status: 400 })

  const config = await prisma.inventarioConfig.findUnique({ where: { empresaId: sesion.empresa.id } })
  const metodo = (config?.metodoCosteo || "PROMEDIO") as MetodoCosteo
  const previos = await prisma.kardexMovimiento.findMany({
    where: { empresaId: sesion.empresa.id, productoId, sucursal: origen },
    orderBy: { fecha: "asc" },
  })
  const movs: MovimientoCosto[] = previos.map((m) => ({
    id: m.id,
    fecha: m.fecha.toISOString(),
    sucursal: m.sucursal,
    cantidadEntrada: m.cantidadEntrada,
    cantidadSalida: m.cantidadSalida,
    costoEntrada: m.costoEntrada,
  }))
  const costo = costoParaSalida(movs, metodo, origen, cantidad)
  const stockDeclarado = Number(body.stockOrigen)
  const alcanza = previos.length > 0 ? costo.ok : Number.isFinite(stockDeclarado) && stockDeclarado >= cantidad
  if (!alcanza) {
    const mensaje = origen === "PRINCIPAL" ? "Stock insuficiente en Matriz" : `Stock insuficiente en ${origen}`
    return NextResponse.json({ error: mensaje }, { status: 400 })
  }
  const costoUnitario = previos.length > 0 ? costo.costoUnitario : Number(body.costo) || 0
  const ahora = new Date()
  const usuario = sesion.usuario.nombre || ""
  const resultado = await prisma.$transaction(async (tx) => {
    const transferencia = await tx.transferenciaInventario.create({
      data: {
        empresaId: sesion.empresa.id,
        fecha: ahora,
        origen,
        destino,
        productoId,
        productoCodigo: String(body.productoCodigo || ""),
        productoNombre: String(body.productoNombre || ""),
        cantidad,
        costo: costoUnitario,
        motivo: String(body.motivo || ""),
        usuario,
      },
    })
    const salida = await tx.kardexMovimiento.create({
      data: {
        empresaId: sesion.empresa.id,
        productoId,
        productoCodigo: String(body.productoCodigo || ""),
        productoNombre: String(body.productoNombre || ""),
        sucursal: origen,
        fecha: ahora,
        tipo: "TRANSFERENCIA",
        detalle: `Salida por Transferencia a ${destino}. ${String(body.motivo || "")}`.trim(),
        cantidadEntrada: 0,
        cantidadSalida: cantidad,
        costoEntrada: costoUnitario,
        usuario,
        transferenciaId: transferencia.id,
      },
    })
    const entrada = await tx.kardexMovimiento.create({
      data: {
        empresaId: sesion.empresa.id,
        productoId,
        productoCodigo: String(body.productoCodigo || ""),
        productoNombre: String(body.productoNombre || ""),
        sucursal: destino,
        fecha: new Date(ahora.getTime() + 1),
        tipo: "TRANSFERENCIA",
        detalle: `Entrada por Transferencia desde ${origen}. ${String(body.motivo || "")}`.trim(),
        cantidadEntrada: cantidad,
        cantidadSalida: 0,
        costoEntrada: costoUnitario,
        usuario,
        transferenciaId: transferencia.id,
      },
    })
    return { transferencia, salida, entrada }
  })
  return NextResponse.json({
    transferencia: {
      id: resultado.transferencia.id,
      fecha: resultado.transferencia.fecha.toISOString(),
      origen,
      destino,
      productoId,
      productoNombre: resultado.transferencia.productoNombre,
      cantidad,
      costo: costoUnitario,
      motivo: resultado.transferencia.motivo,
      usuario,
    },
    movimientos: [resultado.salida, resultado.entrada].map((m) => ({
      id: m.id,
      productoId: m.productoId,
      sucursal: m.sucursal,
      fecha: m.fecha.toISOString(),
      tipo: m.tipo,
      detalle: m.detalle,
      cantidadEntrada: m.cantidadEntrada,
      cantidadSalida: m.cantidadSalida,
      costoEntrada: m.costoEntrada,
      usuario: m.usuario,
      transferenciaId: m.transferenciaId,
    })),
  })
}
