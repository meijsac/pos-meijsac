import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { puede } from "@/lib/seguridad"
import { asegurarCatalogos, refrescarTarifas } from "@/lib/sri/catalogos"

export const dynamic = "force-dynamic"

function nombreDe(sesion: { usuario: { nombre?: string | null; email?: string | null; id: string } }) {
  return String(sesion.usuario.nombre || sesion.usuario.email || sesion.usuario.id)
}

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: "No hay sesión" }, { status: 401 })
  try {
    await asegurarCatalogos()
    const [filas, cambios] = await Promise.all([
      prisma.catalogoSri.findMany({ orderBy: [{ grupo: "asc" }, { codigo: "asc" }] }),
      prisma.catalogoSriCambio.findMany({ orderBy: { fecha: "desc" }, take: 40 }),
    ])
    return NextResponse.json({ filas, cambios })
  } catch {
    return NextResponse.json({ error: "No pude leer los catálogos" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: "No hay sesión" }, { status: 401 })
  if (!puede(sesion.usuario.rol, "facturar")) return NextResponse.json({ error: "Tu rol no puede cambiar catálogos" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const grupo = String(body.grupo || "")
  const codigo = String(body.codigo || "").trim()
  const descripcion = String(body.descripcion || "").trim().slice(0, 180)
  const porcentaje = Number(body.porcentaje)
  if (!["IVA", "RETENCION_RENTA", "RETENCION_IVA"].includes(grupo) || !codigo || !descripcion || !Number.isFinite(porcentaje)) {
    return NextResponse.json({ error: "Completa grupo, código, descripción y porcentaje" }, { status: 400 })
  }
  const usuario = nombreDe(sesion)
  const previo = await prisma.catalogoSri.findUnique({ where: { grupo_codigo: { grupo, codigo } } })
  const fila = await prisma.catalogoSri.upsert({
    where: { grupo_codigo: { grupo, codigo } },
    create: { grupo, codigo, descripcion, porcentaje, vigente: body.vigente !== false, actualizadoPor: usuario },
    update: { descripcion, porcentaje, vigente: body.vigente !== false, actualizadoPor: usuario },
  })
  await prisma.catalogoSriCambio.create({
    data: {
      grupo,
      codigo,
      usuario,
      antes: previo ? `${previo.descripcion} ${previo.porcentaje}%` : "",
      despues: `${descripcion} ${porcentaje}%`,
    },
  })
  await refrescarTarifas()
  return NextResponse.json({ ok: true, fila })
}

export async function PUT(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: "No hay sesión" }, { status: 401 })
  if (!puede(sesion.usuario.rol, "facturar")) return NextResponse.json({ error: "Tu rol no puede cambiar catálogos" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || "")
  const actual = await prisma.catalogoSri.findUnique({ where: { id } })
  if (!actual) return NextResponse.json({ error: "Ese código no está en el catálogo" }, { status: 404 })
  const descripcion = String(body.descripcion ?? actual.descripcion).trim().slice(0, 180)
  const porcentaje = Number(body.porcentaje)
  const vigente = body.vigente !== false
  if (!descripcion || !Number.isFinite(porcentaje)) return NextResponse.json({ error: "Revisa la descripción y el porcentaje" }, { status: 400 })
  const usuario = nombreDe(sesion)
  const fila = await prisma.catalogoSri.update({
    where: { id },
    data: { descripcion, porcentaje, vigente, actualizadoPor: usuario },
  })
  await prisma.catalogoSriCambio.create({
    data: {
      grupo: actual.grupo,
      codigo: actual.codigo,
      usuario,
      antes: `${actual.descripcion} ${actual.porcentaje}%`,
      despues: `${descripcion} ${porcentaje}%${vigente ? "" : " (inactivo)"}`,
    },
  })
  await refrescarTarifas()
  return NextResponse.json({ ok: true, fila })
}
