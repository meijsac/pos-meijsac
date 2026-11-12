"use client"
import { FormEvent, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { guardarEmpresaLocal } from "@/lib/sesion-cliente"
import { Turnstile, type TurnstileHandle } from "@/components/auth/Turnstile"

export function AuthCard({ dark, setDark, onOpenRegister }: { dark: boolean; setDark: (v: boolean) => void; onOpenRegister: () => void }) {
  const router = useRouter()
  const [tab, setTab] = useState<"USUARIO" | "CAJA">("USUARIO")
  const [ruc, setRuc] = useState("")
  const [usuarioCaja, setUsuarioCaja] = useState("")
  const [clave, setClave] = useState("")
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState("")
  const [recordarme, setRecordarme] = useState(false)
  const [trampa, setTrampa] = useState("")
  const [pideCaptcha, setPideCaptcha] = useState(false)
  const turnstileRef = useRef<TurnstileHandle>(null)
  const tokenListo = useRef<(token: string) => void>(() => {})

  useEffect(() => {
    const aviso = sessionStorage.getItem("meijsac_aviso_sesion")
    if (aviso) {
      sessionStorage.removeItem("meijsac_aviso_sesion")
      setError("Sesión vencida")
    }
    let vivo = true
    fetch("/api/auth/sesion", { credentials: "same-origin" })
      .then((res) => {
        if (vivo && res.ok) router.replace("/dashboard")
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [router])

  function pedirToken() {
    return new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Resuelve el captcha para entrar")), 12000)
      tokenListo.current = (token) => {
        window.clearTimeout(timer)
        resolve(token)
      }
      turnstileRef.current?.reset()
      turnstileRef.current?.execute()
    })
  }

  async function enviar(e?: FormEvent) {
    e?.preventDefault()
    const rucValue = ruc.trim()
    const caja = tab === "CAJA"
    if (caja) {
      if (!usuarioCaja.trim() || !clave) {
        setError("Ingresa usuario y contraseña")
        return
      }
    } else if (!rucValue || !clave) {
      setError("Ingresa RUC y contraseña")
      return
    } else if (rucValue.length !== 13 || !/^[0-9]+$/.test(rucValue)) {
      setError("Ingresa el RUC de 13 dígitos y la contraseña")
      return
    }
    setError("")
    try {
      let captcha = ""
      if (pideCaptcha) captcha = await pedirToken()
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ruc: caja ? "" : rucValue,
          usuario: caja ? usuarioCaja.trim() : "",
          password: clave,
          canal: caja ? "POS" : "LOGIN",
          recordarme,
          captcha,
          empresa_web: trampa,
        }),
      })
      const data = await res.json()
      if (data.requiereCaptcha) setPideCaptcha(true)
      if (!res.ok) throw new Error(data.error || "Credenciales inválidas")
      if (data.empresa) guardarEmpresaLocal(data.empresa, undefined, data.usuario)
      sessionStorage.setItem("meijsac_acceso_ok", "1")
      sessionStorage.removeItem("meijsac_aviso_sesion")
      router.replace(data.destino || "/dashboard")
    } catch (err: any) {
      setError(err.message || "Credenciales inválidas")
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`w-full max-w-[380px] p-7 rounded-[32px] border shadow-2xl ${dark ? "bg-[#101a2e]/90 border-cyan-400/20" : "bg-white border-black/10"}`}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="flex gap-3 items-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00f5d4] to-[#ff00a8] p-[2px] shadow-[0_0_20px_#00f5d4]">
            <img src="/colibri.png" alt="MEIJSAC" className="w-full h-full rounded-full bg-[#020d14] object-cover" />
          </div>
          <div>
            <p className={`font-black tracking-widest ${dark ? "text-white" : "text-black"}`}>MEIJSAC</p>
            <p className="text-[11px] text-[#00f5d4] font-bold leading-none">POS • BAJO NORMAS<br />SRI</p>
          </div>
        </div>
        <button type="button" onClick={() => setDark(!dark)} className="px-4 py-2 rounded-full bg-[#2a3245] text-white text-[10px] font-bold border border-white/10">
          {dark ? "☀️ CLARO" : "🌙 OSCURO"}
        </button>
      </div>

      <div className="flex bg-black/60 p-1 rounded-2xl mb-6">
        <button type="button" onClick={() => setTab("USUARIO")} className={`flex-1 py-3 rounded-xl text-xs font-black transition ${tab === "USUARIO" ? "bg-[#00f5d4] text-black" : "text-white/40"}`}>
          USUARIO
        </button>
        <button type="button" onClick={() => setTab("CAJA")} className={`flex-1 py-3 rounded-xl text-xs font-black transition ${tab === "CAJA" ? "bg-[#00f5d4] text-black" : "text-white/40"}`}>
          CAJERO / VENDEDOR
        </button>
      </div>

      <form className="space-y-4" onSubmit={enviar}>
        <input name="empresa_web" value={trampa} onChange={(e) => setTrampa(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        <div>
          <label className={`text-[10px] font-bold tracking-widest ${dark ? "text-white/60" : "text-black/60"}`}>
            {tab === "USUARIO" ? "RUC / USUARIO EMPRESA (13 DÍGITOS)" : "USUARIO DE CAJERO O VENDEDOR"}
          </label>
          {tab === "USUARIO" ? (
            <input id="ruc" maxLength={13} value={ruc} onChange={(e) => setRuc(e.target.value)} className={`w-full mt-2 p-4 rounded-2xl border outline-none text-sm tracking-widest ${dark ? "bg-black/60 border-white/10 text-white focus:border-[#00f5d4]" : "bg-gray-100 border-black/10 text-black focus:border-[#00f5d4]"}`} />
          ) : (
            <input id="usuario" value={usuarioCaja} onChange={(e) => setUsuarioCaja(e.target.value)} className={`w-full mt-2 p-4 rounded-2xl border outline-none text-sm ${dark ? "bg-black/60 border-white/10 text-white focus:border-[#00f5d4]" : "bg-gray-100 border-black/10 text-black focus:border-[#00f5d4]"}`} />
          )}
        </div>
        <div>
          <label className={`text-[10px] font-bold tracking-widest ${dark ? "text-white/60" : "text-black/60"}`}>{tab === "USUARIO" ? "CONTRASEÑA PRINCIPAL" : "CLAVE DEL CAJERO O VENDEDOR"}</label>
          <div className="relative mt-2">
            <input id="clave" type={verClave ? "text" : "password"} value={clave} onChange={(e) => setClave(e.target.value)} className={`w-full p-4 pr-12 rounded-2xl border outline-none text-sm ${dark ? "bg-black/60 border-white/10 text-white focus:border-[#ff00a8]" : "bg-gray-100 border-black/10 text-black focus:border-[#ff00a8]"}`} />
            <button type="button" onClick={() => setVerClave((v) => !v)} aria-label={verClave ? "Ocultar clave" : "Ver clave"} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 ${dark ? "text-white/50 hover:text-white" : "text-black/40 hover:text-black"}`}>
              {verClave ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3 l18 18" /><path d="M10.6 10.6 a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.1 A10.8 10.8 0 0 1 12 5 c5 0 9.3 3.1 11 7 a11.7 11.7 0 0 1-4.2 5.1" /><path d="M6.1 6.1 A11.6 11.6 0 0 0 1 12 c1.7 3.9 6 7 11 7 a10.8 10.8 0 0 0 4.1-.8" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12 s4-7 11-7 s11 7 11 7 s-4 7-11 7 S1 12 1 12 z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          </div>
        </div>
        {pideCaptcha && (
          <Turnstile
            ref={turnstileRef}
            size="invisible"
            execution="execute"
            onVerify={(token) => tokenListo.current(token)}
            onToken={(token) => tokenListo.current(token)}
            onError={() => tokenListo.current("")}
          />
        )}
        <button type="submit" className="w-full py-4 rounded-2xl bg-[#00f5d4] text-black font-black tracking-wide">
          ENTRAR
        </button>
        {error && <p className="text-sm font-bold text-red-400">{error}</p>}
        <div className="flex justify-between text-[11px] mt-3">
          <label className={`flex items-center gap-2 ${dark ? "text-white/50" : "text-black/50"}`}>
            <input type="checkbox" checked={recordarme} onChange={(e) => setRecordarme(e.target.checked)} />
            Recordarme
          </label>
          <a href="/recuperar" className="text-[#00f5d4] font-bold">¿Olvidaste tu contraseña?</a>
        </div>
        <div className="text-center mt-3">
          <button type="button" onClick={onOpenRegister} className={`text-[11px] bg-transparent border-none cursor-pointer p-0 ${dark ? "text-white/30" : "text-black/40"}`}>
            ¿Primera vez? <span className="text-[#ff2e9a] font-bold hover:underline">Crear empresa nueva</span>
          </button>
        </div>
      </form>
    </motion.div>
  )
}
