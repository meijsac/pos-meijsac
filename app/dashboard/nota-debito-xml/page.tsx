'use client'
import { useState } from 'react'
import Link from 'next/link'

type Motivo = { razon: string; valor: number }
type Sustento = { cliente: string; identificacion: string; fecha: string }

export default function EmisionNotaDebito() {
  const [facturaRef, setFacturaRef] = useState('')
  const [sustento, setSustento] = useState<Sustento | null>(null)
  const [aviso, setAviso] = useState('')
  const [motivos, setMotivos] = useState<Motivo[]>([{ razon: '', valor: 0 }])
  const [cargando, setCargando] = useState(false)
  const [emisor, setEmisor] = useState({ razon: '', ruc: '', matriz: '', ambiente: '' })

  const subtotal = motivos.reduce((acc, item) => acc + Number(item.valor || 0), 0)
  const iva = subtotal * 0.15
  const total = subtotal + iva

  const agregarMotivo = () => setMotivos([...motivos, { razon: '', valor: 0 }])

  const buscarFactura = async () => {
    setAviso('')
    const res = await fetch('/api/facturas', { credentials: 'same-origin' })
    const lista = await res.json().catch(() => [])
    const hallada = Array.isArray(lista) ? lista.find((f) => String(f?.secuencial || '').includes(facturaRef.trim())) : null
    if (!hallada) {
      setSustento(null)
      setAviso('No encontré esa factura entre las emitidas.')
      return
    }
    setSustento({
      cliente: String(hallada.receptorNombre || ''),
      identificacion: String(hallada.receptorIdentificacion || ''),
      fecha: String(hallada.fechaEmision || ''),
    })
    const empresa = await fetch('/api/empresa/mia', { credentials: 'same-origin' }).then((r) => r.json()).catch(() => null)
    const e = empresa?.empresa || empresa || {}
    setEmisor({
      razon: String(e.razonSocial || e.razon || ''),
      ruc: String(e.ruc || ''),
      matriz: String(e.dirMatriz || e.direccion || ''),
      ambiente: String(e.ambiente || ''),
    })
  }

  const handleEmitirSRI = async () => {
    if (!sustento) return alert('Busca primero la factura que se modifica.')
    if (motivos.some((m) => !m.razon.trim() || Number(m.valor) < 0)) return alert('Cada cargo necesita un motivo y un valor de cero o más.')
    setCargando(true)
    try {
      const res = await fetch('/api/sri/nota-debito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numDocModificado: facturaRef,
          fechaEmisionDocSustento: sustento.fecha,
          cliente: sustento.cliente,
          identificacion: sustento.identificacion,
          motivos,
          subtotal,
          iva,
          total,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.autorizado && data.fechaAutorizacion) alert(`Nota de débito autorizada. ${data.fechaAutorizacion}`)
      else alert(data.mensaje || data.error || 'El SRI no autorizó la nota de débito.')
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
          <h1 className="text-lg font-semibold text-white tracking-wide">Nueva Nota de Débito</h1>
          <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-md border border-slate-700">Comprobante 05</span>
        </div>
        <Link href="/dashboard/comprobantes" className="text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg transition">← Volver al Panel</Link>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-[#111827] border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">1. Factura que se modifica</label>
            <div className="flex gap-2">
              <input type="text" value={facturaRef} onChange={(e) => setFacturaRef(e.target.value)} className="flex-1 bg-[#0B0F19] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:border-teal-400 outline-none transition" placeholder="001-002-000000000" />
              <button type="button" onClick={buscarFactura} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-4 rounded-xl border border-slate-700 transition">Buscar</button>
            </div>
            <div className="mt-3 bg-[#0B0F19]/60 border border-slate-800 rounded-xl p-3.5 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">Cliente:</span><span className="text-slate-200 font-medium">{sustento?.cliente || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">RUC / Cédula:</span><span className="text-slate-300 font-mono">{sustento?.identificacion || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Fecha de emisión original:</span><span className="text-slate-300">{sustento?.fecha || '—'}</span></div>
              {aviso ? <p className="text-slate-400">{aviso}</p> : null}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">2. Detalle del cargo adicional</label>
              <button type="button" onClick={agregarMotivo} className="text-xs text-teal-400 hover:text-teal-300 font-medium">+ Añadir fila</button>
            </div>
            <div className="space-y-2.5">
              {motivos.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input type="text" value={item.razon} onChange={(e) => { const nuevos = [...motivos]; nuevos[idx] = { ...nuevos[idx], razon: e.target.value }; setMotivos(nuevos) }} placeholder="Motivo del cargo" className="flex-1 bg-[#0B0F19] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:border-teal-400 outline-none" />
                  <input type="number" min={0} value={item.valor} onChange={(e) => { const nuevos = [...motivos]; nuevos[idx] = { ...nuevos[idx], valor: Number(e.target.value) }; setMotivos(nuevos) }} className="w-24 bg-[#0B0F19] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white text-right font-mono focus:border-teal-400 outline-none" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0B0F19] border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400"><span>Subtotal sin impuestos</span><span className="font-mono text-slate-200">${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-slate-400"><span>IVA (15%)</span><span className="font-mono text-slate-200">${iva.toFixed(2)}</span></div>
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-semibold"><span className="text-white">Total a cobrar</span><span className="font-mono text-teal-400 text-base">${total.toFixed(2)}</span></div>
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/dashboard/comprobantes" className="w-1/3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition text-center">Cancelar</Link>
            <button type="button" onClick={handleEmitirSRI} disabled={cargando} className="w-2/3 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 shadow-lg shadow-teal-500/10 transition disabled:opacity-50">{cargando ? 'Enviando al SRI...' : 'Emitir y Autorizar'}</button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white text-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-200 text-xs">
          <div className="flex justify-between items-start pb-6 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">{emisor.razon || 'Emisor'}</h2>
              <p className="text-slate-500 mt-1">RUC: {emisor.ruc || '—'}</p>
              <p className="text-slate-500">Matriz: {emisor.matriz || '—'}</p>
            </div>
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 text-right w-64">
              <p className="font-bold text-slate-900 text-sm">NOTA DE DÉBITO</p>
              <p className="text-[10px] text-slate-400 mt-2">AMBIENTE: {emisor.ambiente || '—'} • EMISIÓN: NORMAL</p>
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
                  <th className="p-3 font-semibold">Razón de la modificación</th>
                  <th className="p-3 font-semibold text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {motivos.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="p-3">{item.razon || '—'}</td>
                    <td className="p-3 text-right font-mono">${Number(item.valor || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ml-auto w-64 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-slate-500"><span>IVA 15%</span><span>${iva.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200"><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
