"use client"
import { useEffect, useState } from "react"
import { leerEmpresaLocal } from "@/lib/sesion-cliente"

export function useModulosDelPlan() {
  const [modulos, setModulos] = useState<string[] | null | undefined>(undefined)

  useEffect(() => {
    let vivo = true
    const leer = async () => {
      let ruc = String(leerEmpresaLocal()?.ruc || "")
      if (!ruc) {
        const mia = await fetch("/api/empresa/mia", { credentials: "same-origin" }).then((res) => res.ok ? res.json() : null).catch(() => null)
        ruc = String(mia?.empresa?.ruc || "")
      }
      if (!vivo) return
      if (!ruc) {
        setModulos(null)
        return
      }
      const data = await fetch(`/api/empresa/estado?ruc=${encodeURIComponent(ruc)}`, { credentials: "same-origin", cache: "no-store" }).then((res) => res.ok ? res.json() : null).catch(() => null)
      if (vivo) setModulos(Array.isArray(data?.modulos) ? data.modulos : null)
    }
    void leer()
    return () => { vivo = false }
  }, [])

  return modulos
}
