import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { error: "La fecha de la firma se lee del certificado al subir el .p12" },
    { status: 405 }
  )
}
