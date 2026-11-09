import { NextResponse } from "next/server"
import { cookiesCerradas } from "@/lib/empresa-sesion"
import { cerrarSesion } from "@/lib/login-memoria"
import jwt from "jsonwebtoken"
import { secretoJwt } from "@/lib/empresa-sesion"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const raw = req.headers.get("cookie") || ""
  const parte = raw.split(";").map((s) => s.trim()).find((s) => s.startsWith("meijsac_sesion="))
  const token = parte ? decodeURIComponent(parte.slice("meijsac_sesion=".length)) : ""
  try {
    const payload = jwt.verify(token, secretoJwt()) as { sid?: string }
    if (payload.sid) {
      cerrarSesion(payload.sid)
      await prisma.sesionUsuario.update({ where: { id: payload.sid }, data: { revocada: true } }).catch(() => {})
    }
  } catch { /* la cookie ya no sirve */ }
  const res = NextResponse.json({ ok: true })
  cookiesCerradas().forEach((c) => res.headers.append("Set-Cookie", c))
  return res
}
