'use client'
import { useState } from 'react'

export default function ModuloTransporteReducido({
  onPlacaChange,
  onOperadoraChange,
}: {
  onPlacaChange: (placa: string) => void
  onOperadoraChange?: (activa: boolean) => void
}) {
  const [esOperadora, setEsOperadora] = useState(false)
  const [placa, setPlaca] = useState('')

  const cambiarOperadora = (activa: boolean) => {
    setEsOperadora(activa)
    onOperadoraChange?.(activa)
    if (!activa) {
      setPlaca('')
      onPlacaChange('')
    }
  }

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 mt-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide">🚛 Configuración de Operadora de Transporte</h3>
          <p className="text-[11px] text-white/60 mt-0.5">Activa este campo únicamente para cumplir la normativa de la ficha técnica del SRI sobre transporte.</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={esOperadora} onChange={(e) => cambiarOperadora(e.target.checked)} className="sr-only peer" />
          <div className="w-11 h-6 bg-slate-700 rounded-full peer-checked:bg-sky-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
        </label>
      </div>
      {esOperadora && (
        <div className="mt-4">
          <label className="block text-xs text-white/70">Placa del Vehículo
            <input
              value={placa}
              maxLength={8}
              placeholder="PBA-1234"
              required
              onChange={(e) => {
                const val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8)
                setPlaca(val)
                onPlacaChange(val)
              }}
              className="mt-1 w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2 text-white font-mono uppercase outline-none"
            />
          </label>
          <p className="text-[11px] text-white/50 mt-2">Obligatorio en nodo &lt;infoFactura&gt;. Recuerda que al facturar servicios de transporte, los productos de tu Catálogo Rápido deben llevar configurado el código auxiliar H492001 o H492002 en el XML de detalle.</p>
        </div>
      )}
    </div>
  )
}
