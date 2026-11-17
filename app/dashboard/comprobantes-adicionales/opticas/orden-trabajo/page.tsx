"use client"
import { useEffect, useState } from "react"
import { Marco } from "../../marco"

type Orden = {
  id: string
  estado: string
  tipoLente: string
  material: string
  armazonNombre: string
  lunaNombre: string
  observaciones: string
  facturaId: string | null
  formula: { od?: { esf?: number; cil?: number; eje?: number }; oi?: { esf?: number; cil?: number; eje?: number } }
  paciente?: { nombres: string; apellidos: string; identificacion: string }
  clienteFacturacion?: { razonSocial: string } | null
}
type Paciente = { id: string; nombres: string; apellidos: string; identificacion: string }
type Producto = { nombre: string }
type Cliente = { id: string; razonSocial: string; identificacion: string }

const ESTADOS = [
  ["PENDIENTE_COTIZAR", "Por cotizar"],
  ["EN_TALLER", "En taller"],
  ["LISTO_ENTREGA", "Listo para entrega"],
  ["ENTREGADO", "Entregado"],
]

function signo(valor: number | undefined) {
  const n = Number(valor) || 0
  return n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2)
}

async function pedir(url: string, cuerpo?: unknown, metodo = cuerpo ? "POST" : "GET") {
  const res = await fetch(url, { method: metodo, headers: cuerpo ? { "Content-Type": "application/json" } : undefined, body: cuerpo ? JSON.stringify(cuerpo) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "No se pudo completar")
  return data
}

export default function OrdenOpticaPage() {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [error, setError] = useState("")
  const [pacienteId, setPacienteId] = useState("")
  const [externa, setExterna] = useState({ esfOd: "0.00", cilOd: "0.00", ejeOd: "0", esfOi: "0.00", cilOi: "0.00", ejeOi: "0", material: "", tipoLente: "" })
  const campo = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"

  async function cargar() {
    const data = await pedir("/api/optica/ordenes")
    setOrdenes(data.ordenes || [])
    const gente = await pedir("/api/optica/pacientes")
    setPacientes(gente.pacientes || [])
  }

  useEffect(() => { cargar().catch((e) => setError(e.message)) }, [])

  async function guardar(id: string, cambios: Record<string, string>) {
    setError("")
    try {
      await pedir("/api/optica/ordenes", { id, ...cambios }, "PATCH")
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar")
    }
  }

  async function crearExterna() {
    setError("")
    try {
      await pedir("/api/optica/ordenes", {
        pacienteId,
        tipoLente: externa.tipoLente,
        material: externa.material,
        formula: {
          od: { esf: Number(externa.esfOd), cil: Number(externa.cilOd), eje: Number(externa.ejeOd) },
          oi: { esf: Number(externa.esfOi), cil: Number(externa.cilOi), eje: Number(externa.ejeOi) },
          material_sugerido: externa.material,
        },
      })
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la orden")
    }
  }

  return (
    <Marco titulo="Ópticas · Orden de trabajo" claro>
      <p className="text-sm text-slate-600">Aquí llega la fórmula cuando se cierra la consulta. También se abre una orden si el cliente trae una receta de afuera. Elegir el armazón no cambia el inventario ni emite la factura.</p>
      {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
        <h2 className="font-black">Receta externa, sin historia clínica</h2>
        <select value={pacienteId} onChange={(e) => setPacienteId(e.target.value)} className={campo}>
          <option value="">Paciente</option>
          {pacientes.map((fila) => <option key={fila.id} value={fila.id}>{fila.apellidos} {fila.nombres} · {fila.identificacion}</option>)}
        </select>
        <div className="grid sm:grid-cols-3 gap-2">
          <input value={externa.esfOd} onChange={(e) => setExterna({ ...externa, esfOd: e.target.value })} placeholder="Esf OD" className={campo} />
          <input value={externa.cilOd} onChange={(e) => setExterna({ ...externa, cilOd: e.target.value })} placeholder="Cil OD" className={campo} />
          <input value={externa.ejeOd} onChange={(e) => setExterna({ ...externa, ejeOd: e.target.value })} placeholder="Eje OD" className={campo} />
          <input value={externa.esfOi} onChange={(e) => setExterna({ ...externa, esfOi: e.target.value })} placeholder="Esf OI" className={campo} />
          <input value={externa.cilOi} onChange={(e) => setExterna({ ...externa, cilOi: e.target.value })} placeholder="Cil OI" className={campo} />
          <input value={externa.ejeOi} onChange={(e) => setExterna({ ...externa, ejeOi: e.target.value })} placeholder="Eje OI" className={campo} />
        </div>
        <input value={externa.tipoLente} onChange={(e) => setExterna({ ...externa, tipoLente: e.target.value })} placeholder="Tipo de lente" className={campo} />
        <input value={externa.material} onChange={(e) => setExterna({ ...externa, material: e.target.value })} placeholder="Material y filtros" className={campo} />
        <button type="button" onClick={crearExterna} className="bg-teal-600 text-white font-black text-xs px-4 py-2 rounded-xl">Crear orden</button>
      </section>
      <div className="space-y-3">
        {ordenes.map((orden) => (
          <OrdenFila key={orden.id} orden={orden} guardar={guardar} campo={campo} />
        ))}
      </div>
    </Marco>
  )
}

function OrdenFila({ orden, guardar, campo }: { orden: Orden; guardar: (id: string, cambios: Record<string, string>) => Promise<void>; campo: string }) {
  const [armazon, setArmazon] = useState(orden.armazonNombre)
  const [luna, setLuna] = useState(orden.lunaNombre)
  const [secuencial, setSecuencial] = useState("")
  const [cliente, setCliente] = useState("")
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm">
      <b>{orden.paciente?.apellidos} {orden.paciente?.nombres}</b>
      <p className="text-sm">OD {signo(orden.formula?.od?.esf)} {signo(orden.formula?.od?.cil)} x {orden.formula?.od?.eje ?? 0} · OI {signo(orden.formula?.oi?.esf)} {signo(orden.formula?.oi?.cil)} x {orden.formula?.oi?.eje ?? 0}</p>
      <p className="text-xs text-slate-500">{orden.clienteFacturacion ? `Paga ${orden.clienteFacturacion.razonSocial}` : "Sin cliente de facturación"} {orden.facturaId ? "· Factura vinculada" : ""}</p>
      <select value={orden.estado} onChange={(e) => guardar(orden.id, { estado: e.target.value })} className={campo}>
        {ESTADOS.map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
      </select>
      <input value={armazon} onChange={async (e) => { setArmazon(e.target.value); const data = await fetch(`/api/productos?q=${encodeURIComponent(e.target.value)}`).then((r) => r.json()).catch(() => []); setProductos(Array.isArray(data) ? data.slice(0, 5) : []) }} placeholder="Buscar armazón en inventario" className={campo} />
      <div className="flex flex-wrap gap-2">{productos.map((producto) => <button type="button" key={producto.nombre} onClick={() => { setArmazon(producto.nombre); guardar(orden.id, { armazonNombre: producto.nombre }) }} className="text-[11px] border border-slate-300 rounded-full px-2 py-1 text-slate-800">{producto.nombre}</button>)}</div>
      <input value={luna} onChange={(e) => setLuna(e.target.value)} placeholder="Lunas" className={campo} />
      <button type="button" onClick={() => guardar(orden.id, { armazonNombre: armazon, lunaNombre: luna })} className="text-xs font-bold text-teal-700">Guardar armazón y lunas</button>
      <input value={cliente} onChange={async (e) => { const texto = e.target.value; setCliente(texto); const data = await fetch(`/api/clientes?q=${encodeURIComponent(texto)}`).then((r) => r.json()).catch(() => []); const lista = Array.isArray(data) ? data : []; setClientes(lista.filter((fila) => `${fila.razonSocial || ""} ${fila.identificacion || ""}`.toLowerCase().includes(texto.toLowerCase())).slice(0, 5)) }} placeholder="Quién paga, si es otra persona" className={campo} />
      <div className="flex flex-wrap gap-2">{clientes.map((fila) => <button type="button" key={fila.id} onClick={() => guardar(orden.id, { clienteFacturacionId: fila.id })} className="text-[11px] border border-slate-300 rounded-full px-2 py-1 text-slate-800">{fila.razonSocial}</button>)}</div>
      <div className="flex gap-2">
        <input value={secuencial} onChange={(e) => setSecuencial(e.target.value)} placeholder="Secuencial de la factura ya emitida" className={campo} />
        <button type="button" onClick={() => guardar(orden.id, { secuencial })} className="text-xs font-bold px-3 rounded-xl bg-slate-100 border border-slate-300 text-slate-900">Vincular</button>
      </div>
    </article>
  )
}
