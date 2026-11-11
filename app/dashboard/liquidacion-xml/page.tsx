"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface ItemLiquidacion {
  codigoPrincipal: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  aplicaIva: boolean
}

const vacio = (): ItemLiquidacion => ({ codigoPrincipal: "", descripcion: "", cantidad: 1, precioUnitario: 0, aplicaIva: true })

export default function EmisionLiquidacionCompra() {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [tipoCompra, setTipoCompra] = useState<"BIENES" | "SERVICIOS">("BIENES")
  const [formaPago, setFormaPago] = useState<"01" | "20">("01")
  const [proveedor, setProveedor] = useState({ tipoIdentificacion: "05", identificacion: "", razonSocial: "", direccion: "" })
  const [items, setItems] = useState<ItemLiquidacion[]>([vacio()])
  const [emisor, setEmisor] = useState({ razon: "", ruc: "" })

  useEffect(() => {
    fetch("/api/empresa/mia").then((r) => r.json()).then((data) => {
      const empresa = data?.empresa || {}
      setEmisor({ razon: empresa.razonSocial || "", ruc: empresa.ruc || "" })
    }).catch(() => {})
  }, [])

  const cambiar = (idx: number, cambio: Partial<ItemLiquidacion>) => {
    setItems(items.map((item, i) => i === idx ? { ...item, ...cambio } : item))
  }
  const subtotal15 = items.filter((i) => i.aplicaIva).reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0)
  const subtotal0 = items.filter((i) => !i.aplicaIva).reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0)
  const subtotalBruto = subtotal15 + subtotal0
  const iva15 = subtotal15 * 0.15
  const totalLiquidacion = subtotalBruto + iva15
  const retencionIva100 = iva15
  const porcentajeRenta = tipoCompra === "BIENES" ? 2 : 2.75
  const retencionRenta = subtotalBruto * (porcentajeRenta / 100)
  const totalRetenido = retencionIva100 + retencionRenta
  const netoAPagar = totalLiquidacion - totalRetenido
  const dinero = (n: number) => `$${n.toFixed(2)}`

  const emitir = async () => {
    setCargando(true)
    try {
      const res = await fetch("/api/sri/liquidacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoCompra, formaPago, proveedor, items }),
      })
      const data = await res.json()
      if (data.autorizado && data.fechaAutorizacion && data.claveAccesoLiquidacion) {
        if (data.mensajeRetencion) alert(data.mensajeRetencion)
        router.push(`/dashboard/factura-xml/visor/${data.claveAccesoLiquidacion}`)
        return
      }
      alert(data.mensaje || "El SRI no autorizó la liquidación.")
    } catch {
      alert("No pude conectar con el servidor.")
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 p-6 font-sans">
      <div className="max-w-7xl mx-auto flex justify-between items-center mb-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
          <h1 className="text-lg font-semibold text-white">Liquidación de Compra</h1>
          <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-md border border-slate-700">Comprobante 03 + Retención 07</span>
        </div>
        <Link href="/dashboard/comprobantes" className="text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg">← Volver</Link>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-800/80 pb-3">
              <h2 className="text-xs font-semibold text-teal-400 uppercase tracking-wider">1. Proveedor sin RUC</h2>
              <div className="bg-[#0B0F19] p-1 rounded-xl border border-slate-800 flex text-xs">
                <button type="button" onClick={() => setTipoCompra("BIENES")} className={`px-3 py-1 rounded-lg font-medium ${tipoCompra === "BIENES" ? "bg-teal-400 text-slate-950 font-bold" : "text-slate-400"}`}>Compra de bienes (2%)</button>
                <button type="button" onClick={() => setTipoCompra("SERVICIOS")} className={`px-3 py-1 rounded-lg font-medium ${tipoCompra === "SERVICIOS" ? "bg-teal-400 text-slate-950 font-bold" : "text-slate-400"}`}>Servicios (2.75%)</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Tipo de documento</label>
                <select value={proveedor.tipoIdentificacion} onChange={(e) => setProveedor({ ...proveedor, tipoIdentificacion: e.target.value })} className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-400">
                  <option value="05">Cédula</option>
                  <option value="06">Pasaporte</option>
                  <option value="08">Identificación del exterior</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Identificación</label>
                <input value={proveedor.identificacion} onChange={(e) => setProveedor({ ...proveedor, identificacion: e.target.value })} className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono outline-none focus:border-teal-400" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Forma de pago</label>
                <select value={formaPago} onChange={(e) => setFormaPago(e.target.value as "01" | "20")} className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-400">
                  <option value="01">Efectivo</option>
                  <option value="20">Transferencia</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-slate-400 mb-1">Nombres completos del proveedor</label>
                <input value={proveedor.razonSocial} onChange={(e) => setProveedor({ ...proveedor, razonSocial: e.target.value.toUpperCase() })} className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-3.5 py-2 text-white outline-none focus:border-teal-400" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Dirección</label>
                <input value={proveedor.direccion} onChange={(e) => setProveedor({ ...proveedor, direccion: e.target.value.toUpperCase() })} className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-3.5 py-2 text-white outline-none focus:border-teal-400" />
              </div>
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-semibold text-teal-400 uppercase tracking-wider">2. Detalle de la compra</h2>
              <button type="button" onClick={() => setItems([...items, vacio()])} className="text-xs text-teal-400 hover:text-teal-300 font-medium">+ Añadir ítem</button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs bg-[#0B0F19] p-2.5 rounded-xl border border-slate-800">
                <input placeholder="Cód." value={item.codigoPrincipal} onChange={(e) => cambiar(idx, { codigoPrincipal: e.target.value.toUpperCase() })} className="col-span-2 bg-[#111827] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-white font-mono outline-none" />
                <input placeholder="Descripción" value={item.descripcion} onChange={(e) => cambiar(idx, { descripcion: e.target.value.toUpperCase() })} className="col-span-4 bg-[#111827] border border-slate-700 rounded-lg px-2 py-1.5 text-white" />
                <input type="number" min={0} value={item.cantidad} onChange={(e) => cambiar(idx, { cantidad: Number(e.target.value) })} className="col-span-1 bg-[#111827] border border-slate-700 rounded-lg px-2 py-1.5 text-white" />
                <input type="number" min={0} value={item.precioUnitario} onChange={(e) => cambiar(idx, { precioUnitario: Number(e.target.value) })} className="col-span-2 bg-[#111827] border border-slate-700 rounded-lg px-2 py-1.5 text-white" />
                <label className="col-span-2 text-slate-400 flex items-center gap-1"><input type="checkbox" checked={item.aplicaIva} onChange={(e) => cambiar(idx, { aplicaIva: e.target.checked })} /> IVA</label>
                <button type="button" onClick={() => items.length > 1 && setItems(items.filter((_, i) => i !== idx))} className="col-span-1 text-slate-500">✕</button>
              </div>
            ))}
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 text-xs space-y-2">
            <p className="text-slate-400 uppercase tracking-wider text-[11px]">Retenciones de esta compra</p>
            <div className="flex justify-between"><span>IVA 100%</span><span className="font-mono text-teal-400">{dinero(retencionIva100)}</span></div>
            <div className="flex justify-between"><span>Renta {porcentajeRenta}%</span><span className="font-mono text-teal-400">{dinero(retencionRenta)}</span></div>
          </div>

          <div className="bg-[#0B0F19] border border-teal-500/40 rounded-2xl p-5">
            <p className="text-[11px] uppercase text-slate-400">Monto neto a entregar en mano</p>
            <p className="text-3xl font-semibold text-teal-400 mt-1">{dinero(netoAPagar)}</p>
            <p className="text-[11px] text-slate-500 mt-1">Total {dinero(totalLiquidacion)} menos retenciones {dinero(totalRetenido)}</p>
          </div>

          <button onClick={emitir} disabled={cargando} className="w-full py-3 rounded-xl text-sm font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 disabled:opacity-50">{cargando ? "Autorizando en el SRI..." : "Guardar liquidación"}</button>
        </div>

        <div className="lg:col-span-5 bg-white text-slate-800 rounded-2xl p-6 text-xs shadow-2xl">
          <div className="flex justify-between border-b border-slate-200 pb-3 mb-3">
            <div><p className="font-bold text-slate-900">{emisor.razon || "Tu empresa"}</p><p className="text-slate-500">RUC {emisor.ruc}</p></div>
            <p className="font-bold text-right">LIQUIDACIÓN DE COMPRA</p>
          </div>
          <p><b>Proveedor:</b> {proveedor.razonSocial || "—"}</p>
          <p className="mt-1"><b>Identificación:</b> {proveedor.identificacion || "—"}</p>
          <p className="mt-1"><b>Dirección:</b> {proveedor.direccion || "—"}</p>
          <p className="mt-1"><b>Pago:</b> {formaPago === "01" ? "Efectivo" : "Transferencia"}</p>
          <div className="mt-3 space-y-1">
            {items.filter((item) => item.descripcion || item.precioUnitario).map((item, idx) => (
              <p key={idx}>{item.descripcion || "Ítem"} · {item.cantidad} × {dinero(item.precioUnitario)}</p>
            ))}
          </div>
          <div className="mt-4 border-t border-slate-200 pt-3 space-y-1">
            <div className="flex justify-between"><span>Subtotal 15%</span><span>{dinero(subtotal15)}</span></div>
            <div className="flex justify-between"><span>Subtotal 0%</span><span>{dinero(subtotal0)}</span></div>
            <div className="flex justify-between"><span>IVA 15%</span><span>{dinero(iva15)}</span></div>
            <div className="flex justify-between font-semibold"><span>Total</span><span>{dinero(totalLiquidacion)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Retenciones</span><span>-{dinero(totalRetenido)}</span></div>
            <div className="flex justify-between font-bold text-slate-900"><span>Neto a pagar</span><span>{dinero(netoAPagar)}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
