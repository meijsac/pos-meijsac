"use client"
import { useEffect, useMemo, useState } from "react"
import { CARPETAS_PLAN, MODULOS_MEIJSAC } from "@/lib/suscripcion"

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
  modulos: string[]
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
  comprobantesEmitidos: number
  limiteComprobantes: number
  vence: string | null
}

const vacio: Omit<Plan, "id"> = {
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
  modulos: [...MODULOS_MEIJSAC, ...CARPETAS_PLAN],
}

function diasHasta(fecha: string | null) {
  if (!fecha) return null
  const momento = new Date(fecha).getTime()
  if (!Number.isFinite(momento)) return null
  return Math.ceil((momento - Date.now()) / 86400000)
}

function textoCaducidad(fecha: string | null) {
  const dias = diasHasta(fecha)
  if (dias === null) return "Sin fecha"
  const dia = String(fecha).slice(0, 10)
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? "" : "s"} · ${dia}`
  if (dias === 0) return `Caduca hoy · ${dia}`
  return `Faltan ${dias} día${dias === 1 ? "" : "s"} · ${dia}`
}

function textoQuedan(usados: number, limite: number) {
  if (limite < 0) return "Sin límite"
  const quedan = limite - usados
  if (quedan < 0) return `Pasó el límite por ${Math.abs(quedan)}`
  return `${quedan} de ${limite}`
}

const campo = "w-full rounded-xl border border-cyan-300/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
const panel = "rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_0_40px_rgba(0,245,212,0.05)] backdrop-blur"

export default function AdminModuladorCompleto() {
  const [logado, setLogado] = useState(false)
  const [user, setUser] = useState("")
  const [pass, setPass] = useState("")
  const [tab, setTab] = useState<"dash" | "planes" | "clientes" | "crear">("planes")
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

  const salir = async () => {
    await fetch("/api/admin/login", { method: "DELETE" }).catch(() => null)
    setLogado(false)
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
        modulos: Array.isArray(p.modulos) ? p.modulos.map((m: unknown) => String(m)) : [],
      })))
    }
    if (Array.isArray(clientesData)) setClientes(clientesData)
    if (!Array.isArray(planesData) || !Array.isArray(clientesData)) {
      const fallo = (!Array.isArray(planesData) && planesData?.error) || (!Array.isArray(clientesData) && clientesData?.error) || "No se pudieron cargar los datos"
      setAviso(String(fallo))
    }
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
      modulos: p.modulos,
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

  const metricas = [
    { etiqueta: "MRR estimado", valor: `$${mrr.toFixed(2)}`, tono: "text-cyan-200" },
    { etiqueta: "Clientes", valor: String(clientes.length), tono: "text-white" },
    { etiqueta: "Activos", valor: String(clientes.filter((c) => c.estado === "ACTIVO").length), tono: "text-emerald-300" },
    { etiqueta: "Bloqueados", valor: String(clientes.filter((c) => c.estado === "BLOQUEADO").length), tono: "text-rose-300" },
    { etiqueta: "Caducan en 7 días", valor: String(clientes.filter((c) => { const dias = diasHasta(c.vence || c.planFin); return dias !== null && dias >= 0 && dias <= 7 }).length), tono: "text-amber-200" },
    { etiqueta: "Quedan pocos comprobantes", valor: String(clientes.filter((c) => c.limiteComprobantes >= 0 && c.limiteComprobantes - (c.comprobantesEmitidos || 0) <= Math.max(1, Math.ceil(c.limiteComprobantes * 0.1))).length), tono: "text-amber-200" },
  ]

  if (!logado) return (
    <div className="min-h-screen bg-[#05070d] bg-[radial-gradient(ellipse_at_top,rgba(0,245,212,0.16),transparent_42%),radial-gradient(ellipse_at_bottom,rgba(99,102,241,0.2),transparent_46%)] text-white flex items-center justify-center p-6">
      <form onSubmit={(e) => { e.preventDefault(); entrar() }} className={`${panel} w-full max-w-md p-8 space-y-5`}>
        <div>
          <p className="text-[11px] tracking-[0.35em] text-cyan-300/80">MEIJSAC</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Centro de control</h1>
          <p className="mt-2 text-sm text-white/55">Acceso del administrador del sistema.</p>
        </div>
        <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Usuario" className={campo} />
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Contraseña" className={campo} />
        <button type="submit" className="w-full rounded-xl bg-cyan-300 py-3 text-sm font-semibold text-black shadow-[0_0_24px_rgba(0,245,212,0.35)]">Entrar</button>
      </form>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#05070d] bg-[radial-gradient(ellipse_at_top,rgba(0,245,212,0.12),transparent_38%),radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.16),transparent_42%)] text-white">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.35em] text-cyan-300/80">MEIJSAC</p>
            <h1 className="text-3xl font-semibold tracking-tight">Centro de control</h1>
          </div>
          <button onClick={salir} className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/70 hover:border-cyan-300/40 hover:text-white">Salir</button>
        </header>
        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-1.5">
          {(["dash", "planes", "clientes", "crear"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); if (t === "crear" && !editId) setForm(vacio) }} className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-medium transition ${tab === t ? "bg-cyan-300 text-black shadow-[0_0_18px_rgba(0,245,212,0.35)]" : "text-white/60 hover:text-white"}`}>
              {t === "dash" ? "Dashboard" : t === "planes" ? "Planes" : t === "clientes" ? "Clientes" : editId ? "Editar plan" : "Crear plan"}
            </button>
          ))}
        </nav>
        {aviso && <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{aviso}</div>}

        {tab === "dash" && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {metricas.map((item) => (
              <div key={item.etiqueta} className={`${panel} p-5`}>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{item.etiqueta}</div>
                <div className={`mt-3 text-3xl font-semibold tracking-tight ${item.tono}`}>{item.valor}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "planes" && (
          <div className="grid gap-3">{planes.map((p) => (
            <article key={p.id} className={`${panel} flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between`}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-medium">{p.nombre}</h2>
                  {p.badge && <span className="rounded-full bg-cyan-300 px-2 py-0.5 text-[10px] font-semibold text-black">{p.badge}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${p.activo ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-white/50"}`}>{p.activo ? "Activo" : "Inactivo"}</span>
                </div>
                <p className="mt-1 text-sm text-white/55">{p.descripcion}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-cyan-100/70">
                  <span className="rounded-full border border-white/10 px-2 py-1">{p.documentosAnio} documentos / año</span>
                  <span className="rounded-full border border-white/10 px-2 py-1">${p.precio} mensual</span>
                  <span className="rounded-full border border-white/10 px-2 py-1">${p.precioAnual} anual</span>
                  <span className="rounded-full border border-white/10 px-2 py-1">Trial {p.trialDias}d</span>
                  <span className="rounded-full border border-white/10 px-2 py-1">Facturas {p.limiteComprobantes}</span>
                  <span className="rounded-full border border-white/10 px-2 py-1">Usuarios {p.limiteUsuarios}</span>
                  <span className="rounded-full border border-white/10 px-2 py-1">{p.modulos.length} módulos</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => editar(p)} className="rounded-xl border border-white/15 px-3 py-2 text-xs hover:border-cyan-300/40">Editar</button>
                <button onClick={() => eliminar(p)} className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">Eliminar</button>
                <button onClick={() => alternar(p)} className={`rounded-xl px-3 py-2 text-xs font-medium ${p.activo ? "bg-cyan-300 text-black" : "border border-white/15"}`}>{p.activo ? "Activo" : "Inactivo"}</button>
              </div>
            </article>
          ))}</div>
        )}

        {tab === "crear" && (
          <div className={`${panel} max-w-3xl space-y-4 p-6`}>
            <h2 className="text-xl font-medium">{editId ? "Editar plan" : "Crear plan"}</h2>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre" className={campo} />
            <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción" className={campo} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-white/55">Precio mensual<input type="number" value={form.precio} onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })} className={campo} /></label>
              <label className="space-y-1 text-xs text-white/55">Precio anual<input type="number" value={form.precioAnual} onChange={(e) => setForm({ ...form, precioAnual: Number(e.target.value) })} className={campo} /></label>
              <label className="space-y-1 text-xs text-white/55">Trial días<input type="number" value={form.trialDias} onChange={(e) => setForm({ ...form, trialDias: Number(e.target.value) })} className={campo} /></label>
              <label className="space-y-1 text-xs text-white/55">Duración días<input type="number" value={form.duracionDias} onChange={(e) => setForm({ ...form, duracionDias: Number(e.target.value) })} className={campo} /></label>
              <label className="space-y-1 text-xs text-white/55">Facturas<input type="number" value={form.limiteComprobantes} onChange={(e) => setForm({ ...form, limiteComprobantes: Number(e.target.value) })} className={campo} /></label>
              <label className="space-y-1 text-xs text-white/55">Usuarios<input type="number" value={form.limiteUsuarios} onChange={(e) => setForm({ ...form, limiteUsuarios: Number(e.target.value) })} className={campo} /></label>
              <label className="space-y-1 text-xs text-white/55">Documentos / año<input type="number" value={form.documentosAnio} onChange={(e) => setForm({ ...form, documentosAnio: Number(e.target.value) })} className={campo} /></label>
              <label className="space-y-1 text-xs text-white/55">Tipo<select value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} className={campo}><option value="">Normal</option><option value="Popular">Popular</option><option value="Más popular">Más popular</option><option value="Gratuito">Gratuito</option></select></label>
            </div>
            <label className="flex items-center gap-2 text-sm text-white/75"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="h-4 w-4 accent-cyan-300" /> Activo</label>
            <ModulosPlan elegidos={form.modulos} onChange={(modulos) => setForm({ ...form, modulos })} />
            <button onClick={guardarPlan} className="w-full rounded-xl bg-cyan-300 py-3 text-sm font-semibold text-black shadow-[0_0_24px_rgba(0,245,212,0.28)]">{editId ? "Guardar cambios" : "Crear plan"}</button>
          </div>
        )}

        {tab === "clientes" && (
          <div className="space-y-3">
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar por RUC o razón" className={campo} />
            <div className={`${panel} overflow-x-auto`}>
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                  <tr>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Quedan</th>
                    <th className="px-4 py-3 font-medium">Caduca</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>{filtrados.map((c) => (
                  <tr key={c.id} className="border-t border-white/8 align-top">
                    <td className="px-4 py-4"><div className="font-medium">{c.razonSocial}</div><div className="text-xs text-white/45">{c.ruc}</div></td>
                    <td className="px-4 py-4 text-white/75">{c.planNombre || "Sin plan"}</td>
                    <td className="px-4 py-4 text-white/75">{c.planEstado} / {c.estado}</td>
                    <td className="px-4 py-4"><div className="font-medium text-cyan-100">{textoQuedan(c.comprobantesEmitidos || 0, c.limiteComprobantes)}</div><div className="text-xs text-white/45">{c.comprobantesEmitidos || 0} autorizados en producción</div></td>
                    <td className="px-4 py-4 text-white/75">{textoCaducidad(c.vence || c.planFin)}</td>
                    <td className="px-4 py-4 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <select value={elegido[c.id] || c.planId || ""} onChange={(e) => setElegido({ ...elegido, [c.id]: e.target.value })} className="rounded-lg border border-white/15 bg-[#0b1018] px-2 py-1.5 text-xs">
                          <option value="">Elegir plan</option>
                          {activos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                        <button onClick={() => accionCliente(c.id, "asignar", elegido[c.id] || c.planId || "")} className="rounded-lg bg-cyan-300 px-2 py-1.5 text-xs font-semibold text-black">Cambiar plan / asignar plan</button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => accionCliente(c.id, "suspender")} className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-200">Suspender</button>
                        <button onClick={() => accionCliente(c.id, "reactivar")} className="rounded-lg border border-white/15 px-2 py-1.5 text-xs">Reactivar</button>
                        <button onClick={() => accionCliente(c.id, "inicial")} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2 py-1.5 text-xs text-emerald-200">Reactivar con plan inicial</button>
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

function ModulosPlan({ elegidos, onChange }: { elegidos: string[]; onChange: (modulos: string[]) => void }) {
  const marcar = (nombre: string) => {
    onChange(elegidos.includes(nombre) ? elegidos.filter((item) => item !== nombre) : [...elegidos, nombre])
  }
  const lista = (titulo: string, nombres: readonly string[]) => (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      <h3 className="px-4 pt-4 text-[11px] tracking-[0.22em] text-cyan-300/80">{titulo}</h3>
      <div className="mt-2 divide-y divide-white/8">
        {nombres.map((nombre) => (
          <label key={nombre} className="flex cursor-pointer items-center justify-between px-4 py-2.5 hover:bg-white/[0.03]">
            <span className="text-sm text-white/85">{nombre}</span>
            <input type="checkbox" checked={elegidos.includes(nombre)} onChange={() => marcar(nombre)} className="h-4 w-4 accent-cyan-300" />
          </label>
        ))}
      </div>
    </section>
  )
  return (
    <div className="space-y-3">
      <p className="text-xs tracking-[0.18em] text-white/45">CENTRO DE CONTROL MODULAR DE ESTE PLAN</p>
      {lista("SECCIONES", MODULOS_MEIJSAC)}
      {lista("CARPETAS", CARPETAS_PLAN)}
    </div>
  )
}
