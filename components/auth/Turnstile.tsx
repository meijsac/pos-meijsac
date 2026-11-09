"use client"

import { Turnstile as Widget } from "@marsidev/react-turnstile"

type Opciones = {
  theme?: "auto" | "light" | "dark"
  size?: "normal" | "compact" | "flexible"
}

export function Turnstile({
  sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  onVerify,
  onExpire,
  onError,
  onToken,
  options,
}: {
  sitekey?: string
  onVerify?: (token: string) => void
  onExpire?: () => void
  onError?: (mensaje: string) => void
  onToken?: (token: string) => void
  options?: Opciones
}) {
  const clave = sitekey || ""
  console.log("TURNSTILE_SITE_KEY", clave || "(vacía)")

  return (
    <div className="min-h-[70px] w-full bg-white rounded-xl flex items-center justify-center overflow-visible relative z-20">
      {!clave ? (
        <p className="px-3 text-sm font-black text-red-600">FALTA SITE KEY EN VERCEL</p>
      ) : (
        <Widget
          siteKey={clave}
          onSuccess={(token) => {
            onVerify?.(token)
            onToken?.(token)
          }}
          onExpire={() => {
            onVerify?.("")
            onToken?.("")
            onExpire?.()
          }}
          onError={(codigo) => {
            onVerify?.("")
            onToken?.("")
            onError?.(codigo ? `No se pudo cargar el captcha (${codigo})` : "No se pudo cargar el captcha")
          }}
          options={{
            theme: options?.theme ?? "dark",
            size: "normal",
            appearance: "always",
            execution: "render",
          }}
        />
      )}
    </div>
  )
}
