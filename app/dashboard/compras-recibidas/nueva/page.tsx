"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function NuevaCompraPage() {
  const router = useRouter()
  const [form, setForm] = useState<Record<string, string>>({ tipo: "01 - FACTURA", sustento: "01" })
  const [aviso, setAviso] = useState("")
  const nota = (form.tipo || "").includes("02")

  const guardar = async () => {
    const clave = String(form.claveAcceso || "").replace(/\D/g, "")
    if (clave.length !== 49) { setAviso("La clave de acceso debe tener 49 dígitos."); return }
    const res = await fetch("/api/compras-recibidas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claveAcceso: clave,
        proveedorRuc: form.ruc || "",
        proveedorNombre: form.razon || "",
        numeroFactura: form.numero || "",
        fechaEmision: form.fecha || "",
        subtotalNoObjeto: Number(form.noObjeto || 0),
        subtotalIva0: nota ? Number(form.total || 0) : Number(form.base0 || 0),
        subtotalIva15: nota ? 0 : Number(form.base15 || 0),
        subtotalExento: Number(form.exento || 0),
        valorIva: nota ? 0 : Number(form.iva || 0),
        totalFactura: Number(form.total || 0),
        sustento: form.sustento,
        tipo: form.tipo,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setAviso(data.mensaje || "No se pudo registrar la compra."); return }
    router.push("/dashboard/compras-recibidas")
  }

  const campo = "w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-400"
  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 p-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/dashboard/compras-recibidas" className="text-xs text-slate-400">← Compras</Link>
        <h1 className="text-lg font-semibold text-white mt-4">Registrar compra</h1>
        <p className="text-xs text-slate-400 mt-1">Factura recibida de un proveedor, lista para su retención.</p>
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 mt-5 space-y-3">
          {aviso && <p className="text-xs text-amber-200">{aviso}</p>}
          <label className="block text-[11px] text-slate-400">Clave de acceso de 49 dígitos<input value={form.claveAcceso || ""} onChange={(e) => setForm({ ...form, claveAcceso: e.target.value })} className={`${campo} mt-1`} /></label>
          <div className="grid md:grid-cols-2 gap-3">
            <input value={form.ruc || ""} onChange={(e) => setForm({ ...form, ruc: e.target.value })} placeholder="RUC del proveedor" className={campo} />
            <input value={form.razon || ""} onChange={(e) => setForm({ ...form, razon: e.target.value.toUpperCase() })} placeholder="Razón social" className={campo} />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <input value={form.numero || ""} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="001-001-000000001" className={campo} />
            <input type="date" value={form.fecha || ""} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={campo} />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={campo}><option>01 - FACTURA</option><option>02 - NOTA DE VENTA RIMPE POPULAR</option><option>04 - NOTA DE CREDITO</option></select>
            <select value={form.sustento} onChange={(e) => setForm({ ...form, sustento: e.target.value })} className={campo}><option value="01">Crédito tributario</option><option value="02">Costo o gasto</option><option value="03">Activo fijo</option></select>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-[11px] text-slate-400">Base no objeto<input type="number" value={form.noObjeto || ""} onChange={(e) => setForm({ ...form, noObjeto: e.target.value })} className={`${campo} mt-1`} /></label>
            <label className="text-[11px] text-slate-400">Base 0%<input type="number" value={form.base0 || ""} onChange={(e) => setForm({ ...form, base0: e.target.value })} className={`${campo} mt-1`} /></label>
            <label className="text-[11px] text-slate-400">Base 15%<input type="number" disabled={nota} value={nota ? "" : form.base15 || ""} onChange={(e) => setForm({ ...form, base15: e.target.value })} className={`${campo} mt-1`} /></label>
            <label className="text-[11px] text-slate-400">Base exenta<input type="number" value={form.exento || ""} onChange={(e) => setForm({ ...form, exento: e.target.value })} className={`${campo} mt-1`} /></label>
            <label className="text-[11px] text-slate-400">IVA<input type="number" disabled={nota} value={nota ? "0" : form.iva || ""} onChange={(e) => setForm({ ...form, iva: e.target.value })} className={`${campo} mt-1`} /></label>
            <label className="text-[11px] text-slate-400">Total<input type="number" value={form.total || ""} onChange={(e) => setForm({ ...form, total: e.target.value })} className={`${campo} mt-1`} /></label>
          </div>
          <button onClick={guardar} className="w-full py-3 rounded-xl text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300">Registrar compra</button>
        </div>
      </div>
    </div>
  )
}
