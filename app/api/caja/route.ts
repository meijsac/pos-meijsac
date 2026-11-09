import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { puedeAbrirCaja } from "@/lib/seguridad"
import { ipDe, navegadorDe } from "@/lib/seguridad"

async function captchaValido(token: string, ip: string) {
  if (!token || !process.env.TURNSTILE_SECRET_KEY) return false
  const cuerpo = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip })
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: cuerpo })
  const data = await res.json().catch(() => ({}))
  return data.success === true
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const ip = ipDe(req)
  if (!(await captchaValido(String(body.captcha || ""), ip))) return NextResponse.json({ error: "Resuelve el captcha para abrir la caja" }, { status: 401 })
  const password = String(body.password || "")
  if (!(await bcrypt.compare(password, sesion.usuario.password))) return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 })
  const dispositivo = String(body.dispositivo || navegadorDe(req))
  const abiertas = await prisma.cajaTurno.findMany({ where: { usuario: sesion.usuario.id, estado: "ABIERTA" } })
  const decision = puedeAbrirCaja(abiertas.map((a) => ({ usuario: a.usuario, dispositivo: a.dispositivo || "" })), sesion.usuario.id, dispositivo)
  if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: 409 })
  if (abiertas[0]) return NextResponse.json({ id: abiertas[0].id, estado: "ABIERTA" })
  const turno = await prisma.cajaTurno.create({
    data: {
      usuario: sesion.usuario.id,
      puntoEmision: String(body.puntoEmision || "001"),
      montoInicial: Number(body.montoInicial) || 0,
      dispositivo,
      estado: "ABIERTA",
    },
  })
  return NextResponse.json({ id: turno.id, estado: "ABIERTA" })
}

export async function PATCH(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  if (!(await bcrypt.compare(String(body.password || ""), sesion.usuario.password))) {
    return NextResponse.json({ error: "La contraseña del cajero no coincide" }, { status: 401 })
  }
  const turno = await prisma.cajaTurno.findFirst({ where: { usuario: sesion.usuario.id, estado: "ABIERTA" } })
  if (!turno) return NextResponse.json({ error: "No hay caja abierta" }, { status: 404 })
  const conteo = Number(body.conteo)
  const esperado = Number(body.esperado ?? turno.montoInicial)
  const diferencia = Math.round((conteo - esperado) * 100) / 100
  if (diferencia !== 0 && !(await bcrypt.compare(String(body.claveAdmin || ""), sesion.usuario.password) && sesion.usuario.rol === "ADMIN")) {
    const admin = await prisma.usuario.findFirst({ where: { empresaId: sesion.empresa.id, rol: "ADMIN" } })
    const aprobada = admin ? await bcrypt.compare(String(body.claveAdmin || ""), admin.password) : false
    if (!aprobada) return NextResponse.json({ error: "El conteo no cuadra", diferencia }, { status: 409 })
  }
  await prisma.cajaTurno.update({
    where: { id: turno.id },
    data: { estado: "CERRADA", fechaCierre: new Date(), montoFinal: conteo, montoCierreFisico: conteo, diferencia },
  })
  return NextResponse.json({ ok: true, diferencia })
}
