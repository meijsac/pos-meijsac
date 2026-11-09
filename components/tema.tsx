"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Tema = { claro: boolean; alternar: () => void }

const TemaCtx = createContext<Tema>({ claro: false, alternar: () => {} })

function aplicar(claro: boolean) {
  document.documentElement.dataset.theme = claro ? "claro" : "oscuro"
  localStorage.setItem("meijsac_tema", claro ? "claro" : "oscuro")
}

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const [claro, setClaro] = useState(false)

  useEffect(() => {
    const guardado = localStorage.getItem("meijsac_tema")
    const factura = localStorage.getItem("meijsac_factura_tema")
    const esClaro = guardado ? guardado === "claro" : factura === "light"
    setClaro(esClaro)
    document.documentElement.dataset.theme = esClaro ? "claro" : "oscuro"
  }, [])

  const alternar = () => {
    setClaro((actual) => {
      const siguiente = !actual
      aplicar(siguiente)
      return siguiente
    })
  }

  return <TemaCtx.Provider value={{ claro, alternar }}>{children}</TemaCtx.Provider>
}

export function useTema() {
  return useContext(TemaCtx)
}

export function BotonTema() {
  const { claro, alternar } = useTema()
  return (
    <button
      type="button"
      onClick={alternar}
      className="px-3 py-1.5 rounded-full text-[10px] font-black border border-[#14b8a6] bg-white text-slate-900"
    >
      {claro ? "🌙 OSCURO" : "☀️ CLARO"}
    </button>
  )
}
