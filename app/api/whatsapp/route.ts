import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const logs = await prisma.seguridadLog.findMany({
    where: { empresaId: sesion.empresa.id, accion: { in: ["WHATSAPP_ENVIO", "WHATSAPP_CONECTADO", "WHATSAPP_DESCONECTADO"] } },
    orderBy: { fecha: "desc" },
    take: 50,
  })
  const conexion = logs.find((l) => l.accion === "WHATSAPP_CONECTADO")
  return NextResponse.json({
    numero: conexion?.detalle || "",
    conectadoEn: conexion?.fecha.toISOString() || "",
    ultima: logs[0]?.fecha.toISOString() || "",
    dispositivo: conexion?.dispositivo || "",
    historial: logs.map((l) => ({ id: l.id, fecha: l.fecha.toISOString(), usuario: l.usuario, numero: l.detalle, detalle: l.accion })),
  })
}

export async function DELETE(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (sesion.usuario.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador desconecta WhatsApp" }, { status: 403 })
  await prisma.seguridadLog.create({
    data: { empresaId: sesion.empresa.id, usuario: sesion.usuario.nombre, accion: "WHATSAPP_DESCONECTADO", detalle: "token invalidado" },
  })
  return NextResponse.json({ numero: "", conectadoEn: "", ultima: "", dispositivo: "", historial: [] })
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (sesion.usuario.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador conecta WhatsApp" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  if (!/^\d{6}$/.test(String(body.otp || ""))) return NextResponse.json({ error: "Verifica el número con el código de 6 dígitos" }, { status: 401 })
  await prisma.seguridadLog.create({
    data: { empresaId: sesion.empresa.id, usuario: sesion.usuario.nombre, accion: "WHATSAPP_CONECTADO", detalle: String(body.numero || ""), dispositivo: String(body.dispositivo || "") },
  })
  return NextResponse.json({ ok: true })
}
