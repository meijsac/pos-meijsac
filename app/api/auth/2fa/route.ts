import { NextResponse } from "next/server"

export async function POST() {
  if (process.env.DOBLE_FACTOR !== "1") {
    return NextResponse.json({ error: "El ingreso ya no usa código de Authenticator" }, { status: 410 })
  }
  return NextResponse.json({ activo: true })
}
