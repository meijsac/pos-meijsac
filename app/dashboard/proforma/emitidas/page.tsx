"use client"
import { useEffect, useState } from "react"

type Fila = { id: string; numero: string; estado: string; fecha: string; cliente: string; total: number }

export default function ProformasEmitidasPage() {
  const [lista, setLista] = useState<Fila[]>([])
  const [abierta, setAbierta] = useState("")
  const [correos, setCorreos] = useState("")
  const [aviso, setAviso] = useState("")
  const [enviando, setEnviando] = useState("")

  const cargar = () => {
    fetch("/api/proformas", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setLista(data) })
      .catch(() => {})
  }

  useEffect(() => { cargar() }, [])

  const convertir = async (fila: Fila) => {
    const res = await fetch(`/api/proformas/${fila.id}/convertir`, { method: "POST", credentials: "same-origin" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setAviso(data.error || "No se pudo abrir en el facturador"); return }
    sessionStorage.setItem("meijsac_proforma_factura", JSON.stringify({ cliente: data.cliente, items: data.items, propina: data.propina }))
    window.location.href = "/dashboard/factura-xml"
  }

  const enviar = async (id: string) => {
    setEnviando(id)
    setAviso("")
    try {
      const res = await fetch(`/api/proformas/${id}/correo`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correos }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setAviso(data.error || "No se envió"); return }
      setAviso(`Enviado a ${Array.isArray(data.enviados) ? data.enviados.join(", ") : "los correos escritos"}`)
      setAbierta("")
      setCorreos("")
    } finally {
      setEnviando("")
    }
  }

  return (
    <div className="min-h-screen bg-[#080a0f] text-white p-4">
      <div className="max-w-7xl mx-auto flex flex-wrap gap-2 mb-4">
        <a href="/dashboard/proforma" className="bg-[#1e293b] border border-white/10 px-4 py-2 rounded-full text-[11px] font-bold">Proforma</a>
        <a href="/dashboard/factura-xml" className="bg-[#1e293b] border border-white/10 px-4 py-2 rounded-full text-[11px] font-bold">Facturador</a>
      </div>
      <div className="max-w-7xl mx-auto">
        <h1 className="font-black text-lg mb-3">Proformas emitidas</h1>
        {aviso && <p className="mb-3 text-[12px] text-amber-200">{aviso}</p>}
        <div className="space-y-2">
          {lista.map((fila) => (
            <div key={fila.id} className="bg-[#1e293b] border border-white/10 rounded-xl p-3">
              <div className="flex flex-wrap items-center gap-3 text-[12px]">
                <b>No. {fila.numero}</b>
                <span>{fila.fecha}</span>
                <span className="flex-1">{fila.cliente}</span>
                <span>${Number(fila.total || 0).toFixed(2)}</span>
                <span>{fila.estado === "CONVERTIDA" ? "Pasada al facturador" : "Guardada"}</span>
                <a href={`/api/proformas/${fila.id}/pdf`} target="_blank" className="bg-teal-400 text-slate-950 px-3 py-1 rounded-lg font-bold">Ver / Imprimir</a>
                <button type="button" onClick={() => { void convertir(fila) }} className="border border-white/20 px-3 py-1 rounded-lg font-bold">Convertir en factura</button>
                <button type="button" onClick={() => { setAbierta(abierta === fila.id ? "" : fila.id); setCorreos(""); setAviso("") }} className="border border-white/20 px-3 py-1 rounded-lg font-bold">Enviar por correo</button>
              </div>
              {abierta === fila.id && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <input value={correos} onChange={(e) => setCorreos(e.target.value)} placeholder="Correos separados por coma" className="flex-1 min-w-[240px] bg-black border border-white/10 rounded-lg p-2 text-[12px]" />
                  <button type="button" disabled={enviando === fila.id} onClick={() => { void enviar(fila.id) }} className="bg-white text-black px-3 py-2 rounded-lg text-[12px] font-bold">{enviando === fila.id ? "Enviando..." : "Enviar"}</button>
                </div>
              )}
            </div>
          ))}
          {lista.length === 0 && <p className="text-[12px] text-white/50">Todavía no hay proformas guardadas.</p>}
        </div>
      </div>
    </div>
  )
}
