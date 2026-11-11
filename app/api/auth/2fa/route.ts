import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ error: "El ingreso ya no usa código de Authenticator" }, { status: 410 })
}
