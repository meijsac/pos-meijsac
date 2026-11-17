import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { veHistoriaClinica } from "@/lib/optica/acceso"

function texto(valor: unknown, tope: number) {
  return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, tope)
}

export async function PATCH(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!veHistoriaClinica(sesion.usuario)) return NextResponse.json({ error: "Esos datos los registra el optometrista" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const datos = {
    unicodigo: texto(body.unicodigo, 20),
    cedulaProfesional: texto(body.cedulaProfesional, 20),
    registroAcess: texto(body.registroAcess, 40),
    registroSenescyt: texto(body.registroSenescyt, 40),
  }
  const config = await prisma.opticaConfig.upsert({
    where: { empresaId: sesion.empresa.id },
    update: datos,
    create: { empresaId: sesion.empresa.id, ...datos },
  })
  return NextResponse.json({
    config: {
      unicodigo: config.unicodigo,
      cedulaProfesional: config.cedulaProfesional,
      registroAcess: config.registroAcess,
      registroSenescyt: config.registroSenescyt,
    },
  })
}
