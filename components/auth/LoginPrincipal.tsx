"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function LoginPrincipal({ dark = true }: { dark?: boolean }){
  const router = useRouter()
  const [ruc, setRuc] = useState("")
  const [pass, setPass] = useState("")
  const [loading, setLoading] = useState(false)

  const i = `w-full mt-1.5 p-4 rounded-xl border outline-none text-[13px] ${dark? "bg-[#020a0f] border-white/10 text-white placeholder:text-white/20 focus:border-[#00f5d4]" : "bg-gray-50 border-gray-200 text-black focus:border-[#00f5d4]"}`;

  async function handleLogin() {
    if (ruc.length < 13) {
      alert("RUC debe tener 13 dígitos")
      return
    }
    setLoading(true)

    try {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ruc: ruc.trim(), password: pass })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al ingresar');

  // Ahora SÍ guardamos el token REAL de la base de datos
  localStorage.setItem('meijsac_token', data.token);
  localStorage.setItem('meijsac_user', JSON.stringify(data.usuario));
  localStorage.setItem('esisa_modo', 'real');
  localStorage.setItem('esisa_usuario_actual', data.usuario.nombre);

  router.push('/dashboard');
} catch (e: any) {
  alert(e.message);
} finally {
  setLoading(false);
}
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