"use client"
import { useEffect, useState } from "react"
import { cargarEmpresaSesion } from "@/lib/sesion-cliente"
import { totalesProforma } from "@/lib/proforma/calculos"

type Item = {
  codigo: string
  descripcion: string
  cant: number
  pUnit: number
  descPorc: number
  codigoPorcentaje: string
  ice: number
  esPlastico: boolean
}

const TARIFAS = [
  { codigo: "4", nombre: "15%" },
  { codigo: "0", nombre: "0%" },
  { codigo: "5", nombre: "5%" },
  { codigo: "8", nombre: "8%" },
  { codigo: "6", nombre: "No objeto" },
  { codigo: "7", nombre: "Exento" },
]

function tarifaProducto(p: any) {
  const t = String(p?.tipoIvaSRI ?? p?.codigoPorcentaje ?? "").trim().toUpperCase()
  if (t === "15%" || t === "15" || t === "4") return "4"
  if (t === "0%" || t === "0") return "0"
  if (t === "EXENTO" || t === "7") return "7"
  if (t === "NO_OBJETO" || t === "NO OBJETO" || t === "6") return "6"
  if (t === "5%" || t === "5") return "5"
  if (t === "8%" || t === "8") return "8"
  return ""
}

export default function ProformaPage() {
  const [emisor, setEmisor] = useState({ razon: "", ruc: "", matriz: "", regimen: "" })
  const [cliente, setCliente] = useState({ tipoDoc: "07", identificacion: "9999999999999", razon: "CONSUMIDOR FINAL", direccion: "", email: "", telefono: "" })
  const [coincidentes, setClientes] = useState<any[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [propina, setPropina] = useState(false)
  const [texto, setTexto] = useState("")
  const [catalogo, setCatalogo] = useState<any[]>([])
  const [sugerencias, setSugerencias] = useState<any[]>([])
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState("")

  useEffect(() => {
    let vivo = true
    cargarEmpresaSesion().then((empresa) => {
      if (!vivo || !empresa) return
      setEmisor({
        razon: String(empresa.razonSocial || empresa.razon || ""),
        ruc: String(empresa.ruc || ""),
        matriz: String(empresa.dirMatriz || empresa.direccion || ""),
        regimen: String(empresa.regimen || ""),
      })
    }).catch(() => {})
    fetch("/api/productos", { credentials: "same-origin" }).then((r) => r.json()).then((data) => {
      if (vivo && Array.isArray(data)) setCatalogo(data)
    }).catch(() => {})
    return () => { vivo = false }
  }, [])

  const buscarClientes = async (nombre: string) => {
    setCliente({ ...cliente, razon: nombre })
    const q = nombre.trim().toLowerCase()
    if (q.length < 2) { setClientes([]); return }
    const data = await fetch("/api/clientes", { credentials: "same-origin" }).then((r) => r.json()).catch(() => [])
    if (!Array.isArray(data)) return
    setClientes(data.filter((c) => `${c.razonSocial || ""} ${c.nombreComercial || ""}`.toLowerCase().includes(q)).slice(0, 30))
  }

  const plano = (p: any) => {
    const ficha = p?.ficha && typeof p.ficha === "object" ? p.ficha : {}
    return { ...ficha, ...p, tipoIvaSRI: ficha.tipoIvaSRI || p?.tipoIvaSRI, codigoPorcentaje: ficha.codigoPorcentaje || p?.codigoPorcentaje, precioMinorista: ficha.precioMinorista ?? p?.precio }
  }
  const buscarProductos = (q: string) => {
    setTexto(q)
    const busqueda = q.trim().toLowerCase()
    if (!busqueda) { setSugerencias([]); return }
    setSugerencias(catalogo.map(plano).filter((p) => `${p.nombre || ""} ${p.descripcion || ""} ${p.codigo || ""}`.toLowerCase().includes(busqueda)))
  }

  const agregar = (p: any) => {
    const codigoPorcentaje = tarifaProducto(p)
    if (!codigoPorcentaje) { setAviso("Ese producto no tiene tarifa IVA en Inventario."); return }
    const precio = Number(p.precioMinorista ?? p.precio ?? p.ficha?.precioMinorista ?? 0)
    if (!Number.isFinite(precio)) { setAviso("Ese producto no tiene precio."); return }
    setAviso("")
    setItems((prev) => [...prev, {
      codigo: String(p.codigo || ""),
      descripcion: String(p.nombre || p.descripcion || ""),
      cant: 1,
      pUnit: precio,
      descPorc: 0,
      codigoPorcentaje,
      ice: Number(p.porcIce) || 0,
      esPlastico: false,
    }])
    setTexto("")
    setSugerencias([])
  }

  const totales = totalesProforma(items, propina)

  const guardar = async () => {
    setGuardando(true)
    setAviso("")
    try {
      const res = await fetch("/api/proformas", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente, items, propina }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setAviso(data.error || "No se pudo guardar"); return }
      window.open(`/api/proformas/${data.id}/pdf`, "_blank")
      setItems([])
      setAviso(`Proforma ${data.numero} guardada. El PDF quedó listo para imprimir.`)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080a0f] text-white p-4">
      <div className="max-w-7xl mx-auto flex flex-wrap gap-2 mb-4">
        <a href="/dashboard/factura-xml" className="bg-[#1e293b] border border-white/10 px-4 py-2 rounded-full text-[11px] font-bold">Facturador</a>
        <a href="/dashboard/proforma/emitidas" className="bg-[#1e293b] border border-white/10 px-4 py-2 rounded-full text-[11px] font-bold">Proformas emitidas</a>
        <a href="/dashboard/comprobantes-adicionales" className="bg-[#1e293b] border border-white/10 px-4 py-2 rounded-full text-[11px] font-bold">Comprobantes adicionales</a>
      </div>
      <div className="max-w-7xl mx-auto bg-[#1e293b] border border-white/10 rounded-xl p-4 mb-3">
        <h1 className="font-black text-lg">Proforma</h1>
        <p className="text-[11px] text-white/70 mt-1">{emisor.razon || "Cargando empresa"}{emisor.ruc ? ` · RUC ${emisor.ruc}` : ""}</p>
        <p className="text-[11px] text-white/50">{emisor.matriz}{emisor.regimen ? ` · ${emisor.regimen}` : ""}</p>
        <p className="text-[11px] text-amber-200 mt-2">Este documento no se envía al SRI y no usa el secuencial de la factura.</p>
      </div>
      <div className="max-w-7xl mx-auto bg-[#0f172a] border border-white/10 rounded-xl p-4 mb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        <select value={cliente.tipoDoc} onChange={(e) => {
          const tipoDoc = e.target.value
          if (tipoDoc === "07") setCliente({ ...cliente, tipoDoc, identificacion: "9999999999999", razon: "CONSUMIDOR FINAL" })
          else setCliente({ ...cliente, tipoDoc, identificacion: cliente.identificacion === "9999999999999" ? "" : cliente.identificacion, razon: cliente.razon === "CONSUMIDOR FINAL" ? "" : cliente.razon })
        }} className="bg-black border border-white/10 rounded-lg p-2 text-[12px]">
          <option value="07">Consumidor final</option>
          <option value="05">Cédula</option>
          <option value="04">RUC</option>
          <option value="06">Pasaporte</option>
        </select>
        <input value={cliente.identificacion} onChange={(e) => setCliente({ ...cliente, identificacion: e.target.value })} placeholder="Identificación" className="bg-black border border-white/10 rounded-lg p-2 text-[12px]" />
        <div className="relative md:col-span-2">
          <input value={cliente.razon} onChange={(e) => { void buscarClientes(e.target.value) }} placeholder="Nombre / Razón social" className="w-full bg-black border border-white/10 rounded-lg p-2 text-[12px]" />
          {coincidentes.length > 0 && (
            <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-[#0f172a] border border-white/10 rounded-lg">
              {coincidentes.map((c) => (
                <button type="button" key={c.id || c.identificacion} onClick={() => { setCliente({ tipoDoc: c.tipoId || "04", identificacion: c.identificacion || "", razon: c.razonSocial || "", direccion: c.direccion || "", email: c.email || "", telefono: c.telefono || "" }); setClientes([]) }} className="block w-full text-left px-3 py-2 text-[12px] hover:bg-white/10">
                  {c.razonSocial} · {c.identificacion}
                </button>
              ))}
            </div>
          )}
        </div>
        <input value={cliente.direccion} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} placeholder="Dirección" className="bg-black border border-white/10 rounded-lg p-2 text-[12px]" />
        <input value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} placeholder="Correo" className="bg-black border border-white/10 rounded-lg p-2 text-[12px]" />
        <input value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} placeholder="Teléfono" className="bg-black border border-white/10 rounded-lg p-2 text-[12px]" />
      </div>
      <div className="max-w-7xl mx-auto bg-[#1e293b] border border-white/10 rounded-xl p-4">
        <div className="relative mb-3">
          <input value={texto} onChange={(e) => { void buscarProductos(e.target.value) }} placeholder="Código o nombre del producto" className="w-full bg-black border border-white/10 rounded-lg p-3 text-[13px]" />
          {sugerencias.length > 0 && (
            <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-[#0f172a] border border-teal-400/40 rounded-lg">
              {sugerencias.map((p, idx) => (
                <button type="button" key={`${p.codigo}-${idx}`} onClick={() => agregar(p)} className="w-full text-left px-3 py-2 border-b border-white/5 hover:bg-white/10">
                  <span className="text-[12px] font-bold">{p.nombre || p.descripcion}</span>
                  <span className="block text-[10px] text-white/40">{p.codigo} · ${Number(p.precioMinorista ?? p.precio ?? 0).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {items.map((item, i) => (
          <div key={`${item.codigo}-${i}`} className="grid grid-cols-12 gap-2 mb-2 text-[12px]">
            <div className="col-span-3 truncate">{item.descripcion}</div>
            <input className="col-span-2 bg-black rounded p-2" value={item.cant} onChange={(e) => setItems(items.map((fila, n) => n === i ? { ...fila, cant: Number(e.target.value) || 0 } : fila))} />
            <input className="col-span-2 bg-black rounded p-2" value={item.pUnit} onChange={(e) => setItems(items.map((fila, n) => n === i ? { ...fila, pUnit: Number(e.target.value) || 0 } : fila))} />
            <input className="col-span-1 bg-black rounded p-2" value={item.descPorc} onChange={(e) => setItems(items.map((fila, n) => n === i ? { ...fila, descPorc: Number(e.target.value) || 0 } : fila))} />
            <select className="col-span-2 bg-black rounded p-2" value={item.codigoPorcentaje} onChange={(e) => setItems(items.map((fila, n) => n === i ? { ...fila, codigoPorcentaje: e.target.value } : fila))}>
              {TARIFAS.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
            </select>
            <button type="button" onClick={() => setItems(items.filter((_, n) => n !== i))} className="col-span-2 text-red-300">Quitar</button>
          </div>
        ))}
        <label className="flex items-center gap-2 text-[12px] mt-3"><input type="checkbox" checked={propina} onChange={(e) => setPropina(e.target.checked)} /> Propina 10%</label>
        <div className="mt-3 text-[13px] space-y-1">
          <div>Subtotal ${totales.subtotalSin.toFixed(2)}</div>
          <div>IVA ${(totales.iva15 + totales.ivaDiferenciado).toFixed(2)}</div>
          {totales.valorICE > 0 && <div>ICE ${totales.valorICE.toFixed(2)}</div>}
          {totales.valorIRBPNR > 0 && <div>IRBPNR ${totales.valorIRBPNR.toFixed(2)}</div>}
          {propina && <div>Propina ${totales.propina.toFixed(2)}</div>}
          <div className="font-black">Total ${totales.total.toFixed(2)}</div>
        </div>
        {aviso && <p className="mt-3 text-[12px] text-amber-200">{aviso}</p>}
        <button type="button" disabled={guardando} onClick={() => { void guardar() }} className="mt-4 bg-teal-400 text-slate-950 font-bold px-4 py-3 rounded-xl text-[12px]">{guardando ? "Guardando..." : "Guardar proforma"}</button>
      </div>
    </div>
  )
}
