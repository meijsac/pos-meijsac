import { NextResponse } from "next/server"
import { empresaPorRuc, resumenEmpresa } from "@/lib/empresa-plan"

export async function GET(req: Request) {
  const ruc = new URL(req.url).searchParams.get("ruc")?.trim() || ""
  if (!ruc) return NextResponse.json({ error: "Falta el RUC" }, { status: 400 })
  const empresa = await empresaPorRuc(ruc)
  if (!empresa) return NextResponse.json({ error: "Empresa no registrada" }, { status: 404 })
  return NextResponse.json(resumenEmpresa(empresa))
}
