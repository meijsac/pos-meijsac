import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

export const maxDuration = 60
const LOTE_MAX = 40

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

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const q = new URL(req.url).searchParams.get("q")?.trim() || ""
  if (!q) {
    const productos = await prisma.producto.findMany({
      where: { empresaId: sesion.empresa.id },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(productos)
  }
  try {
    const productos = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "Producto"
      WHERE "empresaId" = ${sesion.empresa.id}
        AND (
          COALESCE("codigo", '') ILIKE ${"%" + q + "%"}
          OR "nombre" ILIKE ${"%" + q + "%"}
          OR COALESCE("ficha"::text, '') ILIKE ${"%" + q + "%"}
        )
      ORDER BY "createdAt" DESC
      LIMIT 12
    `
    return NextResponse.json(productos)
  } catch {
    const productos = await prisma.producto.findMany({
      where: {
        empresaId: sesion.empresa.id,
        OR: [
          { codigo: { contains: q, mode: "insensitive" } },
          { nombre: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    })
    return NextResponse.json(productos)
  }
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const lista = Array.isArray(body?.productos) ? body.productos : [body]
  if (!lista.length) return NextResponse.json({ error: "No hay productos para guardar" }, { status: 400 })
  if (lista.length > LOTE_MAX) return NextResponse.json({ error: `Envía hasta ${LOTE_MAX} productos por vez` }, { status: 400 })
  try {
    const porCodigo = new Map<string, ReturnType<typeof datos>>()
    const errores: string[] = []
    for (const item of lista) {
      try {
        const data = datos(item)
        porCodigo.set(data.codigo, data)
      } catch (e: any) {
        errores.push(e?.message || "Fila inválida")
      }
    }
    const unicos = [...porCodigo.values()]
    if (!unicos.length) return NextResponse.json({ error: errores[0] || "No hay productos para guardar", errores }, { status: 400 })
    const ya = await prisma.producto.findMany({
      where: { empresaId: sesion.empresa.id, codigo: { in: unicos.map((d) => d.codigo) } },
      select: { id: true, codigo: true },
    })
    const ids = new Map(ya.map((p) => [p.codigo, p.id]))
    const nuevos = unicos.filter((d) => d.codigo && !ids.has(d.codigo)).map((d) => ({ ...d, empresaId: sesion.empresa.id }))
    if (nuevos.length) await prisma.producto.createMany({ data: nuevos })
    for (const data of unicos) {
      const id = ids.get(data.codigo)
      if (!id) continue
      await prisma.producto.update({ where: { id }, data })
    }
    return NextResponse.json({ ok: true, guardados: unicos.length, errores })
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
