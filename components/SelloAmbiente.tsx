"use client"
import { useEffect, useState } from "react"
import { codigoAmbiente, type CodigoAmbiente } from "@/lib/sri/ambiente"

export const EVENTO_AMBIENTE = "meijsac-ambiente"
const LLAVE = "meijsac_ambiente_vivo"

export function publicarAmbiente(codigo: CodigoAmbiente) {
  localStorage.setItem(LLAVE, codigo)
  try {
    const empresa = JSON.parse(localStorage.getItem("meijsac_empresa") || "{}")
    empresa.ambiente = codigo
    localStorage.setItem("meijsac_empresa", JSON.stringify(empresa))
  } catch { /* la empresa local se actualiza en el próximo ingreso */ }
  window.dispatchEvent(new CustomEvent(EVENTO_AMBIENTE, { detail: codigo }))
}

function guardado(): CodigoAmbiente | "" {
  if (typeof window === "undefined") return ""
  const valor = localStorage.getItem(LLAVE)
  return valor === "1" || valor === "2" ? valor : ""
}

export function useAmbienteVivo() {
  const [codigo, setCodigo] = useState<CodigoAmbiente | "">(guardado)

  useEffect(() => {
    const aplicar = (valor: unknown) => {
      const siguiente = codigoAmbiente(valor)
      if (String(valor) === "1" || String(valor) === "2" || String(valor).toUpperCase().includes("PROD") || String(valor).toUpperCase().includes("PRUEB")) {
        setCodigo(siguiente)
      }
    }
    let vivo = true
    const cargar = () => {
      const local = guardado()
      if (local) {
        aplicar(local)
        return
      }
      fetch("/api/empresa/mia", { credentials: "same-origin", cache: "no-store" })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!vivo || !data?.empresa?.ambiente) return
          const siguiente = codigoAmbiente(data.empresa.ambiente)
          localStorage.setItem(LLAVE, siguiente)
          aplicar(siguiente)
        })
        .catch(() => {})
    }
    cargar()
    const alEvento = (evento: Event) => aplicar((evento as CustomEvent).detail)
    const alStorage = (evento: StorageEvent) => {
      if (evento.key === LLAVE && evento.newValue) aplicar(evento.newValue)
    }
    window.addEventListener(EVENTO_AMBIENTE, alEvento)
    window.addEventListener("storage", alStorage)
    const timer = window.setInterval(cargar, 2000)
    return () => {
      vivo = false
      window.removeEventListener(EVENTO_AMBIENTE, alEvento)
      window.removeEventListener("storage", alStorage)
      window.clearInterval(timer)
    }
  }, [])

  return codigo
}

export function SelloAmbiente() {
  const codigo = useAmbienteVivo()
  if (!codigo) return null
  const produccion = codigo === "2"
  return (
    <div className={`sticky top-0 z-50 px-4 py-4 text-center shadow-lg ${produccion ? "bg-[#00ff5d] text-black" : "bg-amber-400 text-black"}`}>
      <p className="text-2xl md:text-4xl font-black tracking-widest leading-none">
        <span className={`mr-3 inline-block h-4 w-4 rounded-full align-middle ${produccion ? "bg-black" : "bg-black"}`} />
        {produccion ? "PRODUCCIÓN - REAL" : "PRUEBAS - SIN VALIDEZ"}
      </p>
    </div>
  )
}
