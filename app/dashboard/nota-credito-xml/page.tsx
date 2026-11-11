'use client'
import { useState } from 'react'
import Link from 'next/link'

interface ProductoDevolucion {
  codigo: string
  descripcion: string
  cantidadOriginal: number
  cantidadDevolver: number
  precioUnitario: number
  aplicaIva: boolean
}

type Sustento = {
  cliente: string
  identificacion: string
  tipoId: string
  fecha: string
  emisor: { razon: string; ruc: string; matriz: string; ambiente: string }
}

export default function EmisionNotaCredito() {
  const [facturaRef, setFacturaRef] = useState('')
  const [motivoAnulacion, setMotivoAnulacion] = useState('')
  const [cargando, setCargando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [sustento, setSustento] = useState<Sustento | null>(null)
  const [productos, setProductos] = useState<ProductoDevolucion[]>([])

  const itemsActivos = productos.filter((p) => p.cantidadDevolver > 0)
  const subtotal0 = itemsActivos.filter((p) => !p.aplicaIva).reduce((acc, p) => acc + p.cantidadDevolver * p.precioUnitario, 0)
  const subtotal15 = itemsActivos.filter((p) => p.aplicaIva).reduce((acc, p) => acc + p.cantidadDevolver * p.precioUnitario, 0)
  const iva15 = subtotal15 * 0.15
  const totalDevolucion = subtotal0 + subtotal15 + iva15

  const actualizarCantidad = (index: number, nuevaCant: number) => {
    const copia = [...productos]
    const max = copia[index].cantidadOriginal
    copia[index] = { ...copia[index], cantidadDevolver: Math.max(0, Math.min(nuevaCant, max)) }
    setProductos(copia)
  }

  const cargarFactura = async () => {
    setAviso('')
    setSustento(null)
    setProductos([])
    const res = await fetch(`/api/sri/nota-credito?numero=${encodeURIComponent(facturaRef.trim())}`, { credentials: 'same-origin' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setAviso(data.mensaje || data.error || 'No encontré esa factura autorizada.')
      return
    }
    setFacturaRef(data.numero)
    setSustento({
      cliente: data.cliente,
      identificacion: data.identificacion,
      tipoId: data.tipoId,
      fecha: data.fecha,
      emisor: data.emisor,
    })
    setProductos(Array.isArray(data.productos) ? data.productos : [])
  }

  const handleEmitirNotaCredito = async () => {
    if (!sustento) return alert('Carga primero la factura autorizada.')
    if (!motivoAnulacion.trim()) return alert('Escribe el motivo de la nota de crédito.')
    if (itemsActivos.length === 0) return alert('Debes seleccionar al menos 1 producto para devolver.')
    setCargando(true)
    try {
      const res = await fetch('/api/sri/nota-credito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numDocModificado: facturaRef,
          fechaEmisionDocSustento: sustento.fecha,
          motivo: motivoAnulacion,
          clienteNombre: sustento.cliente,
          clienteIdentificacion: sustento.identificacion,
          clienteTipoId: sustento.tipoId,
          productos: itemsActivos,
          subtotal0,
          subtotal15,
          iva15,
          total: totalDevolucion,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.autorizado && data.fechaAutorizacion && data.claveAcceso) {
        window.location.href = `/dashboard/factura-xml/visor/${data.claveAcceso}`
        return
      }
      alert(data.mensaje || data.error || 'El SRI no autorizó la nota de crédito.')
    } catch {
      alert('Error de conexión con el servidor.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 p-6 font-sans">
      <div className="max-w-7xl mx-auto flex justify-between items-center mb-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
          <h1 className="text-lg font-semibold text-white tracking-wide">Nueva Nota de Crédito</h1>
          <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-md border border-slate-700">Comprobante 04 • Devolución / Anulación</span>
        </div>
        <Link href="/dashboard/comprobantes" className="text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg transition">← Volver al Panel</Link>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-[#111827] border border-slate-800/80 rounded-2xl p-6 space-y-5 shadow-xl">
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">1. Factura original a modificar</label>
            <div className="flex gap-2">
              <input type="text" value={facturaRef} onChange={(e) => setFacturaRef(e.target.value)} placeholder="001-002-000000000" className="flex-1 bg-[#0B0F19] border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:border-teal-400 outline-none" />
              <button type="button" onClick={cargarFactura} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-4 rounded-xl border border-slate-700 transition">Cargar</button>
            </div>
            {aviso ? <p className="text-[11px] text-slate-400 mt-2">{aviso}</p> : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">2. Motivo de la nota de crédito</label>
            <input type="text" value={motivoAnulacion} onChange={(e) => setMotivoAnulacion(e.target.value.toUpperCase())} placeholder="Ej: ANULACIÓN DE FACTURA / DEVOLUCIÓN" className="w-full bg-[#0B0F19] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white focus:border-teal-400 outline-none" />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">3. Productos a devolver</label>
              <span className="text-[11px] text-slate-500">Ajusta la cantidad</span>
            </div>
            <div className="space-y-2">
              {productos.length === 0 ? <p className="text-[11px] text-slate-500">Carga una factura autorizada para ver sus productos.</p> : null}
              {productos.map((prod, idx) => (
                <div key={`${prod.codigo}-${idx}`} className="bg-[#0B0F19] border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{prod.descripcion}</p>
                    <p className="text-[11px] text-slate-500 font-mono">Disponible: {prod.cantidadOriginal} • Unit: ${prod.precioUnitario.toFixed(2)}{prod.aplicaIva ? ' • IVA 15%' : ' • IVA 0%'}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => actualizarCantidad(idx, prod.cantidadDevolver - 1)} className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs">-</button>
                    <span className="w-8 text-center font-mono text-xs font-bold text-teal-400">{prod.cantidadDevolver}</span>
                    <button type="button" onClick={() => actualizarCantidad(idx, prod.cantidadDevolver + 1)} className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0B0F19] border border-slate-800 rounded-xl p-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400"><span>Subtotal 0%</span><span className="font-mono text-slate-200">${subtotal0.toFixed(2)}</span></div>
            <div className="flex justify-between text-slate-400"><span>Subtotal 15%</span><span className="font-mono text-slate-200">${subtotal15.toFixed(2)}</span></div>
            <div className="flex justify-between text-slate-400"><span>IVA 15%</span><span className="font-mono text-slate-200">${iva15.toFixed(2)}</span></div>
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-semibold"><span className="text-white">Total nota de crédito</span><span className="font-mono text-teal-400 text-base">${totalDevolucion.toFixed(2)}</span></div>
          </div>

          <button type="button" onClick={handleEmitirNotaCredito} disabled={cargando} className="w-full py-3 rounded-xl text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 shadow-lg shadow-teal-500/10 transition disabled:opacity-50">{cargando ? 'Autorizando en SRI...' : 'Emitir Nota de Crédito'}</button>
        </div>

        <div className="lg:col-span-7 bg-white text-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-200 text-xs">
          <div className="flex justify-between items-start pb-5 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">{sustento?.emisor.razon || 'Emisor'}</h2>
              <p className="text-slate-500 mt-1">RUC: {sustento?.emisor.ruc || '—'}</p>
              <p className="text-slate-500">Matriz: {sustento?.emisor.matriz || '—'}</p>
            </div>
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 text-right w-64">
              <p className="font-bold text-slate-900 text-sm">NOTA DE CRÉDITO</p>
              <p className="text-[10px] text-slate-400 mt-2">AMBIENTE: {sustento?.emisor.ambiente || '—'} • EMISIÓN: NORMAL</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 py-4 border-b border-slate-200">
            <div>
              <p className="text-slate-400 text-[10px] uppercase">Cliente</p>
              <p className="font-semibold text-slate-900">{sustento?.cliente || '—'}</p>
              <p className="text-slate-600 font-mono mt-0.5">RUC/CI: {sustento?.identificacion || '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-[10px] uppercase">Documento modificado</p>
              <p className="font-semibold text-slate-900">FACTURA {facturaRef || '—'}</p>
              <p className="text-slate-600 mt-0.5">Fecha original: {sustento?.fecha || '—'}</p>
            </div>
          </div>
          <div className="my-6 border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="p-3 font-semibold">Descripción</th>
                  <th className="p-3 font-semibold text-right">Cant.</th>
                  <th className="p-3 font-semibold text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {itemsActivos.map((prod, idx) => (
                  <tr key={`${prod.codigo}-${idx}`} className="border-b border-slate-100">
                    <td className="p-3">{prod.descripcion}</td>
                    <td className="p-3 text-right font-mono">{prod.cantidadDevolver.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono">${(prod.cantidadDevolver * prod.precioUnitario).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ml-auto w-64 space-y-1.5">
            <div className="flex justify-between text-slate-500"><span>Subtotal 0%</span><span>${subtotal0.toFixed(2)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Subtotal 15%</span><span>${subtotal15.toFixed(2)}</span></div>
            <div className="flex justify-between text-slate-500"><span>IVA 15%</span><span>${iva15.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200"><span>Total</span><span>${totalDevolucion.toFixed(2)}</span></div>
            {motivoAnulacion ? <p className="text-slate-500 pt-2">Motivo: {motivoAnulacion}</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
