import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

const METODOS = ["PROMEDIO", "PEPS", "UEPS"]

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const config = await prisma.inventarioConfig.findUnique({ where: { empresaId: sesion.empresa.id } })
  return NextResponse.json({ metodoCosteo: config?.metodoCosteo || "PROMEDIO" })
}

export async function PUT(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const metodo = String(body.metodoCosteo || "").toUpperCase()
  if (!METODOS.includes(metodo)) return NextResponse.json({ error: "Método de costeo inválido" }, { status: 400 })
  const config = await prisma.inventarioConfig.upsert({
    where: { empresaId: sesion.empresa.id },
    update: { metodoCosteo: metodo },
    create: { empresaId: sesion.empresa.id, metodoCosteo: metodo },
  })
  return NextResponse.json({ metodoCosteo: config.metodoCosteo })
}
