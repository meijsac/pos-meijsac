"use client"
import { useEffect } from "react"

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  useEffect(() => {
    const clave = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""
    if (!clave) return
    const script = document.createElement("script")
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"
    script.async = true
    script.onload = () => {
      const api = (window as unknown as { turnstile?: { render: (sel: string, opt: object) => void } }).turnstile
      api?.render("#meijsac-turnstile", { sitekey: clave, callback: onToken })
    }
    document.body.appendChild(script)
    return () => { script.remove() }
  }, [onToken])
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    return <p className="text-[10px] text-red-300">Falta la clave pública de Turnstile. Sin captcha no se puede entrar.</p>
  }
  return <div id="meijsac-turnstile" className="mt-3 min-h-[65px]" />
}
