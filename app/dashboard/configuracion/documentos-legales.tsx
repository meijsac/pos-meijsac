"use client"
import { useEffect, useState } from "react"

const TIPOS = ["Firma Electrónica", "Permiso Bomberos", "Patente Municipal", "Permiso de Funcionamiento", "RUC", "LUAE", "Otro"]

type Doc = { id: string; tipo: string; nombre: string; fecha_emision: string; fecha_caducidad: string; archivo_url: string }

const vacio = { tipo: "Permiso Bomberos", tipoOtro: "", nombre: "", fecha_emision: "", fecha_caducidad: "", archivo_url: "" }

function estadoDoc(vence: string) {
  const dias = Math.ceil((new Date(vence).getTime() - Date.now()) / 86400000)
  if (dias < 0) return { texto: `VENCIDO - Venció hace ${Math.abs(dias)} días`, clase: "text-red-300" }
  if (dias <= 30) return { texto: `POR VENCER - Faltan ${dias} días`, clase: "text-amber-300" }
  return { texto: `AL DÍA - Vence en ${dias} días`, clase: "text-emerald-300" }
}

export default function DocumentosLegales() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [form, setForm] = useState(vacio)
  const [editId, setEditId] = useState<string | null>(null)
  const [aviso, setAviso] = useState("")
  const token = () => localStorage.getItem("meijsac_token") || ""

  const cargar = async () => {
    const res = await fetch("/api/documentos-legales", { headers: { Authorization: `Bearer ${token()}` } })
    const data = await res.json().catch(() => [])
    if (Array.isArray(data)) setDocs(data)
  }

  useEffect(() => { cargar() }, [])

  const archivo = (file?: File) => {
    if (!file) return
    const ok = ["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type)
    if (!ok) { setAviso("Sube un PDF, PNG, JPG o WEBP."); return }
    if (file.size > 2 * 1024 * 1024) { setAviso("El archivo es muy grande. El máximo es 2 MB."); return }
    const reader = new FileReader()
    reader.onload = () => { setForm((f) => ({ ...f, archivo_url: String(reader.result || "") })); setAviso("") }
    reader.readAsDataURL(file)
  }

  const guardar = async () => {
    const res = await fetch("/api/documentos-legales", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ ...form, id: editId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setAviso(data.error || "No se pudo guardar"); return }
    setForm(vacio)
    setEditId(null)
    setAviso("Documento guardado")
    cargar()
  }

  const editar = (d: Doc) => {
    const conocido = TIPOS.includes(d.tipo)
    setForm({ tipo: conocido ? d.tipo : "Otro", tipoOtro: conocido ? "" : d.tipo, nombre: d.nombre, fecha_emision: d.fecha_emision, fecha_caducidad: d.fecha_caducidad, archivo_url: d.archivo_url || "" })
    setEditId(d.id)
  }

  const eliminar = async (d: Doc) => {
    if (!confirm(`¿Seguro que quieres eliminar ${d.nombre}?`)) return
    await fetch(`/api/documentos-legales?id=${encodeURIComponent(d.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } })
    cargar()
  }

  return (
    <div className="space-y-4">
      <p className="text-[#00f5d4] font-bold text-[11px]">DOCUMENTOS LEGALES / CUMPLIMIENTO DOCUMENTAL</p>
      {aviso && <div className="text-xs text-amber-200">{aviso}</div>}
      <div className="grid md:grid-cols-2 gap-2">
        <label className="text-[10px]">Tipo de documento
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full bg-black border border-white/10 p-2 rounded-xl mt-1">
            {TIPOS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        {form.tipo === "Otro" && <label className="text-[10px]">Escribe el tipo<input value={form.tipoOtro} onChange={(e) => setForm({ ...form, tipoOtro: e.target.value })} className="w-full bg-black border border-white/10 p-2 rounded-xl mt-1" /></label>}
        <label className="text-[10px]">Nombre del documento<input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Permiso Bomberos 2026" className="w-full bg-black border border-white/10 p-2 rounded-xl mt-1" /></label>
        <label className="text-[10px]">Fecha de emisión<input type="date" value={form.fecha_emision} onChange={(e) => setForm({ ...form, fecha_emision: e.target.value })} className="w-full bg-black border border-white/10 p-2 rounded-xl mt-1" /></label>
        <label className="text-[10px]">Fecha de caducidad<input type="date" value={form.fecha_caducidad} onChange={(e) => setForm({ ...form, fecha_caducidad: e.target.value })} className="w-full bg-black border border-white/10 p-2 rounded-xl mt-1" /></label>
        <label className="text-[10px]">Archivo opcional (PDF o foto)
          <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => archivo(e.target.files?.[0])} className="w-full text-[10px] mt-1" />
        </label>
      </div>
      <p className="text-[10px] opacity-50">El estado se calcula solo con la fecha de caducidad.</p>
      <button onClick={guardar} className="bg-[#00f5d4] text-black font-black px-4 py-2 rounded-xl text-xs">{editId ? "GUARDAR CAMBIOS" : "AGREGAR DOCUMENTO"}</button>
      <div className="space-y-2">
        {docs.map((d) => {
          const est = estadoDoc(d.fecha_caducidad)
          return (
            <div key={d.id} className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-black/40 border border-white/10 rounded-xl p-3 text-xs">
              <div>
                <div className="font-black">{d.nombre}</div>
                <div className="opacity-60">{d.tipo} · Emisión {d.fecha_emision} · Caduca {d.fecha_caducidad}</div>
                <div className={est.clase}>{est.texto}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => editar(d)} className="bg-white/10 px-3 py-1 rounded-lg">EDITAR</button>
                <button onClick={() => eliminar(d)} className="bg-red-500/20 text-red-300 px-3 py-1 rounded-lg">ELIMINAR</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
