import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

export const maxDuration = 60
const LOTE_MAX = 500

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
    const conId: { id: string; data: ReturnType<typeof datos> }[] = []
    const errores: string[] = []
    for (const item of lista) {
      try {
        const data = datos(item)
        const id = String(item?.id || "").trim()
        if (id) conId.push({ id, data })
        else porCodigo.set(data.codigo, data)
      } catch (e: any) {
        errores.push(e?.message || "Fila inválida")
      }
    }
    if (!porCodigo.size && !conId.length) return NextResponse.json({ error: errores[0] || "No hay productos para guardar", errores }, { status: 400 })
    let guardados = 0
    for (const fila of conId) {
      const propio = await prisma.producto.updateMany({ where: { id: fila.id, empresaId: sesion.empresa.id }, data: fila.data })
      if (propio.count) guardados += 1
      else porCodigo.set(fila.data.codigo, fila.data)
    }
    const unicos = [...porCodigo.values()]
    if (unicos.length) {
      const values = unicos.map((d) => Prisma.sql`(
        ${crypto.randomUUID()},
        ${d.codigo},
        ${d.nombre},
        ${d.categoria},
        ${d.costo},
        ${d.precio},
        ${d.stock},
        ${d.stockMinimo},
        CAST(${JSON.stringify(d.ficha)} AS jsonb),
        ${sesion.empresa.id},
        NOW()
      )`)
      await prisma.$executeRaw`
        INSERT INTO "Producto" ("id", "codigo", "nombre", "categoria", "costo", "precio", "stock", "stockMinimo", "ficha", "empresaId", "createdAt")
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("codigo", "empresaId") DO UPDATE SET
          "nombre" = EXCLUDED."nombre",
          "categoria" = EXCLUDED."categoria",
          "costo" = EXCLUDED."costo",
          "precio" = EXCLUDED."precio",
          "stock" = EXCLUDED."stock",
          "stockMinimo" = EXCLUDED."stockMinimo",
          "ficha" = EXCLUDED."ficha"
      `
      guardados += unicos.length
    }
    return NextResponse.json({ ok: true, guardados, errores })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "No se pudo guardar" }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const url = new URL(req.url)
  if (url.searchParams.get("todos") === "1") {
    const r = await prisma.producto.deleteMany({ where: { empresaId: sesion.empresa.id } })
    return NextResponse.json({ ok: true, eliminados: r.count })
  }
  const body = await req.json().catch(() => ({}))
  const ids = Array.isArray(body?.ids) ? body.ids.map((id: unknown) => String(id || "").trim()).filter(Boolean) : []
  const id = url.searchParams.get("id") || ""
  const lista = ids.length ? ids : id ? [id] : []
  if (!lista.length) return NextResponse.json({ error: "Falta el id" }, { status: 400 })
  if (lista.length > 5000) return NextResponse.json({ error: "Elimina hasta 5000 productos por vez" }, { status: 400 })
  const r = await prisma.producto.deleteMany({ where: { empresaId: sesion.empresa.id, id: { in: lista } } })
  if (!r.count) return NextResponse.json({ error: "Ese producto no es de tu empresa" }, { status: 404 })
  return NextResponse.json({ ok: true, eliminados: r.count })
}
