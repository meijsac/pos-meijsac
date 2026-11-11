import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { cookiesSesion, empresaParaCliente, firmarSesion } from "@/lib/empresa-sesion"
import { abrirSesion, anotarIntento, leerIntentos } from "@/lib/login-memoria"
import { evaluarBloqueo, ipDe, navegadorDe, totpValido, hashCodigo, desencriptar } from "@/lib/seguridad"

function responder(body: unknown, status: number, cookies: string[] = []) {
  const res = NextResponse.json(body, { status })
  cookies.forEach((c) => res.headers.append("Set-Cookie", c))
  return res
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const ruc = String(body.ruc || "").trim()
    const password = String(body.password || "")
    const canal = body.canal === "POS" ? "POS" : "LOGIN"
    const ip = ipDe(req)
    const ua = navegadorDe(req)
    const ahora = Date.now()
    const bloqueo = evaluarBloqueo(leerIntentos(), ruc, ip, ahora, canal)
    const fallosGuardados = canal === "LOGIN"
      ? await prisma.loginIntento.count({ where: { ip, exitoso: false, canal: "LOGIN", fecha: { gte: new Date(ahora - 15 * 60 * 1000) } } }).catch(() => 0)
      : 0
    if (bloqueo.bloqueado || fallosGuardados >= 5) {
      prisma.seguridadLog.create({ data: { ip, usuario: ruc.slice(0, 80), accion: "LOGIN_BLOQUEADO", dispositivo: ua, detalle: "5 fallos en 15 minutos" } }).catch(() => {})
      return responder({ error: bloqueo.mensaje || "Demasiados intentos. Intenta en 15 minutos." }, 429)
    }
    if (!ruc || !password) return responder({ error: "Falta RUC o clave" }, 400)

    const usuarios = await prisma.usuario.findMany({ where: { empresa: { ruc } }, include: { empresa: true } })
    let usuario = null as (typeof usuarios)[number] | null
    for (const candidato of usuarios) {
      if (await bcrypt.compare(password, candidato.password)) usuario = candidato
    }
    if (!usuario?.empresa || !usuario.empresaId) {
      anotarIntento({ correo: ruc, ip, fecha: ahora, exitoso: false, canal })
      prisma.loginIntento.create({ data: { correo: ruc, ip, exitoso: false, canal } }).catch(() => {})
      const fallos = leerIntentos().filter((i) => i.correo === ruc && i.canal === canal && !i.exitoso).length
      await new Promise((r) => setTimeout(r, fallos * 1000))
      return responder({ error: "Clave incorrecta" }, 401)
    }

    const seguridad = await prisma.usuarioSeguridad.findUnique({ where: { usuarioId: usuario.id } }).catch(() => null)
    if (seguridad?.dosFaActivo) {
      const codigo = String(body.codigo2fa || "")
      let secreto = Buffer.alloc(0)
      try {
        if (seguridad.totpCifrado) secreto = Buffer.from(desencriptar(seguridad.totpCifrado), "base64")
      } catch {
        return responder({ requiere2fa: true, error: "Vuelve a activar el segundo factor en Configuración" }, 401)
      }
      const respaldo = seguridad.respaldos.split(",").filter(Boolean).includes(hashCodigo(codigo))
      if (!totpValido(secreto, codigo) && !respaldo) {
        return responder({ requiere2fa: true, error: "Ingresa el código de 6 dígitos" }, 401)
      }
    }

    anotarIntento({ correo: ruc, ip, fecha: ahora, exitoso: true, canal })
    prisma.loginIntento.create({ data: { correo: ruc, ip, exitoso: true, canal } }).catch(() => {})
    prisma.seguridadLog.create({ data: { empresaId: usuario.empresaId, usuario: usuario.nombre, ip, accion: "LOGIN_OK", dispositivo: ua, detalle: canal } }).catch(() => {})
    const sid = randomBytes(16).toString("hex")
    abrirSesion(sid)
    const acceso = firmarSesion({ id: usuario.id, empresaId: usuario.empresaId, sid, ip, ua })
    const refresh = firmarSesion({ id: usuario.id, empresaId: usuario.empresaId, sid, ip, ua })
    const expira = new Date(Date.now() + 60 * 60 * 1000)
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
    }, 200, cookiesSesion(acceso, refresh))
  } catch (e: unknown) {
    const mensaje = e instanceof Error ? e.message : "No se pudo entrar"
    return responder({ error: mensaje === "JWT_SECRET no configurado" ? mensaje : "No se pudo entrar" }, 500)
  }
}
