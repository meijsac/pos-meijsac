import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { asegurarPunto } from "@/lib/pos/puntos"
import { permisosNormales } from "@/lib/permisos-pos"

export const dynamic = "force-dynamic"

function rolDe(valor: unknown) {
  const rol = String(valor || "").toUpperCase()
  if (rol.startsWith("ADMIN")) return "ADMIN"
  if (rol.startsWith("CONT")) return "CONTADOR"
  if (rol.startsWith("BOD")) return "BODEGUERO"
  if (rol.startsWith("VEND")) return "VENDEDOR"
  return "CAJERO"
}

function tres(valor: unknown) {
  const n = String(valor || "").replace(/\D/g, "")
  return n ? n.padStart(3, "0").slice(-3) : "001"
}

function vista(usuario: { id: string; nombre: string; email: string | null; rol: string; establecimientoCodigo: string | null; puntoEmisionCodigo: string | null; permisos?: unknown }) {
  const rol = usuario.rol === "CAJERO" ? "Cajero" : usuario.rol === "CONTADOR" ? "Contador" : usuario.rol === "BODEGUERO" ? "Bodeguero" : usuario.rol === "VENDEDOR" ? "Vendedor" : "Administrador"
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email || "",
    rol,
    establecimiento: usuario.establecimientoCodigo || "001",
    puntoEmision: usuario.puntoEmisionCodigo || "001",
    permisos: permisosNormales(usuario.permisos),
    activo: true,
    password: "",
  }
}

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const usuarios = await prisma.usuario.findMany({
    where: { empresaId: sesion.empresa.id, rol: { not: "ADMIN" } },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json({ usuarios: usuarios.map(vista) })
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (sesion.usuario.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador guarda el equipo" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  if (!Array.isArray(body.usuarios)) return NextResponse.json({ ok: true, usuarios: [] })
  const empresaId = sesion.empresa.id
  const conservados: string[] = []
  for (const fila of body.usuarios) {
    const nombre = String(fila?.nombre || "").trim().slice(0, 80)
    const email = String(fila?.email || "").trim().toLowerCase().slice(0, 120)
    const rol = rolDe(fila?.rol)
    if (rol === "ADMIN" || !nombre) continue
    const establecimiento = tres(fila?.establecimiento)
    const puntoEmision = tres(fila?.puntoEmision)
    const clave = String(fila?.password || "")
    const id = String(fila?.id || "")
    const propio = id
      ? await prisma.usuario.findFirst({ where: { id, empresaId } })
      : null
    const porCorreo = !propio && email
      ? await prisma.usuario.findFirst({ where: { empresaId, email: { equals: email, mode: "insensitive" } } })
      : null
    const actual = propio || porCorreo
    if (actual?.rol === "ADMIN") continue
    const password = clave ? await bcrypt.hash(clave, 10) : actual?.password || ""
    if (!password) continue
    const datos = { nombre, email: email || null, rol, establecimientoCodigo: establecimiento, puntoEmisionCodigo: puntoEmision, permisos: permisosNormales(fila?.permisos) }
    const guardado = actual
      ? await prisma.usuario.update({ where: { id: actual.id }, data: clave ? { ...datos, password } : datos })
      : await prisma.usuario.create({ data: { ...datos, password, empresaId } })
    if (guardado.empresaId !== empresaId) continue
    conservados.push(guardado.id)
    await asegurarPunto(empresaId, establecimiento, puntoEmision).catch(() => null)
  }
  if (conservados.length || body.usuarios.length === 0) {
    await prisma.usuario.deleteMany({
      where: { empresaId, rol: { in: ["CAJERO", "VENDEDOR", "CONTADOR", "BODEGUERO"] }, id: { notIn: conservados } },
    })
  }
  const usuarios = await prisma.usuario.findMany({
    where: { empresaId, rol: { not: "ADMIN" } },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json({ ok: true, usuarios: usuarios.map(vista) })
}
