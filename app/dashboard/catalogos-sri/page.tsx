"use client"

import { useEffect, useState } from "react"

type Fila = {
  id: string
  grupo: string
  codigo: string
  descripcion: string
  porcentaje: number
  vigente: boolean
  actualizadoEn: string
  actualizadoPor: string
}

type Cambio = {
  id: string
  grupo: string
  codigo: string
  fecha: string
  usuario: string
  antes: string
  despues: string
}

const GRUPOS = [
  { id: "IVA", nombre: "IVA" },
  { id: "RETENCION_RENTA", nombre: "Retención renta" },
  { id: "RETENCION_IVA", nombre: "Retención IVA" },
]

export default function CatalogosSriPage() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [cambios, setCambios] = useState<Cambio[]>([])
  const [aviso, setAviso] = useState("")
  const [nuevo, setNuevo] = useState({ grupo: "IVA", codigo: "", descripcion: "", porcentaje: "" })

  async function cargar() {
    const res = await fetch("/api/catalogos-sri", { cache: "no-store" })
    const data = await res.json()
    if (!res.ok) {
      setAviso(data.error || "No pude leer los catálogos")
      return
    }
    setFilas(Array.isArray(data.filas) ? data.filas : [])
    setCambios(Array.isArray(data.cambios) ? data.cambios : [])
  }

  useEffect(() => { cargar() }, [])

  async function guardar(fila: Fila) {
    const res = await fetch("/api/catalogos-sri", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fila),
    })
    const data = await res.json()
    setAviso(res.ok ? "Catálogo actualizado" : (data.error || "No se pudo guardar"))
    if (res.ok) cargar()
  }

  async function agregar() {
    const res = await fetch("/api/catalogos-sri", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...nuevo, porcentaje: Number(nuevo.porcentaje) }),
    })
    const data = await res.json()
    setAviso(res.ok ? "Código agregado" : (data.error || "No se pudo agregar"))
    if (res.ok) {
      setNuevo({ grupo: nuevo.grupo, codigo: "", descripcion: "", porcentaje: "" })
      cargar()
    }
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-white p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-black">Catálogos SRI</h1>
          <button onClick={() => location.href = "/dashboard"} className="text-xs bg-white/10 px-3 py-2 rounded-xl">Panel</button>
        </div>
        {aviso && <p className="text-sm text-[#00f5d4]">{aviso}</p>}
        {GRUPOS.map((grupo) => (
          <section key={grupo.id} className="bg-[#11131a] border border-white/10 rounded-2xl p-4">
            <h2 className="text-xs font-black tracking-widest text-[#00f5d4] mb-3">{grupo.nombre}</h2>
            <div className="space-y-2">
              {filas.filter((fila) => fila.grupo === grupo.id).map((fila) => (
                <div key={fila.id} className="grid md:grid-cols-12 gap-2 items-center">
                  <p className="md:col-span-2 font-mono text-sm">{fila.codigo}</p>
                  <input value={fila.descripcion} onChange={(e) => setFilas(filas.map((item) => item.id === fila.id ? { ...item, descripcion: e.target.value } : item))} className="md:col-span-4 bg-black border border-white/10 rounded-lg px-2 py-2 text-xs" />
                  <input type="number" value={fila.porcentaje} onChange={(e) => setFilas(filas.map((item) => item.id === fila.id ? { ...item, porcentaje: Number(e.target.value) } : item))} className="md:col-span-2 bg-black border border-white/10 rounded-lg px-2 py-2 text-xs" />
                  <label className="md:col-span-2 text-[11px] flex items-center gap-2">
                    <input type="checkbox" checked={fila.vigente} onChange={(e) => setFilas(filas.map((item) => item.id === fila.id ? { ...item, vigente: e.target.checked } : item))} />
                    Vigente
                  </label>
                  <button onClick={() => guardar(fila)} className="md:col-span-2 bg-[#00f5d4] text-black rounded-lg py-2 text-[11px] font-black">Guardar</button>
                  <p className="md:col-span-12 text-[10px] text-white/40">{new Date(fila.actualizadoEn).toLocaleString("es-EC")} · {fila.actualizadoPor || "sistema"}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
        <section className="bg-[#11131a] border border-white/10 rounded-2xl p-4">
          <h2 className="text-xs font-black tracking-widest mb-3">Agregar código</h2>
          <div className="grid md:grid-cols-5 gap-2">
            <select value={nuevo.grupo} onChange={(e) => setNuevo({ ...nuevo, grupo: e.target.value })} className="bg-black border border-white/10 rounded-lg px-2 py-2 text-xs">
              {GRUPOS.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>)}
            </select>
            <input value={nuevo.codigo} onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value })} placeholder="Código" className="bg-black border border-white/10 rounded-lg px-2 py-2 text-xs" />
            <input value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} placeholder="Descripción" className="bg-black border border-white/10 rounded-lg px-2 py-2 text-xs" />
            <input value={nuevo.porcentaje} onChange={(e) => setNuevo({ ...nuevo, porcentaje: e.target.value })} placeholder="%" className="bg-black border border-white/10 rounded-lg px-2 py-2 text-xs" />
            <button onClick={agregar} className="bg-white text-black rounded-lg text-xs font-black">Agregar</button>
          </div>
        </section>
        <section className="bg-[#11131a] border border-white/10 rounded-2xl p-4">
          <h2 className="text-xs font-black tracking-widest mb-3">Cambios</h2>
          <div className="space-y-2">
            {cambios.map((cambio) => (
              <p key={cambio.id} className="text-[11px] text-white/70">
                {new Date(cambio.fecha).toLocaleString("es-EC")} · {cambio.usuario} · {cambio.grupo} {cambio.codigo}: {cambio.antes || "nuevo"} → {cambio.despues}
              </p>
            ))}
            {!cambios.length && <p className="text-[11px] text-white/40">Todavía no hay cambios.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
