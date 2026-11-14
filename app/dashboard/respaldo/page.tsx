"use client"

import { useState } from "react"

type Fila = { id: string; fecha: string; cliente: string; numero: string; estado: string }

export default function RespaldoPage() {
  const [fecha, setFecha] = useState("")
  const [cliente, setCliente] = useState("")
  const [numero, setNumero] = useState("")
  const [filas, setFilas] = useState<Fila[]>([])
  const [aviso, setAviso] = useState("")

  async function buscar() {
    const params = new URLSearchParams()
    if (fecha) params.set("fecha", fecha)
    if (cliente) params.set("cliente", cliente)
    if (numero) params.set("numero", numero)
    const res = await fetch(`/api/respaldo/buscar?${params}`, { cache: "no-store" })
    const data = await res.json()
    if (!res.ok) {
      setAviso(data.error || "No pude buscar")
      setFilas([])
      return
    }
    setAviso("")
    setFilas(Array.isArray(data.filas) ? data.filas : [])
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-white p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-black">Respaldo / Restaurar</h1>
          <button onClick={() => location.href = "/dashboard"} className="text-xs bg-white/10 px-3 py-2 rounded-xl">Panel</button>
        </div>
        <p className="text-xs text-white/50">Busca por fecha, cliente o número de factura. La copia XML y PDF queda en el bucket privado y se renueva al abrir el panel y en la copia diaria.</p>
        <div className="grid md:grid-cols-4 gap-2">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="bg-black border border-white/10 rounded-xl px-3 py-3 text-xs" />
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Cliente" className="bg-black border border-white/10 rounded-xl px-3 py-3 text-xs" />
          <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Número de factura" className="bg-black border border-white/10 rounded-xl px-3 py-3 text-xs" />
          <button onClick={buscar} className="bg-[#00f5d4] text-black rounded-xl font-black text-xs">Buscar</button>
        </div>
        {aviso && <p className="text-sm text-amber-300">{aviso}</p>}
        <div className="space-y-2">
          {filas.map((fila) => (
            <div key={fila.id} className="bg-[#11131a] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[180px]">
                <p className="font-mono text-sm">{fila.numero || "Sin número"}</p>
                <p className="text-xs text-white/60">{fila.fecha} · {fila.cliente || "Sin cliente"} · {fila.estado}</p>
              </div>
              <a className="bg-white text-black px-3 py-2 rounded-xl text-[11px] font-black" href={`/api/respaldo/archivo?id=${fila.id}&tipo=xml`}>XML</a>
              <a className="bg-[#00f5d4] text-black px-3 py-2 rounded-xl text-[11px] font-black" href={`/api/respaldo/archivo?id=${fila.id}&tipo=pdf`}>PDF</a>
            </div>
          ))}
          {!filas.length && <p className="text-xs text-white/40">Busca para ver las facturas de esta empresa.</p>}
        </div>
      </div>
    </div>
  )
}
