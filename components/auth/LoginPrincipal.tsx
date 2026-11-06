"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function LoginPrincipal({ dark = true }: { dark?: boolean }){
  const router = useRouter()
  const [ruc, setRuc] = useState("1790000000001")
  const [pass, setPass] = useState("admin123")
  const [loading, setLoading] = useState(false)

  const i = `w-full mt-1.5 p-4 rounded-xl border outline-none text-[13px] ${dark? "bg-[#020a0f] border-white/10 text-white placeholder:text-white/20 focus:border-[#00f5d4]" : "bg-gray-50 border-gray-200 text-black focus:border-[#00f5d4]"}`;

  async function handleLogin() {
    if (ruc.length < 13) {
      alert("RUC debe tener 13 dígitos")
      return
    }
    setLoading(true)

    try {
      const esDemo = ruc.trim() === "1790000000001" && pass === "admin123"

      if (esDemo) {
        // MODO DEMO - VISITANTE LIMITADO
        localStorage.setItem('meijsac_token', 'demo-token-limitado')
        localStorage.setItem('meijsac_user', JSON.stringify({ 
          ruc: ruc.trim(), 
          nombre: "Usuario", 
          usuario: "demo",
          modo: "demo",
          esDemo: true,
          saludo: "Bienvenido Usuario, soy ESISA. Estás en modo DEMO de visita, con capacidad limitada."
        }))
        localStorage.setItem('esisa_usuario_actual', 'Usuario')
        localStorage.setItem('esisa_modo', 'demo')
      } else {
        // MODO REAL - CON NOMBRE REAL
        // Aquí puedes poner que el nombre venga de tu API
        const nombreReal = "Alexandra" // Esto vendrá de tu base de datos con el RUC
        localStorage.setItem('meijsac_token', 'token-' + ruc.trim())
        localStorage.setItem('meijsac_user', JSON.stringify({ 
          ruc: ruc.trim(), 
          nombre: nombreReal, 
          usuario: ruc.trim(),
          modo: "real",
          esDemo: false,
          saludo: `Hola ${nombreReal}, soy ESISA tu ayudante inteligente de Meijsac.`
        }))
        localStorage.setItem('esisa_usuario_actual', nombreReal)
        localStorage.setItem('esisa_modo', 'real')
      }

      router.push('/dashboard')
    } catch (err) {
      alert("Error de conexión")
    }

    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={`text-[10px] font-bold tracking-widest ${dark? "text-white/70" : "text-black/60"}`}>RUC / USUARIO EMPRESA (13 DÍGITOS)</label>
        <input className={i} placeholder="1790000000001" value={ruc} onChange={e=>setRuc(e.target.value)} />
      </div>
      <div>
        <label className={`text-[10px] font-bold tracking-widest ${dark? "text-white/70" : "text-black/60"}`}>CONTRASEÑA PRINCIPAL</label>
        <input type="password" className={i} placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)} />
      </div>

      <button onClick={handleLogin} disabled={loading} className="w-full p-4 rounded-xl bg-[#00f5d4] text-black font-bold text-[13px] mt-4 hover:bg-[#00e0c0] disabled:opacity-50">
        {loading? 'INGRESANDO...' : 'INGRESAR →'}
      </button>
      
      <p className="text-[9px] opacity-30 text-center">DEMO = 1790000000001 / admin123 = Modo visitante limitado</p>
    </div>
  )
}