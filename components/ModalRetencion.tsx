"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export interface CompraRecibida {
  id: string
  claveAcceso: string
  proveedorRuc: string
  proveedorNombre: string
  numeroFactura: string
  fechaEmision: string
  baseImponible: number
  valorIva: number
  totalFactura: number
  estadoRetencion: "POR_RETENER" | "RETENIDO"
  claveRetencion?: string
  subtotalIva15?: number
  subtotalIva0?: number
  subtotalNoObjeto?: number
  subtotalExento?: number
  sustento?: string
  tipo?: string
}

const RENTA = [
  { code: "312", label: "312 - Transferencia de bienes (1.75%)", porc: 1.75 },
  { code: "343", label: "343 - Régimen RIMPE Emprendedor (1%)", porc: 1 },
  { code: "348", label: "348 - Régimen RIMPE Negocio Popular (0%)", porc: 0 },
  { code: "320", label: "320 - Servicios de mano de obra (2.75%)", porc: 2.75 },
  { code: "332", label: "332 - Otras compras de bienes y servicios (2.75%)", porc: 2.75 },
  { code: "344", label: "344 - Microempresas (1.75%)", porc: 1.75 },
  { code: "303", label: "303 - Honorarios profesionales (10%)", porc: 10 },
  { code: "304", label: "304 - Honorarios sin título (8%)", porc: 8 },
  { code: "307", label: "307 - Comisiones (8%)", porc: 8 },
  { code: "308", label: "308 - Artistas y deportistas (2%)", porc: 2 },
  { code: "319", label: "319 - Arriendo de inmueble (8%)", porc: 8 },
  { code: "314A", label: "314A - Publicidad (1%)", porc: 1 },
  { code: "322", label: "322 - Seguros y reaseguros (1.75%)", porc: 1.75 },
  { code: "311", label: "311 - Actividad agrícola (1%)", porc: 1 },
  { code: "338", label: "338 - Combustibles (1%)", porc: 1 },
  { code: "310", label: "310 - Construcción (1.75%)", porc: 1.75 },
  { code: "346", label: "346 - Pagos con tarjeta o entidad financiera (0%)", porc: 0 },
  { code: "318", label: "318 - Dividendos (15%)", porc: 15 },
]

const IVA = [
  { code: "1", label: "1 - 30% Bienes", porc: 30 },
  { code: "2", label: "2 - 70% Servicios", porc: 70 },
  { code: "3", label: "3 - 100% Liquidación / Arriendo", porc: 100 },
  { code: "9", label: "9 - 10% Bienes (Contribuyente especial)", porc: 10 },
  { code: "10", label: "10 - 20% Servicios (Contribuyente especial)", porc: 20 },
  { code: "7", label: "7 - No procede retención (0%)", porc: 0 },
]

function fechaLimpia(fecha: string) {
  const dia = String(fecha || "").match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return dia ? `${dia[1]}/${dia[2]}/${dia[3]}` : ""
}

