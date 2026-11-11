import { NextResponse } from "next/server"
import { Receiver } from "@upstash/qstash"
import { reenviarClaveSri } from "@/lib/sri/reenviar-pendiente"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY || ""
  const next = process.env.QSTASH_NEXT_SIGNING_KEY || ""
  if (!current || !next) return NextResponse.json({ error: "Cola no configurada" }, { status: 503 })
  const firma = req.headers.get("upstash-signature") || ""
  const cuerpo = await req.text()
  const receptor = new Receiver({ currentSigningKey: current, nextSigningKey: next })
  const valida = await receptor.verify({ signature: firma, body: cuerpo }).catch(() => false)
  if (!valida) return NextResponse.json({ error: "Firma de cola inválida" }, { status: 401 })
  const body = JSON.parse(cuerpo) as { empresaId?: string; claveAcceso?: string }
  const resultado = await reenviarClaveSri(String(body.empresaId || ""), String(body.claveAcceso || ""))
  return NextResponse.json(resultado.ok ? resultado.datos : { error: resultado.error }, { status: resultado.status })
}
