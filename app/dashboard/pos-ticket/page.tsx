"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

type Producto = { id: string; codigo?: string; nombre: string; precio: number; stock: number }
type Linea = Producto & { cantidad: number }
type Resumen = {
  estab: string
  pto: string
  hoy: Record<string, number>
  mes: number
  ano: number
  techo: number
}

const PAGOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "DINERO ELECTRONICO"]

export default function PosTicket() {
  const [busca, setBusca] = useState("")
  const [productos, setProductos] = useState<Producto[]>([])
  const [cart, setCart] = useState<Linea[]>([])
  const [pago, setPago] = useState("EFECTIVO")
  const [clienteNombre, setClienteNombre] = useState("")
  const [clienteIdentificacion, setClienteIdentificacion] = useState("")
  const [notaFisica, setNotaFisica] = useState("")
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [aviso, setAviso] = useState("")
  const [error, setError] = useState("")
  const [guardando, setGuardando] = useState(false)

  const cargarResumen = () => {
    fetch("/api/pos-ticket", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => { if (!d.error) setResumen(d) })
      .catch(() => {})
  }

  useEffect(() => { cargarResumen() }, [])

  useEffect(() => {
    const q = busca.trim()
    if (q.length < 2) { setProductos([]); return }
    const timer = window.setTimeout(() => {
      fetch(`/api/productos?q=${encodeURIComponent(q)}`, { credentials: "same-origin" })
        .then((r) => r.json())
        .then((d) => setProductos(Array.isArray(d) ? d : []))
        .catch(() => setProductos([]))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [busca])

  const agregar = (p: Producto) => {
    setCart((prev) => {
      const ya = prev.find((x) => x.id === p.id)
      if (ya) return prev.map((x) => x.id === p.id ? { ...x, cantidad: x.cantidad + 1 } : x)
      return [...prev, { ...p, cantidad: 1 }]
    })
  }
  const total = cart.reduce((s, c) => s + Number(c.precio) * c.cantidad, 0)

  const imprimir = (numero: string, empresa: { ruc: string; razonSocial: string; nombreComercial: string; direccion: string }, lineas: { nombre: string; cantidad: number; precio: number; total: number }[], cobrado: number, forma: string) => {
    const ventana = window.open("", "ticket-interno", "width=320,height=700")
    if (!ventana) return
    const filas = lineas.map((l) => `<tr><td>${l.cantidad} ${l.nombre}</td><td style="text-align:right">${l.total.toFixed(2)}</td></tr>`).join("")
    const ahora = new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" })
    ventana.document.write(`<!DOCTYPE html><html><head><title>${numero}</title><style>body{font-family:monospace;width:72mm;margin:0 auto;color:#000;font-size:12px}h1{font-size:14px;text-align:center}p,td{margin:2px 0}table{width:100%;border-collapse:collapse}.c{text-align:center}.pie{margin-top:8px;border-top:1px dashed #000;padding-top:6px;text-align:center;font-weight:700}</style></head><body>
      <h1>${empresa.nombreComercial || empresa.razonSocial}</h1>
      <p class="c">${empresa.razonSocial}</p>
      <p class="c">RUC ${empresa.ruc}</p>
      <p class="c">${empresa.direccion}</p>
      <p class="c">${ahora}</p>
      <p class="c">Ticket ${numero}</p>
      ${clienteNombre ? `<p>Cliente: ${clienteNombre}</p>` : ""}
      ${clienteIdentificacion ? `<p>Id: ${clienteIdentificacion}</p>` : ""}
      ${notaFisica ? `<p>Nota física: ${notaFisica}</p>` : ""}
      <table>${filas}</table>
      <p><b>TOTAL ${cobrado.toFixed(2)}</b></p>
      <p>Pago: ${forma}</p>
      <p class="pie">Documento sin validez tributaria</p>
      </body></html>`)
    ventana.document.close()
    ventana.focus()
    ventana.print()
  }

  const cobrar = async () => {
    if (!cart.length || guardando) return
    setGuardando(true)
    setError("")
    setAviso("")
    try {
      const res = await fetch("/api/pos-ticket", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pago,
          clienteNombre,
          clienteIdentificacion,
          notaFisica,
          lineas: cart.map((c) => ({ productoId: c.id, cantidad: c.cantidad })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "No se pudo guardar el ticket")
      const lineas = Array.isArray(data.ticket?.detalle) ? data.ticket.detalle : cart
      imprimir(data.numero, data.empresa, lineas, Number(data.ticket?.total || total), pago)
      setCart([])
      setNotaFisica("")
      setAviso(`Ticket ${data.numero} guardado. No se envió al SRI.`)
      cargarResumen()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el ticket")
    } finally {
      setGuardando(false)
    }
  }

  const hoyTotal = resumen ? Object.values(resumen.hoy).reduce((s, n) => s + Number(n || 0), 0) : 0

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-black text-xl">POS TICKET {resumen ? `${resumen.estab}-${resumen.pto}` : ""}</h1>
          <Link href="/dashboard/factura-xml" className="text-[11px] font-bold bg-white/10 px-3 py-2 rounded-full">Factura electrónica</Link>
        </div>
        <p className="text-[11px] text-white/60">Comprobante interno. No se envía al SRI. Si el cliente pide un comprobante válido, llena la nota de venta física y anota su número aquí.</p>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar producto por código o nombre..." className="w-full p-3 rounded-xl bg-white/10 outline-none" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {productos.map((p) => (
            <button key={p.id} onClick={() => agregar(p)} className="p-3 bg-white/5 border border-white/10 rounded-xl text-left hover:bg-white/10">
              <div className="font-bold text-sm">{p.nombre}</div>
              <div className="text-[#00f5d4] text-xs">${Number(p.precio).toFixed(2)} · Stock {Number(p.stock)}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-2">
        <h2 className="font-black">TICKET</h2>
        <div className="flex-1 space-y-2 overflow-y-auto min-h-24">
          {cart.map((c) => (
            <div key={c.id} className="flex justify-between text-sm gap-2">
              <span>{c.nombre}</span>
              <span className="flex items-center gap-2">
                <button type="button" onClick={() => setCart((prev) => prev.flatMap((x) => x.id === c.id ? (x.cantidad > 1 ? [{ ...x, cantidad: x.cantidad - 1 }] : []) : [x]))} className="px-2 bg-white/10 rounded">-</button>
                {c.cantidad}
                <button type="button" onClick={() => agregar(c)} className="px-2 bg-white/10 rounded">+</button>
                ${(Number(c.precio) * c.cantidad).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} placeholder="Cliente o departamento" className="p-2 rounded bg-black border border-white/10 text-sm" />
        <input value={clienteIdentificacion} onChange={(e) => setClienteIdentificacion(e.target.value)} placeholder="Identificación, si la tienes" className="p-2 rounded bg-black border border-white/10 text-sm" />
        <input value={notaFisica} onChange={(e) => setNotaFisica(e.target.value)} placeholder="Nº nota de venta física" className="p-2 rounded bg-black border border-white/10 text-sm" />
        <div className="flex justify-between font-black text-lg"><span>TOTAL</span><span>${total.toFixed(2)}</span></div>
        <select value={pago} onChange={(e) => setPago(e.target.value)} className="w-full p-2 rounded bg-black">
          {PAGOS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <button onClick={cobrar} disabled={guardando || !cart.length} className="w-full py-3 bg-[#00f5d4] text-black font-black rounded-xl disabled:opacity-50">{guardando ? "GUARDANDO..." : "COBRAR E IMPRIMIR"}</button>
        {aviso && <p className="text-sm font-bold text-green-400">{aviso}</p>}
        {error && <p className="text-sm font-bold text-red-400">{error}</p>}
        {resumen && (
          <div className="border-t border-white/10 pt-2 text-[11px] text-white/70 space-y-1">
            <p>Hoy ${hoyTotal.toFixed(2)} · Efectivo ${Number(resumen.hoy.EFECTIVO || 0).toFixed(2)} · Tarjeta ${Number(resumen.hoy.TARJETA || 0).toFixed(2)}</p>
            <p>Transferencia ${Number(resumen.hoy.TRANSFERENCIA || 0).toFixed(2)} · Dinero electrónico ${Number(resumen.hoy["DINERO ELECTRONICO"] || 0).toFixed(2)}</p>
            <p>Mes ${resumen.mes.toFixed(2)} · Año ${resumen.ano.toFixed(2)} de ${resumen.techo.toFixed(2)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
