"use client"
import { FormEvent, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { guardarEmpresaLocal } from "@/lib/sesion-cliente"
import { Turnstile, type TurnstileHandle } from "@/components/auth/Turnstile"

export function AuthCard({ dark, setDark, onOpenRegister }: { dark: boolean; setDark: (v: boolean) => void; onOpenRegister: () => void }) {
  const router = useRouter()
  const [ruc, setRuc] = useState("")
  const [clave, setClave] = useState("")
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
    if (!rucValue || !clave) {
      setError("Ingresa RUC y contraseña")
      return
    }
    if (rucValue.length !== 13 || !/^[0-9]+$/.test(rucValue)) {
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
        body: JSON.stringify({ ruc: rucValue, password: clave, recordarme, captcha, empresa_web: trampa }),
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

      <form className="space-y-4" onSubmit={enviar}>
        <input name="empresa_web" value={trampa} onChange={(e) => setTrampa(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        <div>
          <label className={`text-[10px] font-bold tracking-widest ${dark ? "text-white/60" : "text-black/60"}`}>
            RUC / USUARIO EMPRESA (13 DÍGITOS)
          </label>
          <input id="ruc" maxLength={13} value={ruc} onChange={(e) => setRuc(e.target.value)} className={`w-full mt-2 p-4 rounded-2xl border outline-none text-sm tracking-widest ${dark ? "bg-black/60 border-white/10 text-white focus:border-[#00f5d4]" : "bg-gray-100 border-black/10 text-black focus:border-[#00f5d4]"}`} />
        </div>
        <div>
          <label className={`text-[10px] font-bold tracking-widest ${dark ? "text-white/60" : "text-black/60"}`}>CONTRASEÑA PRINCIPAL</label>
          <input id="clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)} className={`w-full mt-2 p-4 rounded-2xl border outline-none text-sm ${dark ? "bg-black/60 border-white/10 text-white focus:border-[#ff00a8]" : "bg-gray-100 border-black/10 text-black focus:border-[#ff00a8]"}`} />
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