export default function ModalRetencion({ compra, onClose }: { compra: CompraRecibida; onClose: () => void }) {
  const router = useRouter()
  const nota = String(compra.tipo || "").includes("02") || String(compra.tipo || "").toUpperCase().includes("NOTA")
  const inicialRenta = RENTA.find((item) => item.code === (nota ? "348" : "343")) || RENTA[1]
  const inicialIva = IVA.find((item) => item.code === (nota || Number(compra.valorIva) === 0 ? "7" : "1")) || IVA[0]
  const [codigoRenta, setCodigoRenta] = useState(inicialRenta.code)
  const [porcentajeRenta, setPorcentajeRenta] = useState(inicialRenta.porc)
  const [codigoIva, setCodigoIva] = useState(inicialIva.code)
  const [porcentajeIva, setPorcentajeIva] = useState(inicialIva.porc)
  const [cargando, setCargando] = useState(false)
  const baseRenta = Number(compra.subtotalIva15 ?? (nota ? 0 : compra.baseImponible) ?? 0)
  const fecha = fechaLimpia(compra.fechaEmision)
  const periodo = fecha ? fecha.slice(3) : ""
  const valorRenta = Number(((baseRenta * porcentajeRenta) / 100).toFixed(2))
  const valorIva = Number(((Number(compra.valorIva || 0) * porcentajeIva) / 100).toFixed(2))
  const total = Number((valorRenta + valorIva).toFixed(2))

  const emitir = async () => {
    setCargando(true)
    try {
      const res = await fetch("/api/sri/retencion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedor: { ruc: compra.proveedorRuc, razonSocial: compra.proveedorNombre },
          sustento: {
            codSustento: compra.sustento || "01",
            codDocSustento: String(compra.tipo || "01").slice(0, 2),
            numeroFacturaSinGuiones: String(compra.numeroFactura || "").replace(/\D/g, "").slice(-15),
            fechaEmision: fecha,
            periodoFiscal: periodo,
            claveAcceso: String(compra.claveAcceso || "").replace(/\D/g, ""),
            baseImponible: baseRenta,
            baseCero: Number(compra.subtotalIva0 || 0),
            baseNoObjeto: Number(compra.subtotalNoObjeto || 0),
            baseExento: Number(compra.subtotalExento || 0),
            valorIva: Number(compra.valorIva || 0),
            totalFactura: Number(compra.totalFactura || 0),
          },
          retencionRenta: { codigo: codigoRenta, porcentaje: porcentajeRenta, valor: valorRenta },
          retencionIva: { codigo: codigoIva, porcentaje: porcentajeIva, valor: valorIva },
        }),
      })
      const data = await res.json()
      if (data.autorizado && data.fechaAutorizacion && data.claveAcceso) {
        await fetch(`/api/compras-recibidas/${compra.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claveRetencion: data.claveAcceso, numero: data.numero }),
        })
        router.push(`/dashboard/factura-xml/visor/${data.claveAcceso}`)
        return
      }
      alert(data.mensaje || "El SRI no autorizó la retención.")
    } catch {
      alert("No pude conectar con el servidor.")
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-slate-200">
        <div className="border-b border-slate-800 pb-4 flex justify-between items-start">
          <div>
            <h2 className="text-base font-semibold text-white">Emitir Comprobante de Retención</h2>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-md">Sustento: {compra.claveAcceso}</p>
          </div>
          <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 font-mono">Cód. 07</span>
        </div>
        <div className="bg-[#0B0F19] border border-slate-800/80 rounded-xl p-4 text-xs space-y-2">
          <div className="flex justify-between gap-3"><span className="text-slate-400">Proveedor</span><span className="font-semibold text-white text-right">{compra.proveedorNombre} ({compra.proveedorRuc})</span></div>
          <div className="flex justify-between gap-3"><span className="text-slate-400">Factura sustento</span><span className="font-mono text-slate-200">{compra.numeroFactura} · {fecha}</span></div>
          <div className="flex items-center gap-2 pt-1">
            <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md font-mono text-[11px]">Periodo fiscal: <strong>{periodo}</strong></span>
            <span className="bg-teal-950/50 text-teal-400 border border-teal-500/30 px-2.5 py-1 rounded-md text-[11px]">Clave validada</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-[#0B0F19] border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-slate-400 text-[11px]"><span className="uppercase font-medium">Impuesto a la Renta</span><span className="font-mono">Base: ${baseRenta.toFixed(2)}</span></div>
            <select value={`${codigoRenta}|${porcentajeRenta}`} onChange={(e) => { const [cod, porc] = e.target.value.split("|"); setCodigoRenta(cod); setPorcentajeRenta(Number(porc)) }} className="w-full bg-[#111827] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-400">
              {RENTA.map((item) => <option key={item.code} value={`${item.code}|${item.porc}`}>{item.label}</option>)}
            </select>
            <p className="text-sm font-bold text-teal-400 font-mono">Ret. Renta: ${valorRenta.toFixed(2)} ({porcentajeRenta}%)</p>
          </div>
          <div className="bg-[#0B0F19] border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-slate-400 text-[11px]"><span className="uppercase font-medium">Retención de IVA</span><span className="font-mono">Base: ${Number(compra.valorIva || 0).toFixed(2)}</span></div>
            <select value={`${codigoIva}|${porcentajeIva}`} onChange={(e) => { const [cod, porc] = e.target.value.split("|"); setCodigoIva(cod); setPorcentajeIva(Number(porc)) }} className="w-full bg-[#111827] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-400">
              {IVA.map((item) => <option key={item.code} value={`${item.code}|${item.porc}`}>{item.label}</option>)}
            </select>
            <p className="text-sm font-bold text-teal-400 font-mono">Ret. IVA: ${valorIva.toFixed(2)} ({porcentajeIva}%)</p>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="w-1/3 py-3 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700">Cancelar</button>
          <button type="button" disabled={cargando} onClick={emitir} className="w-2/3 py-3 rounded-xl text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 disabled:opacity-50">{cargando ? "Autorizando en el SRI..." : `Generar retención ($${total.toFixed(2)})`}</button>
        </div>
      </div>
    </div>
  )
}
