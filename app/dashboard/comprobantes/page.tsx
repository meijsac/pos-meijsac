"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { esDelAmbiente } from "@/lib/ambiente-datos"
import { useAmbienteVivo } from "@/components/SelloAmbiente"

function Icono({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const FLECHA = "M7 17 L17 7 M9 7 h8 v8"
const DOC = "M14 3 H7 a2 2 0 0 0-2 2 v14 a2 2 0 0 0 2 2 h10 a2 2 0 0 0 2-2 V8 z M14 3 v5 h5 M8 13 h8 M8 17 h5"
const MENOS = "M14 3 H7 a2 2 0 0 0-2 2 v14 a2 2 0 0 0 2 2 h10 a2 2 0 0 0 2-2 V8 z M14 3 v5 h5 M9 14 h6"
const MAS = "M14 3 H7 a2 2 0 0 0-2 2 v14 a2 2 0 0 0 2 2 h10 a2 2 0 0 0 2-2 V8 z M14 3 v5 h5 M12 12 v6 M9 15 h6"
const CAMION = "M3 7 h11 v8 H3 z M14 10 h4 l3 3 v2 h-7 z M7 18 a1.5 1.5 0 1 0 0.01 0 M17 18 a1.5 1.5 0 1 0 0.01 0"
const CHECK = "M14 3 H7 a2 2 0 0 0-2 2 v14 a2 2 0 0 0 2 2 h10 a2 2 0 0 0 2-2 V8 z M14 3 v5 h5 M8 14 l2 2 4-4"
const BOLSA = "M6 8 h12 l-1 12 H7 z M9 8 V6 a3 3 0 0 1 6 0 v2"
const RELOJ = "M12 7 v5 l3 2 M12 21 a9 9 0 1 0 0-18 a9 9 0 0 0 0 18"
const RECIBO = "M7 3 h10 v18 l-2-1.5 L13 21 l-2-1.5 L9 21 l-2-1.5 V3 z M9 8 h6 M9 12 h6"
const AJUSTE = "M12 8 a4 4 0 1 0 0.01 0 M12 3 v2 M12 19 v2 M3 12 h2 M19 12 h2 M5.6 5.6 l1.4 1.4 M17 17 l1.4 1.4 M18.4 5.6 L17 7 M7 17 l-1.4 1.4"
const ESCUDO = "M12 3 l7 3 v6 c0 4.5-3 7.5-7 9 c-4-1.5-7-4.5-7-9 V6 z M9 12 l2 2 l4-4"

const EMITIR = [
  { title: "Factura", desc: "Venta de productos y servicios", href: "/dashboard/factura-xml", principal: true, icono: DOC },
  { title: "Nota de Crédito", desc: "Devoluciones, descuentos y anulaciones", href: "/dashboard/nota-credito-xml", codigo: "04", icono: MENOS },
  { title: "Nota de Débito", desc: "Intereses por mora y cargos adicionales", href: "/dashboard/nota-debito-xml", codigo: "05", icono: MAS },
  { title: "Guía de Remisión", desc: "Sustento de traslado y transporte de carga", href: "/dashboard/guia-remision-xml", codigo: "06", icono: CAMION },
  { title: "Retención", desc: "Retenciones a proveedores", href: "/dashboard/retencion-xml", codigo: "07", icono: CHECK },
  { title: "Liquidación de Compra", desc: "Compras a proveedores informales sin RUC", href: "/dashboard/liquidacion-xml", codigo: "03", icono: BOLSA },
]

function contar(clave: string, codigo: string) {
  try { return JSON.parse(localStorage.getItem(clave) || "[]").filter((fila: unknown) => esDelAmbiente(fila, codigo)).length } catch { return 0 }
}

const tarjeta = "group bg-[#111827]/90 hover:bg-[#151E32] border border-slate-800/90 border-t-slate-700/50 hover:border-teal-500/40 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-lg flex flex-col justify-between min-h-[165px]"

export default function ComprobantesPage() {
  const [historial, setHistorial] = useState(0)
  const [compras, setCompras] = useState(0)
  const codigoVivo = useAmbienteVivo()
  const [firmaVigente, setFirmaVigente] = useState<boolean | null>(null)

  useEffect(() => {
    if (codigoVivo !== "1" && codigoVivo !== "2") return
    setHistorial(contar("meijsac_facturas", codigoVivo) + contar("meijsac_retenciones", codigoVivo) + contar("meijsac_comprobantes_emitidos", codigoVivo) + contar("meijsac_documentos_emitidos", codigoVivo))
    setCompras(contar("meijsac_compras_ats_v2", codigoVivo) || contar("meijsac_compras_ats", codigoVivo))
    fetch("/api/empresa/mia", { credentials: "same-origin" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const empresa = data?.empresa
        if (!empresa) return
        const vence = empresa.firmaExpira ? new Date(empresa.firmaExpira).getTime() : 0
        setFirmaVigente(vence > Date.now())
      })
      .catch(() => {})
  }, [codigoVivo])

  const produccion = codigoVivo === "2"

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-200 p-6 md:p-10 font-sans selection:bg-teal-500/30">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="group text-xs font-medium text-slate-300 hover:text-white bg-[#111827] hover:bg-slate-800 border border-slate-800 px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-sm">
              <span className="text-slate-400 group-hover:text-teal-400 transition">←</span>
              Dashboard
            </Link>
            <Link href="/dashboard/factura-xml" className="group text-xs font-medium text-slate-300 hover:text-white bg-[#111827] hover:bg-slate-800 border border-slate-800 px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-sm">
              <span className="text-teal-400"><Icono d={DOC} className="w-4 h-4" /></span>
              Facturador
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Comprobantes <span className="text-teal-400">Electrónicos</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">Gestión y emisión de documentos electrónicos autorizados</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
              <div className={`px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-inner border ${produccion ? "bg-[#111827] border-teal-500/30 text-teal-300" : "bg-[#111827] border-amber-500/30 text-amber-300"}`}>
                <span className={`w-2 h-2 rounded-full ${produccion ? "bg-teal-400" : "bg-amber-400 animate-pulse"}`} />
                <span className="font-medium">{produccion ? "Ambiente Producción" : "Modo Pruebas"}</span>
              </div>
              <div className={`bg-[#111827] px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-inner border ${firmaVigente ? "border-slate-800 text-slate-200" : "border-rose-500/30 text-rose-300"}`}>
                <span className={firmaVigente ? "text-teal-400" : "text-rose-400"}><Icono d={ESCUDO} /></span>
                <span className="font-medium">{firmaVigente ? "Firma activa" : "Firma caducada"}</span>
              </div>
            </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Emitir nuevo documento</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {EMITIR.map((item) => item.principal ? (
              <Link key={item.href} href={item.href} className="group relative overflow-hidden bg-gradient-to-b from-[#131F2E] to-[#0F1623] border border-teal-500/40 hover:border-teal-400 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-xl shadow-teal-950/20 flex flex-col justify-between min-h-[165px]">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-400/20 transition" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="w-11 h-11 rounded-xl bg-teal-400/15 border border-teal-400/30 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform">
                    <Icono d={item.icono} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-400 text-slate-950 px-2.5 py-1 rounded-lg shadow-sm">Principal</span>
                </div>
                <div className="mt-5 relative z-10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition">{item.title}</h3>
                    <Icono d={FLECHA} className="w-4 h-4 text-teal-400 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                </div>
              </Link>
            ) : (
              <Link key={item.href} href={item.href} className={tarjeta}>
                <div className="flex justify-between items-start">
                  <div className="w-11 h-11 rounded-xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-slate-300 group-hover:text-teal-400 group-hover:border-teal-500/30 transition">
                    <Icono d={item.icono} />
                  </div>
                  {item.codigo && <span className="text-[11px] font-mono text-slate-500 group-hover:text-slate-400">{item.codigo}</span>}
                </div>
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white group-hover:text-teal-300 transition">{item.title}</h3>
                    <Icono d={FLECHA} className="w-4 h-4 text-slate-600 group-hover:text-teal-400 transition" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Control y configuración</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Link href="/dashboard/comprobantes/emitidos" className={tarjeta}>
              <div className="flex justify-between items-start">
                <div className="w-11 h-11 rounded-xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-slate-300 group-hover:text-teal-400 group-hover:border-teal-500/30 transition">
                  <Icono d={RELOJ} />
                </div>
              </div>
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white group-hover:text-teal-300 transition">Historial de Comprobantes</h3>
                  <Icono d={FLECHA} className="w-4 h-4 text-slate-600 group-hover:text-teal-400 transition" />
                </div>
                <p className="text-xs text-slate-400 mt-1">{historial} documentos, con la bandeja de pendientes del SRI</p>
              </div>
            </Link>
            <Link href="/dashboard/compras-recibidas" className={tarjeta}>
              <div className="flex justify-between items-start">
                <div className="w-11 h-11 rounded-xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-slate-300 group-hover:text-teal-400 group-hover:border-teal-500/30 transition">
                  <Icono d={RECIBO} />
                </div>
              </div>
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white group-hover:text-teal-300 transition">Compras recibidas</h3>
                  <Icono d={FLECHA} className="w-4 h-4 text-slate-600 group-hover:text-teal-400 transition" />
                </div>
                <p className="text-xs text-slate-400 mt-1">{compras} compras para el ATS y la retención</p>
              </div>
            </Link>
            <Link href="/dashboard/configuracion?tab=SECUENCIALES" className={tarjeta}>
              <div className="flex justify-between items-start">
                <div className="w-11 h-11 rounded-xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-slate-300 group-hover:text-teal-400 group-hover:border-teal-500/30 transition">
                  <Icono d={AJUSTE} />
                </div>
              </div>
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white group-hover:text-teal-300 transition">Puntos de emisión</h3>
                  <Icono d={FLECHA} className="w-4 h-4 text-slate-600 group-hover:text-teal-400 transition" />
                </div>
                <p className="text-xs text-slate-400 mt-1">Secuenciales 01, 03, 04, 05, 06 y 07</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
