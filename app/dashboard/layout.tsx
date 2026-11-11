"use client"
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { EsisaAvatar } from '@/components/EsisaAvatar'
import { SelloAmbiente } from '@/components/SelloAmbiente'
import { guardarEmpresaLocal } from '@/lib/sesion-cliente'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isDashboard = pathname === '/dashboard'

  useEffect(() => {
    let vivo = true
    const tieneLocal = () => !!(localStorage.getItem("meijsac_empresa") || localStorage.getItem("meijsac_user"))
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    fetch("/api/auth/sesion", { signal: ctrl.signal, credentials: "same-origin" })
      .then(async (res) => {
        if (!vivo) return
        if (res.ok) {
          sessionStorage.setItem("meijsac_acceso_ok", "1")
          if (!tieneLocal()) {
            const data = await fetch("/api/empresa/mia", { credentials: "same-origin" }).then((r) => r.json()).catch(() => null)
            if (data?.empresa) guardarEmpresaLocal(data.empresa)
          }
          return
        }
        if (res.status === 401) {
          sessionStorage.removeItem("meijsac_acceso_ok")
          sessionStorage.setItem("meijsac_aviso_sesion", "Sesión vencida")
          router.replace("/login")
        }
      })
      .catch(() => {
        if (vivo && !tieneLocal()) router.replace("/login")
      })
      .finally(() => clearTimeout(timer))
    return () => {
      vivo = false
      clearTimeout(timer)
    }
  }, [router])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <SelloAmbiente />
      {!isDashboard && (
        <div className="p-4"></div>
      )}
      {children}
      <EsisaAvatar />
    </div>
  )
}
