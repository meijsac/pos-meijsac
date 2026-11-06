"use client"
import { useState, useEffect } from "react"

export function useEmpresa() {
  const [empresa, setEmpresa] = useState<any>(null)

  useEffect(() => {
    const guardado = localStorage.getItem('meijsac_empresa')
    if (guardado) {
      setEmpresa(JSON.parse(guardado))
    }
  }, [])

  return empresa
}