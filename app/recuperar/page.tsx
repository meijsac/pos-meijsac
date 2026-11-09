"use client"
import { useState } from "react"

export default function Recuperar() {
  const [ruc, setRuc] = useState("")
  const [aviso, setAviso] = useState("")
  const enviar = async () => {
    const res = await fetch("/api/auth/recuperar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ruc }) })
    const data = await res.json()
    setAviso(data.error || data.mensaje)
  }
  return (
    <main className="min-h-screen bg-black text-white p-8 max-w-md mx-auto space-y-3">
      <h1 className="font-black">Olvidé mi contraseña</h1>
      <input value={ruc} onChange={(e) => setRuc(e.target.value)} placeholder="RUC" className="w-full bg-black border border-white/10 rounded-xl p-3" />
      <button onClick={enviar} className="bg-[#00f5d4] text-black font-black rounded-xl px-4 py-2">Enviar enlace</button>
      {aviso && <p className="text-sm">{aviso}</p>}
    </main>
  )
}
