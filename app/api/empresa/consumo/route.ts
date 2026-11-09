import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { empresaPorRuc, resumenEmpresa } from "@/lib/empresa-plan"
import { evaluarSuscripcion } from "@/lib/suscripcion"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const ruc = String(body?.ruc || "").trim()
  const empresa = await empresaPorRuc(ruc)
  if (!empresa) return NextResponse.json({ error: "Empresa no registrada" }, { status: 404 })

  const antes = evaluarSuscripcion(empresa)
  if (antes.estado === "BLOQUEADO") {
    return NextResponse.json({ error: antes.mensaje, ...resumenEmpresa(empresa) }, { status: 403 })
  }

  const actualizada = await prisma.empresa.update({
    where: { id: empresa.id },
    data: { comprobantesUsados: { increment: 1 } },
    include: { plan: true },
  })
  return NextResponse.json(resumenEmpresa(actualizada))
}
