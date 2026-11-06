"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function LoginCaja({ dark }: { dark: boolean }) {
  const router = useRouter()
  const [user, setUser] = useState("")
  const [pass, setPass] = useState("")

  const entrar = () => {
    const guardado = localStorage.getItem('meijsac_caja_user')
    if (!guardado) { alert("No hay empresa registrada. Registra primero."); return; }
    
    const u = JSON.parse(guardado)
    if (user === u.usuario && btoa(pass) === u.clave) {
      localStorage.setItem('meijsac_token', 'ok')
      router.push('/dashboard/pos-ticket') // a donde entra la caja
    } else {
      alert(`Usuario incorrecto. El registrado es: ${u.usuario}`)
    }
  }

  return (
    <div className="space-y-4">
      <input className="w-full p-4 rounded-xl border" placeholder="Usuario caja" value={user} onChange={e=>setUser(e.target.value)} />
      <input type="password" className="w-full p-4 rounded-xl border" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} />
      <button onClick={entrar} className="w-full p-4 rounded-xl bg-[#ff00a8] text-white font-bold">
        INGRESAR AL DASHBOARD →
      </button>
    </div>
  )
}