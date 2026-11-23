"use client"
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { EsisaAvatar } from '@/components/EsisaAvatar'
import { SelloAmbiente } from '@/components/SelloAmbiente'
import { guardarEmpresaLocal, limpiarSesionLocal } from '@/lib/sesion-cliente'
import { permisosLocales, rutaPermitida } from '@/lib/permisos-pos'
import { rutaDePlanPermitida } from '@/lib/plan-acceso'
import { useModulosDelPlan } from '@/lib/use-modulos-plan'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isDashboard = pathname === '/dashboard'
  const modulosPlan = useModulosDelPlan()

  useEffect(() => {
    ;["/dashboard", "/dashboard/comprobantes", "/dashboard/configuracion", "/dashboard/factura-xml", "/dashboard/clientes", "/dashboard/productos", "/dashboard/caja", "/dashboard/respaldo"].forEach((ruta) => router.prefetch(ruta))
  }, [pathname, router])

  useEffect(() => {
    if (!sessionStorage.getItem("meijsac_firma_ok")) {
      fetch("/api/sri/clave-firma", { credentials: "same-origin" })
        .then((r) => r.ok ? r.json() : null)
        .then((firma) => sessionStorage.setItem("meijsac_firma_ok", firma?.guardada ? "1" : "0"))
        .catch(() => {})
    }
    void fetch("/api/empresa/mia", { credentials: "same-origin" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.empresa) guardarEmpresaLocal(data.empresa) })
      .catch(() => {})
  }, [])

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
          const data = await res.json().catch(() => null)
          if (data?.rol) {
            const previo = JSON.parse(localStorage.getItem("meijsac_user") || "{}")
            localStorage.setItem("meijsac_user", JSON.stringify({ ...previo, nombre: data.nombre || previo.nombre, rol: data.rol, permisos: data.permisos ?? null, empresaId: data.empresaId || previo.empresaId }))
            if (!rutaPermitida(pathname, permisosLocales())) router.replace(modulosPlan !== undefined && !rutaDePlanPermitida("/dashboard/factura-xml", modulosPlan) ? "/dashboard" : "/dashboard/factura-xml")
          }
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

  useEffect(() => {
    if (!rutaPermitida(pathname, permisosLocales())) router.replace(modulosPlan !== undefined && !rutaDePlanPermitida("/dashboard/factura-xml", modulosPlan) ? "/dashboard" : "/dashboard/factura-xml")
    if (modulosPlan !== undefined && !rutaDePlanPermitida(pathname, modulosPlan)) router.replace("/dashboard")
  }, [pathname, router, modulosPlan])

  useEffect(() => {
    if (sessionStorage.getItem("meijsac_sri_reintento")) return
    sessionStorage.setItem("meijsac_sri_reintento", "1")
    fetch("/api/sri/reintentar", { method: "POST", credentials: "same-origin" }).catch(() => {})
  }, [])

  useEffect(() => {
    const enFacturador = pathname.startsWith("/dashboard/factura-xml")
    if (enFacturador) {
      const pulso = () => { fetch("/api/auth/sesion", { credentials: "same-origin" }).catch(() => {}) }
      pulso()
      const reloj = window.setInterval(pulso, 10 * 60 * 1000)
      return () => window.clearInterval(reloj)
    }
    let timer = 0
    const armar = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        sessionStorage.setItem("meijsac_aviso_sesion", "Sesión vencida")
        fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {})
        limpiarSesionLocal()
        router.replace("/login")
      }, 30 * 60 * 1000)
    }
    const eventos = ["mousemove", "keydown", "click", "touchstart"] as const
    eventos.forEach((evento) => window.addEventListener(evento, armar))
    armar()
    return () => {
      window.clearTimeout(timer)
      eventos.forEach((evento) => window.removeEventListener(evento, armar))
    }
  }, [router, pathname])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {pathname !== "/dashboard/comprobantes" && <SelloAmbiente />}
      {!isDashboard && (
        <div className="p-4"></div>
      )}
      {children}
      <EsisaAvatar />
    </div>
  )
}
