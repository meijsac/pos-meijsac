import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

export const dynamic = "force-dynamic"

function lista(valor: unknown, tope: number) {
  return Array.isArray(valor) ? valor.slice(0, tope) : []
}

function conservarCodigoMesa(anteriores: unknown, nuevas: unknown[]) {
  const previos = Array.isArray(anteriores) ? anteriores : []
  const mapa = new Map<string, string>()
  for (const mesa of previos) {
    if (!mesa || typeof mesa !== "object") continue
    const codigo = (mesa as { codigo?: unknown }).codigo
    if (typeof codigo === "string" && codigo) mapa.set(String((mesa as { id?: unknown }).id), codigo)
  }
  return nuevas.map((mesa) => {
    if (!mesa || typeof mesa !== "object") return mesa
    const fila = mesa as { id?: unknown; codigo?: unknown }
    if (typeof fila.codigo === "string" && fila.codigo) return mesa
    const codigo = mapa.get(String(fila.id))
    return codigo ? { ...fila, codigo } : mesa
  })
}

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const estado = await prisma.restauranteEstado.findUnique({ where: { empresaId: sesion.empresa.id } })
  return NextResponse.json({
    mesas: lista(estado?.mesas, 200),
    tickets: lista(estado?.tickets, 500),
    menu: lista(estado?.menu, 500),
    categorias: lista(estado?.categorias, 80),
    updatedAt: estado?.updatedAt?.toISOString() || "",
  })
}

export async function PUT(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const actual = await prisma.restauranteEstado.findUnique({ where: { empresaId: sesion.empresa.id } })
  const data = {
    mesas: body.mesas === undefined ? lista(actual?.mesas, 200) : conservarCodigoMesa(actual?.mesas, lista(body.mesas, 200)),
    tickets: body.tickets === undefined ? lista(actual?.tickets, 500) : lista(body.tickets, 500),
    menu: body.menu === undefined ? lista(actual?.menu, 500) : lista(body.menu, 500),
    categorias: body.categorias === undefined ? lista(actual?.categorias, 80) : lista(body.categorias, 80),
  }
  const estado = await prisma.restauranteEstado.upsert({
    where: { empresaId: sesion.empresa.id },
    update: data,
    create: { empresaId: sesion.empresa.id, ...data },
  })
  return NextResponse.json({ ok: true, updatedAt: estado.updatedAt.toISOString() })
}
