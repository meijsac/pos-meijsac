import { NextResponse } from "next/server"
import { mesaPublica } from "@/lib/restaurante/mesa-publica"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, context: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await context.params
  const vista = await mesaPublica(codigo)
  if (!vista) return NextResponse.json({ error: "Mesa no disponible" }, { status: 404 })
  return NextResponse.json(vista, { headers: { "Cache-Control": "no-store" } })
}
