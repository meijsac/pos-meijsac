"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function LoginCaja({ dark }: { dark: boolean }) {
  const router = useRouter()
  const [user, setUser] = useState("")
  const [pass, setPass] = useState("")
  const [loading, setLoading] = useState(false)

  const entrar = async () => {
    if (!user || !pass) { alert("Ingresa usuario y contraseña"); return; }
    setLoading(true)
    try {
      // AHORA pregunta a meijsac.com / Supabase, no a la compu
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruc: user.trim(), password: pass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Usuario o clave incorrectos');

      localStorage.setItem('meijsac_token', data.token);
      localStorage.setItem('meijsac_user', JSON.stringify(data.usuario));
      router.push('/dashboard/pos-ticket')
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <input className="w-full p-4 rounded-xl border" placeholder="Usuario caja" value={user} onChange={e=>setUser(e.target.value)} />
      <input type="password" className="w-full p-4 rounded-xl border" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} />
      <button onClick={entrar} disabled={loading} className="w-full p-4 rounded-xl bg-[#ff00a8] text-white font-bold">
        {loading ? 'VERIFICANDO EN MEIJSAC.COM...' : 'INGRESAR AL DASHBOARD →'}
      </button>
    </div>
  )
}