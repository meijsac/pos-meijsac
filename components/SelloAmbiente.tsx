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

const ESCUDO = "M12 3 l7 3 v6 c0 4.5-3 7.5-7 9 c-4-1.5-7-4.5-7-9 V6 z M9 12 l2 2 l4-4"

export function SelloAmbiente() {
  const codigo = useAmbienteVivo()
  const [firmaVigente, setFirmaVigente] = useState<boolean | null>(null)
  useEffect(() => {
    let vivo = true
    fetch("/api/empresa/mia", { credentials: "same-origin" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!vivo) return
        const vence = data?.empresa?.firmaExpira ? new Date(data.empresa.firmaExpira).getTime() : 0
        setFirmaVigente(vence > Date.now())
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [])
  if (!codigo) return null
  const produccion = codigo === "2"
  return (
    <div className="flex justify-end gap-3 px-4 pt-3 text-xs">
      <div className={`px-3.5 py-2 rounded-xl flex items-center gap-2 border ${produccion ? "bg-[#111827] border-teal-500/30 text-teal-300" : "bg-[#111827] border-amber-500/30 text-amber-300"}`}>
        <span className={`w-2 h-2 rounded-full ${produccion ? "bg-teal-400" : "bg-amber-400"}`} />
        <span className="font-medium">{produccion ? "Ambiente Producción" : "Ambiente Pruebas"}</span>
      </div>
      <div className={`bg-[#111827] px-3.5 py-2 rounded-xl flex items-center gap-2 border ${firmaVigente ? "border-slate-800 text-slate-200" : "border-rose-500/30 text-rose-300"}`}>
        <svg viewBox="0 0 24 24" className={`w-4 h-4 ${firmaVigente ? "text-teal-400" : "text-rose-400"}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d={ESCUDO} />
        </svg>
        <span className="font-medium">{firmaVigente ? "Firma activa" : "Firma caducada"}</span>
      </div>
    </div>
  )
}
