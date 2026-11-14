"use client"

import { Turnstile as Widget, type TurnstileInstance } from "@marsidev/react-turnstile"
import Script from "next/script"
import { forwardRef, useImperativeHandle, useRef } from "react"

type Opciones = {
  theme?: "auto" | "light" | "dark"
  size?: "normal" | "compact" | "flexible" | "invisible"
  execution?: "render" | "execute"
  appearance?: "always" | "execute" | "interaction-only"
}

export type TurnstileHandle = {
  execute: () => void
  reset: () => void
}

export const Turnstile = forwardRef<TurnstileHandle, {
  sitekey?: string
  size?: Opciones["size"]
  execution?: Opciones["execution"]
  onVerify?: (token: string) => void
  onExpire?: () => void
  onError?: (mensaje: string) => void
  onToken?: (token: string) => void
  options?: Opciones
}>(function Turnstile({
  sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  size,
  execution,
  onVerify,
  onExpire,
  onError,
  onToken,
  options,
}, ref) {
  const clave = sitekey || ""
  const widget = useRef<TurnstileInstance>(null)
  const modo = size || options?.size || "normal"
  const cuando = execution || options?.execution || "render"
  const invisible = modo === "invisible" || cuando === "execute"
  const flexible = modo === "flexible"

  useImperativeHandle(ref, () => ({
    execute: () => widget.current?.execute(),
    reset: () => widget.current?.reset(),
  }))

  if (!clave) {
    return invisible ? null : <p className="px-3 text-sm font-black text-red-600">FALTA SITE KEY EN VERCEL</p>
  }

  return (
    <>
      {invisible && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      )}
      <div className={invisible ? "absolute w-0 h-0 overflow-hidden opacity-0 pointer-events-none" : flexible ? "min-h-[70px] w-full max-w-full overflow-hidden bg-white rounded-xl flex items-center justify-center" : "min-h-[70px] w-full bg-white rounded-xl flex items-center justify-center"} aria-hidden={invisible}>
        <Widget
          ref={widget}
          siteKey={clave}
          style={flexible ? { width: "100%", maxWidth: "100%" } : undefined}
          onSuccess={(token) => {
            onVerify?.(token)
            onToken?.(token)
          }}
          onExpire={() => {
            onVerify?.("")
            onToken?.("")
            onExpire?.()
          }}
          onError={() => {
            onVerify?.("")
            onToken?.("")
            onError?.("Inténtalo de nuevo")
          }}
          options={{
            theme: options?.theme ?? "auto",
            size: invisible ? "invisible" : modo === "compact" || modo === "flexible" ? modo : "normal",
            appearance: invisible ? "interaction-only" : "always",
            execution: invisible ? "execute" : "render",
          }}
        />
      </div>
    </>
  )
})
