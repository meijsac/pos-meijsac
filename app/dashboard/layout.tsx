"use client"
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { EsisaAvatar } from '@/components/EsisaAvatar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isDashboard = pathname === '/dashboard'
  const [ok, setOk] = useState(false)

  useEffect(() => {
    localStorage.removeItem('meijsac_token')
    fetch('/api/auth/sesion').then((res) => {
      if (!res.ok) {
        localStorage.removeItem('meijsac_user')
        router.replace('/login')
        return
      }
      setOk(true)
    }).catch(() => router.replace('/login'))
  }, [router])

  if (!ok) {
    return <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">Verificando acceso en meijsac.com...</div>
  }

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