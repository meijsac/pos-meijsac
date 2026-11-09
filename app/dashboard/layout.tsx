"use client"
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { EsisaAvatar } from '@/components/EsisaAvatar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isDashboard = pathname === '/dashboard'

  useEffect(() => {
    const empresa = localStorage.getItem("meijsac_empresa")
    const usuario = localStorage.getItem("meijsac_user")
    if (!empresa && !usuario) {
      router.replace("/login")
      return
    }
    if (sessionStorage.getItem("meijsac_acceso_ok") === "1") return
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    fetch("/api/auth/sesion", { signal: ctrl.signal })
      .then((res) => {
        if (res.status === 401) {
          sessionStorage.removeItem("meijsac_acceso_ok")
          router.replace("/login")
          return
        }
        if (res.ok) sessionStorage.setItem("meijsac_acceso_ok", "1")
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer))
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {!isDashboard && (
        <div className="p-4"></div>
      )}
      {children}
      <EsisaAvatar />
    </div>
  )
}
