import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const ruc = String(body?.ruc || "").trim()
  const firmaExpira = new Date(body?.firmaExpira)
  if (!ruc) return NextResponse.json({ error: "Falta el RUC" }, { status: 400 })
  if (Number.isNaN(firmaExpira.getTime())) return NextResponse.json({ error: "La firma no trae fecha de vencimiento" }, { status: 400 })

  const empresa = await prisma.empresa.findUnique({ where: { ruc } })
  if (!empresa) return NextResponse.json({ error: "Esa empresa no está registrada" }, { status: 404 })

  const actualizada = await prisma.empresa.update({
    where: { ruc },
    data: { firmaExpira },
  })
  return NextResponse.json({ ok: true, firmaExpira: actualizada.firmaExpira })
}
