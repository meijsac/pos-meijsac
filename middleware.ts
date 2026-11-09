import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const visitas = new Map<string, number[]>()

function proteger(res: NextResponse, permitirMarco = false) {
  res.headers.set("X-Frame-Options", permitirMarco ? "SAMEORIGIN" : "DENY")
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  const ancestros = permitirMarco ? "frame-ancestors 'self'; " : "frame-ancestors 'none'; "
  res.headers.set("Content-Security-Policy", `default-src 'self'; ${ancestros}script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; child-src 'self' https://challenges.cloudflare.com; worker-src blob: https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; img-src 'self' data: blob: https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://challenges.cloudflare.com`)
  return res
}

export function middleware(req: NextRequest) {
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
  const comprobante = req.nextUrl.pathname.startsWith("/dashboard/factura-xml/pdf")
  return proteger(NextResponse.next(), comprobante)
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] }
