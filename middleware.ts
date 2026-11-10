import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const visitas = new Map<string, number[]>()

function proteger(res: NextResponse, permitirMarco = false) {
  res.headers.set("X-Frame-Options", permitirMarco ? "SAMEORIGIN" : "DENY")
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("Referrer-Policy", "no-referrer")
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  const ancestros = permitirMarco ? "frame-ancestors 'self'; " : "frame-ancestors 'none'; "
  res.headers.set("Content-Security-Policy", `default-src 'self'; ${ancestros}script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; child-src 'self' https://challenges.cloudflare.com; worker-src blob: https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; img-src 'self' data: blob: https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://challenges.cloudflare.com`)
  return res
}

function tokenSesion(req: NextRequest) {
  const crudo = req.cookies.get("meijsac_sesion")?.value || ""
  try { return decodeURIComponent(crudo) } catch { return crudo }
}

function bytes(texto: string) {
  const limpio = texto.replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(limpio + "=".repeat((4 - (limpio.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function sesionFirmada(token: string) {
  const partes = token.split(".")
  if (partes.length !== 3) return false
  const secreto = process.env.JWT_SECRET || ""
  if (!secreto || secreto === "MEIJSAC_SECRET_2026") return false
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["verify"])
    const ok = await crypto.subtle.verify("HMAC", key, bytes(partes[2]), new TextEncoder().encode(`${partes[0]}.${partes[1]}`))
    if (!ok) return false
    const dato = JSON.parse(new TextDecoder().decode(bytes(partes[1]))) as { exp?: number; id?: string; empresaId?: string }
    return Boolean(dato.id && dato.empresaId && dato.exp && dato.exp * 1000 > Date.now())
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get("x-forwarded-proto") || ""
  if (process.env.NODE_ENV === "production" && host === "http") {
    const destino = req.nextUrl.clone()
    destino.protocol = "https:"
    return proteger(NextResponse.redirect(destino))
  }
  if (req.nextUrl.pathname.startsWith("/api")) {
    const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim()
    const ahora = Date.now()
    const previas = (visitas.get(ip) || []).filter((t) => ahora - t < 60_000)
    previas.push(ahora)
    visitas.set(ip, previas)
    if (previas.length > 100) return proteger(NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 }))
  }
  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    if (!(await sesionFirmada(tokenSesion(req)))) {
      const destino = req.nextUrl.clone()
      destino.pathname = "/login"
      destino.search = ""
      return proteger(NextResponse.redirect(destino))
    }
  }
  const comprobante = req.nextUrl.pathname.startsWith("/dashboard/factura-xml/pdf")
  return proteger(NextResponse.next(), comprobante)
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] }
