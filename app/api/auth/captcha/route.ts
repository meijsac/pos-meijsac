import { NextResponse } from "next/server"
import { crearCaptcha } from "@/lib/seguridad"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(crearCaptcha())
  } catch {
    return NextResponse.json({ error: "No se pudo preparar el captcha" }, { status: 500 })
  }
}
