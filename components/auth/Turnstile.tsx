"use client"

import Script from "next/script"
import { useEffect, useRef, useState } from "react"

type TurnstileApi = {
  render: (el: HTMLElement, opt: Record<string, unknown>) => string
  reset: (id?: string) => void
}

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""
  const caja = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const avisar = useRef(onToken)
  const [scriptListo, setScriptListo] = useState(false)
  const [falloScript, setFalloScript] = useState("")
  avisar.current = onToken

  useEffect(() => {
    console.log("TURNSTILE_SITE_KEY", sitekey || "(vacía)")
  }, [sitekey])

  useEffect(() => {
    const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile
    if (!scriptListo || !sitekey || !caja.current || !api || widget.current) return
    widget.current = api.render(caja.current, {
      sitekey,
      theme: "light",
      size: "normal",
      appearance: "always",
      callback: (token: string) => avisar.current(token),
      "error-callback": () => {
        avisar.current("")
        if (widget.current) api.reset(widget.current)
      },
      "expired-callback": () => {
        avisar.current("")
        if (widget.current) api.reset(widget.current)
      },
    })
  }, [scriptListo, sitekey])

  return (
    <div className="mt-3">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptListo(true)}
        onError={() => setFalloScript("No cargó el script de Cloudflare Turnstile")}
      />
      <div ref={caja} className="min-h-[70px] flex justify-center bg-white rounded-xl" />
      {!sitekey && (
        <p className="mt-2 text-sm font-black text-red-400">FALTA SITE KEY EN VERCEL</p>
      )}
      {falloScript && <p className="mt-2 text-sm font-bold text-red-400">{falloScript}</p>}
    </div>
  )
}
