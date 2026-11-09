import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { desencriptar, encriptar } from "@/lib/seguridad"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const firma = await prisma.firmaElectronica.findUnique({ where: { empresaId: sesion.empresa.id } })
  if (!firma?.claveCifrada) return NextResponse.json({ clave: "", guardada: false })
  try {
    return NextResponse.json({ clave: desencriptar(firma.claveCifrada), guardada: true })
  } catch {
    return NextResponse.json({ clave: "", guardada: false })
  }
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const clave = String(body?.clave || "")
  if (!clave) return NextResponse.json({ error: "Escribe la contraseña del .p12" }, { status: 400 })
  const firma = await prisma.firmaElectronica.findUnique({ where: { empresaId: sesion.empresa.id } })
  if (!firma) return NextResponse.json({ error: "Primero sube el archivo .p12" }, { status: 400 })
  await prisma.firmaElectronica.update({
    where: { empresaId: sesion.empresa.id },
    data: { claveCifrada: encriptar(clave) },
  })
  return NextResponse.json({ ok: true, guardada: true })
}
