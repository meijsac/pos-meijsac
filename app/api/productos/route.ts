import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

function datos(body: any) {
  const codigo = String(body?.codigo || "").trim()
  const nombre = String(body?.nombre || "").trim()
  if (!codigo || !nombre) throw new Error("Codigo y nombre son obligatorios")
  return {
    codigo,
    nombre,
    categoria: body?.categoria ? String(body.categoria) : null,
    precio: Number(body?.precio) || 0,
    costo: Number(body?.costo) || 0,
    stock: Number(body?.stock) || 0,
    stockMinimo: Number(body?.stockMinimo) || 5,
    ficha: body?.ficha && typeof body.ficha === "object" ? body.ficha : {},
  }
}

async function guardarUno(empresaId: string, body: any) {
  const data = datos(body)
  const id = String(body?.id || "")
  if (id) {
    const propio = await prisma.producto.findFirst({ where: { id, empresaId } })
    if (propio) return prisma.producto.update({ where: { id }, data })
  }
  const existe = await prisma.producto.findFirst({ where: { empresaId, codigo: data.codigo } })
  if (existe) return prisma.producto.update({ where: { id: existe.id }, data })
  return prisma.producto.create({ data: { ...data, empresaId } })
}

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() || ""
  const productos = await prisma.producto.findMany({
    where: { empresaId: sesion.empresa.id },
    orderBy: { createdAt: "desc" },
  })
  if (!q) return NextResponse.json(productos)
  const coincide = (p: (typeof productos)[number]) => {
    const ficha = p.ficha && typeof p.ficha === "object" ? p.ficha as Record<string, unknown> : {}
    return [p.codigo, p.nombre, ficha.codigoAuxiliar, ficha.codigoBarras, ficha.codigo_barras, ficha.sku, ficha.nombre]
      .some((c) => String(c || "").trim().toLowerCase().includes(q))
  }
  return NextResponse.json(productos.filter(coincide))
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const lista = Array.isArray(body?.productos) ? body.productos : [body]
  if (!lista.length) return NextResponse.json({ error: "No hay productos para guardar" }, { status: 400 })
  try {
    const guardados = []
    for (const item of lista) guardados.push(await guardarUno(sesion.empresa.id, item))
    return NextResponse.json({ ok: true, guardados: guardados.length, productos: guardados })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "No se pudo guardar" }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const id = new URL(req.url).searchParams.get("id") || ""
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 })
  const fila = await prisma.producto.findFirst({ where: { id, empresaId: sesion.empresa.id } })
  if (!fila) return NextResponse.json({ error: "Ese producto no es de tu empresa" }, { status: 404 })
  await prisma.producto.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
