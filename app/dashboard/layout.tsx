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
    const token = localStorage.getItem('meijsac_token')
    // Rechaza tokens falsos viejos
    if (!token || token === 'ok' || token === 'offline-token-demo' || token === 'demo') {
      localStorage.removeItem('meijsac_token')
      localStorage.removeItem('meijsac_user')
      router.replace('/login')
      return
    }
    setOk(true)
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