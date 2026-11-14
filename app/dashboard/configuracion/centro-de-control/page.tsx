"use client"

import { useEffect, useState } from "react"

const MODULOS = [
  "Comprobantes electrónicos",
  "POS Ticket",
  "Restaurante POS",
  "Contabilidad",
  "Cuentas por cobrar",
  "Inventario",
  "Caja",
  "Clientes",
  "Reportes",
  "Comprobantes adicionales",
  "Respaldo / Restaurar",
]

export default function CentroDeControlPage() {
  const [activos, setActivos] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let guardado: Record<string, boolean> = {}
    try { guardado = JSON.parse(localStorage.getItem("meijsac_modulos_activos") || "{}") } catch { guardado = {} }
    const base: Record<string, boolean> = {}
    for (const nombre of MODULOS) base[nombre] = guardado[nombre] !== false
    setActivos(base)
  }, [])

  function cambiar(nombre: string) {
    const siguiente = { ...activos, [nombre]: !activos[nombre] }
    setActivos(siguiente)
    localStorage.setItem("meijsac_modulos_activos", JSON.stringify(siguiente))
  }

  return (
    <div className="min-h-screen bg-[#060608] text-white p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-black">Centro de Control Modular</h1>
          <button onClick={() => location.href = "/dashboard/configuracion"} className="text-xs bg-white/10 px-3 py-2 rounded-xl">Configuración</button>
        </div>
        <div className="bg-[#11131a] border border-white/10 rounded-2xl divide-y divide-white/5">
          {MODULOS.map((nombre) => (
            <label key={nombre} className="flex items-center justify-between px-4 py-3 cursor-pointer">
              <span className="text-sm">{nombre}</span>
              <input type="checkbox" checked={activos[nombre] !== false} onChange={() => cambiar(nombre)} className="accent-[#00f5d4] w-4 h-4" />
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
