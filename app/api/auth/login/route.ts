import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { cookiesSesion, empresaParaCliente, firmarSesion, segundosDeSesion } from "@/lib/empresa-sesion"
import { abrirSesion } from "@/lib/login-memoria"
import { ipDe, navegadorDe } from "@/lib/seguridad"

const MENSAJE = "Credenciales inválidas"
const VENTANA_MS = 5 * 60 * 1000

function responder(body: unknown, status: number, cookies: string[] = []) {
  const res = NextResponse.json(body, { status })
  cookies.forEach((c) => res.headers.append("Set-Cookie", c))
  return res
}

async function turnstileValido(token: string, ip: string) {
  const secreto = process.env.TURNSTILE_SECRET_KEY || ""
  if (!secreto || !token) return false
  const cuerpo = new URLSearchParams({ secret: secreto, response: token, remoteip: ip })
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: cuerpo })
  const data = await res.json().catch(() => ({}))
  return data.success === true
}

async function limpiarIntentos(ip: string, ruc: string) {
  await prisma.loginIntento.deleteMany({ where: { ip, correo: ruc, exitoso: false } }).catch(() => {})
  const url = process.env.UPSTASH_REDIS_REST_URL || ""
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || ""
  if (!url || !token) return
  const { Redis } = await import("@upstash/redis")
  const redis = new Redis({ url, token })
  await redis.del(`intentos:${ip}:${ruc}`).catch(() => {})
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    if (String(body.empresa_web || "").trim()) return responder({ error: MENSAJE }, 401)
    const canal = body.canal === "POS" ? "POS" : "LOGIN"
    const ruc = String(body.ruc || "").trim()
    const usuarioCaja = String(body.usuario || "").trim()
    const password = String(body.password || "")
    const ip = ipDe(req)
    const ua = navegadorDe(req)
    const ahora = Date.now()
    const identificador = canal === "POS" ? usuarioCaja : ruc
    if (canal === "POS") {
      if (!usuarioCaja || !password) return responder({ error: "Ingresa usuario y contraseña" }, 400)
    } else if (!ruc || !password || ruc.length !== 13) {
      return responder({ error: "Ingresa RUC y contraseña" }, 400)
    }

    const marca = identificador.slice(0, 80)
    const bloqueo = await prisma.seguridadLog.findFirst({
      where: { accion: "LOGIN_BLOQUEO", ip, usuario: marca, fecha: { gte: new Date(ahora - 60 * 60 * 1000) } },
      orderBy: { fecha: "desc" },
    }).catch(() => null)
    if (bloqueo) {
      const minutos = bloqueo.detalle === "15" ? 15 : 2
      const hasta = new Date(bloqueo.fecha).getTime() + minutos * 60 * 1000
      if (hasta > ahora) {
        return responder({ error: `Demasiados intentos. Espera ${minutos} minutos.` }, 429)
      }
    }

    const fallos = await prisma.loginIntento.count({
      where: { ip, correo: identificador, canal, exitoso: false, fecha: { gte: new Date(ahora - VENTANA_MS) } },
    }).catch(() => 0)
    if (fallos >= 5) {
      const previo = await prisma.seguridadLog.count({
        where: { accion: "LOGIN_BLOQUEO", ip, usuario: marca, fecha: { gte: new Date(ahora - 60 * 60 * 1000) } },
      }).catch(() => 0)
      const minutos = previo > 0 ? "15" : "2"
      prisma.seguridadLog.create({ data: { ip, usuario: marca, accion: "LOGIN_BLOQUEO", dispositivo: ua, detalle: minutos } }).catch(() => {})
      return responder({ error: `Demasiados intentos. Espera ${minutos} minutos.` }, 429)
    }

    if (fallos >= 3 && !(await turnstileValido(String(body.captcha || ""), ip))) {
      return responder({ error: "Resuelve el captcha para entrar", requiereCaptcha: true }, 401)
    }

    const usuarios = canal === "POS"
      ? await prisma.usuario.findMany({
          where: {
            OR: [
              { nombre: { equals: usuarioCaja, mode: "insensitive" } },
              { email: { equals: usuarioCaja, mode: "insensitive" } },
            ],
          },
          include: { empresa: true },
        })
      : await prisma.usuario.findMany({ where: { empresa: { ruc } }, include: { empresa: true } })
    const rolesCaja = new Set(["CAJERO", "VENDEDOR"])
    let usuario = null as (typeof usuarios)[number] | null
    for (const candidato of usuarios) {
      if (canal === "POS" && !rolesCaja.has(String(candidato.rol || "").toUpperCase())) continue
      if (await bcrypt.compare(password, candidato.password)) usuario = candidato
    }
    if (!usuario?.empresa || !usuario.empresaId) {
      prisma.loginIntento.create({ data: { correo: identificador, ip, exitoso: false, canal } }).catch(() => {})
      prisma.seguridadLog.create({ data: { ip, usuario: marca, accion: "LOGIN_FALLO", dispositivo: ua, detalle: "CREDENCIALES" } }).catch(() => {})
      const url = process.env.UPSTASH_REDIS_REST_URL || ""
      const token = process.env.UPSTASH_REDIS_REST_TOKEN || ""
      if (url && token) {
        const { Redis } = await import("@upstash/redis")
        const redis = new Redis({ url, token })
        await redis.incr(`intentos:${ip}:${identificador}`).catch(() => {})
      }
      return responder({ error: MENSAJE, requiereCaptcha: fallos + 1 >= 3 }, 401)
    }

    await limpiarIntentos(ip, identificador)
    prisma.seguridadLog.create({ data: { empresaId: usuario.empresaId, usuario: usuario.nombre, ip, accion: "LOGIN_OK", dispositivo: ua, detalle: ruc } }).catch(() => {})
    const sid = randomBytes(16).toString("hex")
    abrirSesion(sid)
    const segundos = segundosDeSesion(body.recordarme === true)
    const acceso = firmarSesion({ id: usuario.id, empresaId: usuario.empresaId, sid, ip, ua }, segundos)
    const refresh = firmarSesion({ id: usuario.id, empresaId: usuario.empresaId, sid, ip, ua }, segundos)
    const expira = new Date(Date.now() + segundos * 1000)
    try {
      await prisma.sesionUsuario.upsert({
        where: { id: sid },
        create: { id: sid, usuarioId: usuario.id, expira, ip, navegador: ua },
        update: { revocada: false, expira, ip, navegador: ua },
      })
    } catch { /* la cookie firmada igual entra; la siguiente visita recompone la fila */ }
    const empresa = empresaParaCliente(usuario.empresa, usuario)
    return responder({
      usuario: { nombre: usuario.nombre, empresa: empresa.razonSocial, rol: usuario.rol, ruc: empresa.ruc, empresaId: usuario.empresaId },
      empresa,
      destino: canal === "POS" ? "/dashboard/factura-xml" : "/dashboard",
    }, 200, cookiesSesion(acceso, refresh, segundos))
  } catch (e: unknown) {
    const mensaje = e instanceof Error ? e.message : "No se pudo entrar"
    return responder({ error: mensaje === "JWT_SECRET no configurado" ? mensaje : "No se pudo entrar" }, 500)
  }
}
