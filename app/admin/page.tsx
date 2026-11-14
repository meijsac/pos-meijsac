"use client"
import { useEffect, useMemo, useState } from "react"

type Plan = {
  id: string
  nombre: string
  descripcion: string
  precio: number
  precioAnual: number
  duracionDias: number
  trialDias: number
  limiteComprobantes: number
  limiteUsuarios: number
  documentosAnio: number
  badge: string
  activo: boolean
}

type Cliente = {
  id: string
  ruc: string
  razonSocial: string
  planId: string | null
  planNombre: string
  planEstado: string
  estado: string
  planFin: string | null
  firmaExpira: string | null
  comprobantesUsados: number
  limiteComprobantes: number
}

const vacio = {
  nombre: "",
  descripcion: "",
  precio: 0,
  precioAnual: 0,
  duracionDias: 365,
  trialDias: 0,
  limiteComprobantes: 15,
  limiteUsuarios: 1,
  documentosAnio: 15,
  badge: "",
  activo: true,
}

export default function AdminModuladorCompleto() {
  const [logado, setLogado] = useState(false)
  const [user, setUser] = useState("")
  const [pass, setPass] = useState("")
  const [tab, setTab] = useState<"dash" | "planes" | "clientes" | "crear">("planes")
  const [centro, setCentro] = useState(false)
  const [planes, setPlanes] = useState<Plan[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtro, setFiltro] = useState("")
  const [aviso, setAviso] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(vacio)
  const [elegido, setElegido] = useState<Record<string, string>>({})

  const entrar = async () => {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: user.trim(), pass }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data.error || "Acceso denegado")
      return
    }
    setLogado(true)
  }

  const cargar = async () => {
    const [rp, re] = await Promise.all([fetch("/api/admin/planes"), fetch("/api/admin/empresas")])
    const planesData = await rp.json().catch(() => [])
    const clientesData = await re.json().catch(() => [])
    if (Array.isArray(planesData)) {
      setPlanes(planesData.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion || "",
        precio: Number(p.precio || 0),
        precioAnual: Number(p.precioAnual || 0),
        duracionDias: Number(p.duracionDias || 365),
        trialDias: Number(p.trialDias || 0),
        limiteComprobantes: Number(p.limiteComprobantes || 0),
        limiteUsuarios: Number(p.limiteUsuarios || 1),
        documentosAnio: Number(p.documentosAnio || p.limiteComprobantes || 0),
        badge: p.badge || "",
        activo: p.activo !== false,
      })))
    }
    if (Array.isArray(clientesData)) setClientes(clientesData)
  }

  useEffect(() => {
    if (logado) cargar()
  }, [logado])

  const guardarPlan = async () => {
    const payload = { ...form, id: editId || undefined }
    const res = await fetch("/api/admin/planes", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setAviso(data.error || "No se pudo guardar el plan")
      return
    }
    setEditId(null)
    setForm(vacio)
    setTab("planes")
    setAviso("Plan guardado")
    await cargar()
  }

  const editar = (p: Plan) => {
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: p.precio,
      precioAnual: p.precioAnual,
      duracionDias: p.duracionDias,
      trialDias: p.trialDias,
      limiteComprobantes: p.limiteComprobantes,
      limiteUsuarios: p.limiteUsuarios,
      documentosAnio: p.documentosAnio,
      badge: p.badge,
      activo: p.activo,
    })
    setEditId(p.id)
    setTab("crear")
    setAviso("")
  }

  const eliminar = async (p: Plan) => {
    if (!confirm(`¿Seguro que quieres eliminar ${p.nombre}?`)) return
    const res = await fetch(`/api/admin/planes?id=${encodeURIComponent(p.id)}`, { method: "DELETE" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setAviso(data.error || "No se pudo eliminar")
      return
    }
    setAviso("")
    await cargar()
  }

  const alternar = async (p: Plan) => {
    const res = await fetch("/api/admin/planes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, activo: !p.activo }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setAviso(data.error || "No se pudo cambiar el estado")
      return
    }
    await cargar()
  }

  const accionCliente = async (id: string, accion: string, planId?: string) => {
    const res = await fetch("/api/admin/suscripcion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, accion, planId, metodoPago: "manual" }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setAviso(data.error || "No se pudo actualizar el cliente")
      return
    }
    setAviso("Plan cargado. El cliente queda activo y puede entrar al sistema.")
    await cargar()
  }

  const activos = planes.filter((p) => p.activo)
  const filtrados = clientes.filter((c) => `${c.ruc} ${c.razonSocial}`.toLowerCase().includes(filtro.toLowerCase()))
  const mrr = useMemo(() => clientes.reduce((acc, c) => acc + (planes.find((p) => p.id === c.planId)?.precio || 0), 0), [clientes, planes])

  if (!logado) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h1 className="font-black text-white">MEIJSAC SUPER ADMIN</h1>
        <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Usuario" className="w-full p-3 rounded-xl bg-black border border-white/10 text-white text-sm" />
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Contraseña" className="w-full p-3 rounded-xl bg-black border border-white/10 text-white text-sm" />
        <button type="button" onClick={entrar} className="w-full py-3 rounded-xl bg-[#00f5d4] text-black font-black">ENTRAR</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex justify-between items-center"><h1 className="text-xl font-black">MODULADOR COMPLETO</h1><button onClick={() => setLogado(false)} className="text-xs bg-white/10 px-3 py-1 rounded">Salir</button></div>
        <div className="flex gap-2 flex-wrap">{(["dash", "planes", "clientes", "crear"] as const).map((t) => <button key={t} onClick={() => { setCentro(false); setTab(t); if (t === "crear" && !editId) setForm(vacio) }} className={`px-4 py-2 rounded-xl text-xs font-black ${!centro && tab === t ? "bg-[#00f5d4] text-black" : "bg-white/10"}`}>{t === "dash" ? "DASHBOARD" : t === "planes" ? "PLANES" : t === "clientes" ? "CLIENTES / SUSCRIPCIONES" : editId ? "EDITAR PLAN" : "CREAR PLAN"}</button>)}</div>
        <button type="button" onClick={() => setCentro(true)} className={`max-w-sm bg-white/5 border rounded-2xl px-4 py-4 flex items-center gap-3 text-left ${centro ? "border-[#00f5d4]" : "border-white/10"}`}>
          <span className="text-2xl" aria-hidden="true">📁</span>
          <span>
            <span className="block text-[11px] font-black tracking-widest">CENTRO DE CONTROL MODULAR</span>
            <span className="block text-[10px] text-white/50">Activar o desactivar secciones y carpetas</span>
          </span>
        </button>
        {aviso && <div className="bg-amber-500/10 border border-amber-400/30 text-amber-200 text-xs p-3 rounded-xl">{aviso}</div>}

        {centro && <CentroModular />}

        {!centro && tab === "dash" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-white/5 p-4 rounded-xl"><div className="text-[10px] opacity-50">MRR ESTIMADO</div><div className="font-black text-xl">${mrr.toFixed(2)}</div></div>
            <div className="bg-white/5 p-4 rounded-xl"><div className="text-[10px] opacity-50">CLIENTES</div><div className="font-black text-xl">{clientes.length}</div></div>
            <div className="bg-emerald-500/10 p-4 rounded-xl"><div className="text-[10px] opacity-50">ACTIVOS</div><div className="font-black text-xl">{clientes.filter((c) => c.estado === "ACTIVO").length}</div></div>
            <div className="bg-red-500/10 p-4 rounded-xl"><div className="text-[10px] opacity-50">BLOQUEADOS</div><div className="font-black text-xl">{clientes.filter((c) => c.estado === "BLOQUEADO").length}</div></div>
          </div>
        )}

        {!centro && tab === "planes" && (
          <div className="grid gap-2">{planes.map((p) => (
            <div key={p.id} className="bg-white/5 p-4 rounded-xl flex flex-col md:flex-row md:justify-between md:items-center gap-3">
              <div>
                <div className="font-bold">{p.nombre} {p.badge && <span className="bg-[#00f5d4] text-black text-[9px] px-1 rounded">{p.badge}</span>}</div>
                <div className="text-[11px] opacity-60">{p.descripcion} | {p.documentosAnio} documentos / año | ${p.precio} mensual | ${p.precioAnual} anual | Trial {p.trialDias}d | Facturas: {p.limiteComprobantes} | Usuarios: {p.limiteUsuarios}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => editar(p)} className="px-3 py-1 rounded text-xs font-black bg-white/10">EDITAR</button>
                <button onClick={() => eliminar(p)} className="px-3 py-1 rounded text-xs font-black bg-red-500/20 text-red-300">ELIMINAR</button>
                <button onClick={() => alternar(p)} className={`px-3 py-1 rounded text-xs font-black ${p.activo ? "bg-[#00f5d4] text-black" : "bg-white/10"}`}>{p.activo ? "ACTIVO" : "INACTIVO"}</button>
              </div>
            </div>
          ))}</div>
        )}

        {!centro && tab === "crear" && (
          <div className="bg-white/5 p-4 rounded-xl space-y-3 max-w-xl">
            <h3 className="font-black">{editId ? "EDITAR PLAN" : "CREAR PLAN"}</h3>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre" className="w-full p-3 rounded bg-black border border-white/10 text-sm" />
            <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción" className="w-full p-3 rounded bg-black border border-white/10 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">Precio mensual<input type="number" value={form.precio} onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })} className="w-full p-2 rounded bg-black border border-white/10" /></label>
              <label className="text-xs">Precio anual<input type="number" value={form.precioAnual} onChange={(e) => setForm({ ...form, precioAnual: Number(e.target.value) })} className="w-full p-2 rounded bg-black border border-white/10" /></label>
              <label className="text-xs">Trial días<input type="number" value={form.trialDias} onChange={(e) => setForm({ ...form, trialDias: Number(e.target.value) })} className="w-full p-2 rounded bg-black border border-white/10" /></label>
              <label className="text-xs">Duración días<input type="number" value={form.duracionDias} onChange={(e) => setForm({ ...form, duracionDias: Number(e.target.value) })} className="w-full p-2 rounded bg-black border border-white/10" /></label>
              <label className="text-xs">Facturas<input type="number" value={form.limiteComprobantes} onChange={(e) => setForm({ ...form, limiteComprobantes: Number(e.target.value) })} className="w-full p-2 rounded bg-black border border-white/10" /></label>
              <label className="text-xs">Usuarios<input type="number" value={form.limiteUsuarios} onChange={(e) => setForm({ ...form, limiteUsuarios: Number(e.target.value) })} className="w-full p-2 rounded bg-black border border-white/10" /></label>
              <label className="text-xs">Documentos / año<input type="number" value={form.documentosAnio} onChange={(e) => setForm({ ...form, documentosAnio: Number(e.target.value) })} className="w-full p-2 rounded bg-black border border-white/10" /></label>
              <label className="text-xs">Tipo<select value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} className="w-full p-2 rounded bg-black border border-white/10"><option value="">Normal</option><option value="Popular">Popular</option><option value="Más popular">Más popular</option><option value="Gratuito">Gratuito</option></select></label>
            </div>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activo</label>
            <button onClick={guardarPlan} className="w-full py-3 bg-[#00f5d4] text-black font-black rounded-xl">{editId ? "GUARDAR CAMBIOS" : "CREAR PLAN"}</button>
          </div>
        )}

        {!centro && tab === "clientes" && (
          <div className="space-y-3">
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar por RUC o razón" className="w-full p-3 rounded-xl bg-black border border-white/10 text-sm" />
            <div className="overflow-x-auto bg-white/5 rounded-xl border border-white/10">
              <table className="w-full text-[11px]">
                <thead><tr className="text-left opacity-50 text-[10px]"><th className="p-2">CLIENTE</th><th>PLAN</th><th>ESTADO</th><th>VENCE</th><th>ACCIONES</th></tr></thead>
                <tbody>{filtrados.map((c) => (
                  <tr key={c.id} className="border-t border-white/5 align-top">
                    <td className="p-2"><div className="font-bold">{c.razonSocial}</div><div className="opacity-60">{c.ruc}</div></td>
                    <td className="p-2">{c.planNombre || "Sin plan"}</td>
                    <td className="p-2">{c.planEstado} / {c.estado}</td>
                    <td className="p-2">{c.planFin ? String(c.planFin).slice(0, 10) : "—"}</td>
                    <td className="p-2 space-y-2">
                      <div className="flex gap-1 flex-wrap">
                        <select value={elegido[c.id] || c.planId || ""} onChange={(e) => setElegido({ ...elegido, [c.id]: e.target.value })} className="bg-black border border-white/10 rounded px-1 py-1">
                          <option value="">Elegir plan</option>
                          {activos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                        <button onClick={() => accionCliente(c.id, "asignar", elegido[c.id] || c.planId || "")} className="bg-[#00f5d4] text-black px-2 py-1 rounded font-black">CAMBIAR PLAN / ASIGNAR PLAN</button>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => accionCliente(c.id, "suspender")} className="bg-red-500/20 text-red-300 px-2 py-1 rounded">SUSPENDER</button>
                        <button onClick={() => accionCliente(c.id, "reactivar")} className="bg-white/10 px-2 py-1 rounded">REACTIVAR</button>
                        <button onClick={() => accionCliente(c.id, "inicial")} className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">REACTIVAR CON PLAN INICIAL</button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const SECCIONES = [
  "Comprobantes electrónicos",
  "POS Ticket",
  "Restaurante POS",
  "Contabilidad",
  "Cuentas por cobrar",
  "Inventario",
  "Caja",
  "Clientes",
  "Reportes",
  "Comprobantes adicionales",
  "Respaldo / Restaurar",
]

const CARPETAS = [
  "Identidad",
  "Firma",
  "Secuenciales",
  "Impuestos",
  "Inventario",
  "Seguridad",
  "WhatsApp",
  "Respaldo",
  "Marca RIDE",
  "Documentos",
  "Permisos",
  "Ambiente SRI",
  "Catálogo SRI",
]

function CentroModular() {
  const [activos, setActivos] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let guardado: Record<string, boolean> = {}
    try { guardado = JSON.parse(localStorage.getItem("meijsac_modulos_activos") || "{}") } catch { guardado = {} }
    const base: Record<string, boolean> = {}
    for (const nombre of [...SECCIONES, ...CARPETAS]) base[nombre] = guardado[nombre] !== false
    setActivos(base)
  }, [])

  function cambiar(nombre: string) {
    setActivos((prev) => {
      const siguiente = { ...prev, [nombre]: !prev[nombre] }
      localStorage.setItem("meijsac_modulos_activos", JSON.stringify(siguiente))
      return siguiente
    })
  }

  const lista = (titulo: string, nombres: string[]) => (
    <section className="bg-white/5 border border-white/10 rounded-2xl">
      <h2 className="px-4 pt-4 text-[11px] font-black tracking-widest text-[#00f5d4]">{titulo}</h2>
      <div className="divide-y divide-white/5">
        {nombres.map((nombre) => (
          <label key={nombre} className="flex items-center justify-between px-4 py-3 cursor-pointer">
            <span className="text-sm">{nombre}</span>
            <input type="checkbox" checked={activos[nombre] !== false} onChange={() => cambiar(nombre)} className="accent-[#00f5d4] w-4 h-4" />
          </label>
        ))}
      </div>
    </section>
  )

  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-lg font-black">Centro de Control Modular</h2>
      {lista("SECCIONES", SECCIONES)}
      {lista("CARPETAS", CARPETAS)}
    </div>
  )
}
