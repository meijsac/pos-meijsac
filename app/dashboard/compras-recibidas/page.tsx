"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import ModalRetencion, { type CompraRecibida } from "@/components/ModalRetencion"

export default function ComprasRecibidasPage() {
  const [compras, setCompras] = useState<CompraRecibida[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [periodo, setPeriodo] = useState("")
  const [compraSeleccionada, setCompraSeleccionada] = useState<CompraRecibida | null>(null)
  const [aviso, setAviso] = useState("")

  const cargarCompras = async () => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      if (busqueda) params.append("q", busqueda)
      if (periodo) params.append("periodo", periodo)
      const res = await fetch(`/api/compras-recibidas?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) { setAviso(data.mensaje || "No se pudieron cargar las compras."); return }
      if (Array.isArray(data)) setCompras(data)
    } catch {
      setAviso("No pude conectar con el servidor.")
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarCompras() }, [periodo])

  const importarTxt = async (archivo: File) => {
    const text = await archivo.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 5)
    if (!lines.length) return
    const delim = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ","
    const start = lines[0].toLowerCase().includes("ruc") ? 1 : 0
    const comprasTxt = []
    for (let i = start; i < lines.length; i++) {
      const cols = lines[i].split(delim).map((c) => c.replace(/"/g, "").trim())
      if (cols.length < 6) continue
      const ruc = cols.find((c) => /^[0-9]{13}$/.test(c)) || cols[0]
      const clave = (cols.find((c) => c.replace(/\D/g, "").length >= 49) || "").replace(/\D/g, "")
      const fecha = cols.find((c) => /\d{2}\/\d{2}\/\d{4}/.test(c)) || ""
      const numeros = cols.map((c) => parseFloat(c.replace(",", "."))).filter((n) => !Number.isNaN(n))
      const total = numeros.length ? numeros[numeros.length - 1] : 0
      const iva = numeros.length > 1 ? numeros[numeros.length - 2] : 0
      const base15 = iva > 0 ? Number((iva / 0.15).toFixed(2)) : 0
      const residuo = Number((total - base15 - iva).toFixed(2))
      const serie = cols.find((c) => /^\d{3}-\d{3}$/.test(c)) || "001-001"
      const secuencial = cols.find((c) => /^\d{9}$/.test(c)) || "000000001"
      comprasTxt.push({ id: `${Date.now()}-${i}`, claveAcceso: clave, proveedorRuc: ruc, proveedorNombre: cols[1] || "PROVEEDOR", numeroFactura: `${serie}-${secuencial}`, fechaEmision: fecha, subtotalIva0: residuo > 0 ? residuo : 0, subtotalIva15: base15, valorIva: iva, totalFactura: total, sustento: "01", tipo: "01 - FACTURA" })
    }
    const res = await fetch("/api/compras-recibidas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ compras: comprasTxt }) })
    const data = await res.json()
    if (!res.ok && !data.guardadas) setAviso(data.mensaje || "No se importó el archivo.")
    cargarCompras()
  }

  const handleEliminarCompra = async (id: string) => {
    if (!confirm("¿Deseas eliminar este registro de compra?")) return
    const res = await fetch(`/api/compras-recibidas/${id}`, { method: "DELETE" })
    const data = await res.json().catch(() => ({}))
    if (res.ok) setCompras(compras.filter((c) => c.id !== id))
    else setAviso(data.mensaje || "No se pudo eliminar el registro.")
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 p-6 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/comprobantes" className="text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl">← Panel</Link>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
              <h1 className="text-lg font-semibold text-white tracking-wide">Compras y Retenciones</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Facturas recibidas de proveedores y emisión de comprobantes de retención</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <form onSubmit={(e) => { e.preventDefault(); cargarCompras() }} className="flex-1 md:w-64">
            <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar proveedor, RUC o factura..." className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-teal-400 outline-none" />
          </form>
          <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="bg-[#111827] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-teal-400 outline-none" />
          <a href={`/api/ats/exportar?periodo=${periodo}`} className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3.5 py-2 rounded-xl text-xs font-medium">Exportar ATS</a>
          <label className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer">
            Importar TXT
            <input type="file" accept=".txt,.csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) importarTxt(file) }} />
          </label>
          <Link href="/dashboard/compras-recibidas/nueva" className="bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-lg shadow-teal-500/10">+ Registrar compra</Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {aviso && <p className="mb-4 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">{aviso}</p>}
        {cargando ? (
          <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-12 text-center text-xs text-slate-400">Cargando facturas recibidas...</div>
        ) : compras.length === 0 ? (
          <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-12 text-center space-y-2">
            <p className="text-sm font-medium text-white">No hay compras registradas en este periodo</p>
            <p className="text-xs text-slate-400">Importa tus archivos TXT del SRI o registra una factura manualmente para emitir su retención.</p>
          </div>
        ) : (
          <div className="bg-[#111827] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0B0F19]/60 border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                    <th className="py-3.5 px-5 font-medium">Proveedor</th>
                    <th className="py-3.5 px-4 font-medium">Comprobante</th>
                    <th className="py-3.5 px-4 font-medium">Fecha</th>
                    <th className="py-3.5 px-4 font-medium text-right">Subtotal</th>
                    <th className="py-3.5 px-4 font-medium text-right">IVA</th>
                    <th className="py-3.5 px-4 font-medium text-right">Total</th>
                    <th className="py-3.5 px-5 font-medium text-right">Estado / Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {compras.map((compra) => (
                    <tr key={compra.id} className="hover:bg-slate-800/30">
                      <td className="py-4 px-5"><p className="font-semibold text-white">{compra.proveedorNombre}</p><p className="text-[11px] text-slate-400 font-mono mt-0.5">RUC: {compra.proveedorRuc}</p></td>
                      <td className="py-4 px-4"><span className="font-mono text-slate-200 bg-[#0B0F19] px-2.5 py-1 rounded-lg border border-slate-800">{compra.numeroFactura}</span></td>
                      <td className="py-4 px-4 text-slate-300 font-mono">{compra.fechaEmision}</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-300">${Number(compra.baseImponible).toFixed(2)}</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-400">${Number(compra.valorIva).toFixed(2)}</td>
                      <td className="py-4 px-4 text-right font-mono font-semibold text-white">${Number(compra.totalFactura).toFixed(2)}</td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {compra.estadoRetencion === "POR_RETENER" ? (
                            <button onClick={() => setCompraSeleccionada(compra)} className="bg-teal-500/10 hover:bg-teal-400 text-teal-400 hover:text-slate-950 border border-teal-500/30 font-semibold px-3.5 py-1.5 rounded-xl text-[11px]">Emitir retención</button>
                          ) : compra.claveRetencion ? (
                            <Link href={`/dashboard/factura-xml/visor/${compra.claveRetencion}`} className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3.5 py-1.5 rounded-xl text-[11px] font-medium">Ver retención</Link>
                          ) : <span className="text-[11px] text-slate-400">Retenido</span>}
                          <button onClick={() => handleEliminarCompra(compra.id)} title="Eliminar registro" className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800/60">✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {compraSeleccionada && <ModalRetencion compra={compraSeleccionada} onClose={() => setCompraSeleccionada(null)} />}
    </div>
  )
}
