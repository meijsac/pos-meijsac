"use client"

import { useEffect, useState } from "react"

type Plato = { nombre: string; cant: number; precio: number; estado: string; nota: string }
type Carta = { nombre: string; precio: number; cat: string }
export type VistaMesa = {
  local: string
  mesa: string
  zona: string
  cuentaAbierta: boolean
  platos: Plato[]
  subtotal: number
  iva: number
  propina: number
  total: number
  menu: Carta[]
  categorias: string[]
}

function dinero(valor: number) {
  return `$${Number(valor || 0).toFixed(2)}`
}

export function MesaCliente({ codigo, inicial }: { codigo: string; inicial: VistaMesa }) {
  const [vista, setVista] = useState(inicial)
  const [pestaña, setPestaña] = useState<"cuenta" | "menu">("cuenta")
  const [cat, setCat] = useState(inicial.categorias[0] || "")

  useEffect(() => {
    const cargar = () => {
      fetch(`/api/mesa/${codigo}`, { cache: "no-store" })
        .then((res) => res.ok ? res.json() : null)
        .then((data: VistaMesa | null) => {
          if (!data) return
          setVista(data)
          setCat((actual) => actual || data.categorias?.[0] || "")
        })
        .catch(() => {})
    }
    const reloj = setInterval(cargar, 3000)
    return () => clearInterval(reloj)
  }, [codigo])

  const grupos = vista.categorias.length ? vista.categorias : [...new Set(vista.menu.map((plato) => plato.cat))]
  const activa = cat || grupos[0] || ""

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      <header className="bg-slate-900 text-white px-4 py-5">
        <p className="text-xs uppercase tracking-wide text-slate-300">{vista.local}</p>
        <h1 className="text-2xl font-black">{vista.mesa}{vista.zona ? ` · ${vista.zona}` : ""}</h1>
      </header>
      <div className="grid grid-cols-2 bg-white border-b border-slate-200">
        <button type="button" onClick={() => setPestaña("cuenta")} className={`py-3 text-sm font-black ${pestaña === "cuenta" ? "text-teal-700 border-b-2 border-teal-600" : "text-slate-500"}`}>Tu cuenta</button>
        <button type="button" onClick={() => setPestaña("menu")} className={`py-3 text-sm font-black ${pestaña === "menu" ? "text-teal-700 border-b-2 border-teal-600" : "text-slate-500"}`}>Menú</button>
      </div>
      {pestaña === "cuenta" ? (
        <section className="p-4 space-y-3">
          {vista.cuentaAbierta ? vista.platos.map((plato, indice) => (
            <article key={`${plato.nombre}-${indice}`} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between gap-3">
                <h2 className="font-bold">{plato.cant}× {plato.nombre}</h2>
                <span className="font-black">{dinero(plato.precio * plato.cant)}</span>
              </div>
              {plato.nota ? <p className="text-sm text-slate-500 mt-1">{plato.nota}</p> : null}
              <p className="text-sm font-bold text-teal-700 mt-2">{plato.estado}</p>
            </article>
          )) : <p className="bg-white rounded-2xl p-4 text-slate-600">Esta mesa no tiene una cuenta abierta.</p>}
          {vista.cuentaAbierta ? (
            <div className="bg-white rounded-2xl p-4 shadow-sm text-sm space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>{dinero(vista.subtotal)}</span></div>
              <div className="flex justify-between"><span>IVA 15%</span><span>{dinero(vista.iva)}</span></div>
              <div className="flex justify-between"><span>Propina 10%</span><span>{dinero(vista.propina)}</span></div>
              <div className="flex justify-between text-lg font-black border-t border-slate-200 pt-2"><span>Total</span><span>{dinero(vista.total)}</span></div>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="p-4">
          <div className="flex gap-2 overflow-x-auto pb-3">
            {grupos.map((nombre) => (
              <button key={nombre} type="button" onClick={() => setCat(nombre)} className={`px-3 py-2 rounded-full text-xs font-black whitespace-nowrap ${activa === nombre ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}>{nombre}</button>
            ))}
          </div>
          <div className="space-y-2">
            {vista.menu.filter((plato) => plato.cat === activa).map((plato) => (
              <article key={`${plato.cat}-${plato.nombre}`} className="bg-white rounded-2xl p-4 flex justify-between gap-3 shadow-sm">
                <h2 className="font-bold">{plato.nombre}</h2>
                <span className="font-black">{dinero(plato.precio)}</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
