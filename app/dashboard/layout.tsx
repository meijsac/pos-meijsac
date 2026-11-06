"use client"
import { useRouter, usePathname } from 'next/navigation'
import { EsisaAvatar } from '@/components/EsisaAvatar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isDashboard = pathname === '/dashboard'

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {!isDashboard && (
        <div className="p-4">
         
        </div>
      )}
      {children}
      <EsisaAvatar />
    </div>
  )
}