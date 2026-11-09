import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

const TIPOS = ["Firma Electrónica", "Permiso Bomberos", "Patente Municipal", "Permiso de Funcionamiento", "RUC", "LUAE", "Otro"]

function fecha(valor: unknown) {
  const d = new Date(String(valor || ""))
  return Number.isNaN(d.getTime()) ? null : d
}

function fila(d: { id: string; tipo: string; nombre: string; fechaEmision: Date; fechaCaducidad: Date; archivoUrl: string | null }) {
  return {
    id: d.id,
    tipo: d.tipo,
    nombre: d.nombre,
    fecha_emision: d.fechaEmision.toISOString().slice(0, 10),
    fecha_caducidad: d.fechaCaducidad.toISOString().slice(0, 10),
    archivo_url: d.archivoUrl || "",
  }
}

function leer(body: any) {
  const tipoBase = String(body?.tipo || "").trim()
  const otro = String(body?.tipoOtro || "").trim()
  const tipo = tipoBase === "Otro" ? otro : tipoBase
  const nombre = String(body?.nombre || "").trim()
  const emision = fecha(body?.fecha_emision)
  const caducidad = fecha(body?.fecha_caducidad)
  const archivo = String(body?.archivo_url || "")
  if (!TIPOS.includes(tipoBase)) return { error: "Elige el tipo de documento" }
  if (tipoBase === "Otro" && !otro) return { error: "Escribe el tipo de documento" }
  if (!nombre) return { error: "Escribe el nombre del documento" }
  if (!emision || !caducidad) return { error: "Indica la fecha de emisión y la de caducidad" }
  if (archivo && !archivo.startsWith("data:") && !archivo.startsWith("http")) return { error: "El archivo no es válido" }
  if (archivo.length > 2_800_000) return { error: "El archivo es muy grande. El máximo es 2 MB." }
  return { data: { tipo, nombre, fechaEmision: emision, fechaCaducidad: caducidad, archivoUrl: archivo || null } }
}

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const docs = await prisma.documentoLegal.findMany({ where: { empresaId: sesion.empresa.id }, orderBy: { fechaCaducidad: "asc" } })
  return NextResponse.json(docs.map(fila))
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const parsed = leer(await req.json().catch(() => ({})))
  if ("error" in parsed && parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const doc = await prisma.documentoLegal.create({ data: { ...parsed.data!, empresaId: sesion.empresa.id } })
  return NextResponse.json(fila(doc))
}

export async function PATCH(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const id = String(body?.id || "")
  const existe = await prisma.documentoLegal.findFirst({ where: { id, empresaId: sesion.empresa.id } })
  if (!existe) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 })
  const parsed = leer(body)
  if ("error" in parsed && parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const doc = await prisma.documentoLegal.update({ where: { id }, data: parsed.data! })
  return NextResponse.json(fila(doc))
}

export async function DELETE(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const id = new URL(req.url).searchParams.get("id") || ""
  const existe = await prisma.documentoLegal.findFirst({ where: { id, empresaId: sesion.empresa.id } })
  if (!existe) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 })
  await prisma.documentoLegal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
