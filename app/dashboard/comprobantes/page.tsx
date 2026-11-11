"use client"
import Link from "next/link"
import { useEffect, useState } from "react"

const EMITIR = [
  { title: "Factura", desc: "Venta de productos y servicios", href: "/dashboard/factura-xml", principal: true },
  { title: "Nota de Crédito", desc: "Devoluciones, descuentos y anulaciones", href: "/dashboard/nota-credito-xml" },
  { title: "Nota de Débito", desc: "Intereses por mora y cargos adicionales", href: "/dashboard/nota-debito-xml" },
  { title: "Guía de Remisión", desc: "Sustento de traslado y transporte de carga", href: "/dashboard/guia-remision-xml" },
  { title: "Retención", desc: "Retenciones a proveedores", href: "/dashboard/retencion-xml" },
  { title: "Liquidación de Compra", desc: "Compras a proveedores informales sin RUC", href: "/dashboard/liquidacion-xml" },
]

function contar(clave: string) {
  try { return JSON.parse(localStorage.getItem(clave) || "[]").length } catch { return 0 }
}

export default function ComprobantesPage() {
  const [historial, setHistorial] = useState(0)
  const [compras, setCompras] = useState(0)
  const [ambiente, setAmbiente] = useState("")
  const [firmaVigente, setFirmaVigente] = useState<boolean | null>(null)

  useEffect(() => {
    setHistorial(contar("meijsac_facturas") + contar("meijsac_retenciones") + contar("meijsac_comprobantes_emitidos") + contar("meijsac_documentos_emitidos"))
    setCompras(contar("meijsac_compras_ats_v2") || contar("meijsac_compras_ats"))
    fetch("/api/empresa/mia", { credentials: "same-origin" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const empresa = data?.empresa
        if (!empresa) return
        const texto = String(empresa.ambiente || "").toUpperCase()
        setAmbiente(texto === "2" || texto.includes("PROD") ? "PRODUCCION" : "PRUEBAS")
        const vence = empresa.firmaExpira ? new Date(empresa.firmaExpira).getTime() : 0
        setFirmaVigente(vence > Date.now())
      })
      .catch(() => {})
  }, [])

  const produccion = ambiente === "PRODUCCION"

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800/70">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xs font-medium text-slate-400 hover:text-white bg-[#111827] border border-slate-800 px-4 py-2 rounded-xl transition">
              ← Dashboard
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">
                Comprobantes <span className="text-teal-400">Electrónicos</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">Gestión y emisión de documentos electrónicos autorizados</p>
            </div>
          </div>

          {ambiente && (
            <div className="flex items-center gap-2.5 text-[11px]">
              <span className={`px-3 py-1.5 rounded-xl border font-medium flex items-center gap-1.5 ${produccion ? "bg-teal-950/30 text-teal-400 border-teal-500/30" : "bg-amber-950/30 text-amber-300 border-amber-500/30"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${produccion ? "bg-teal-400" : "bg-amber-400"}`} />
                {produccion ? "Ambiente Producción" : "Modo Pruebas"}
              </span>
              <span className={`px-3 py-1.5 rounded-xl border font-medium ${firmaVigente ? "bg-[#111827] text-slate-300 border-slate-800" : "bg-rose-950/30 text-rose-400 border-rose-500/30"}`}>
                {firmaVigente ? "Firma activa" : "Firma caducada"}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">Emitir nuevo documento</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {EMITIR.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`group rounded-2xl p-6 min-h-[145px] flex flex-col justify-between transition-all duration-200 ${item.principal ? "bg-gradient-to-br from-teal-950/40 via-[#111827] to-[#111827] border border-teal-500/30 hover:border-teal-400/70 shadow-lg" : "bg-[#111827] border border-slate-800/80 hover:border-slate-700"}`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white group-hover:text-teal-300 transition">{item.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                  </div>
                  {item.principal && <span className="text-[10px] font-semibold uppercase tracking-wider bg-teal-400/10 text-teal-400 border border-teal-400/20 px-2.5 py-1 rounded-lg">Principal</span>}
                </div>
                <div className={`flex items-center pt-4 ${item.principal ? "justify-between mt-2 border-t border-slate-800/60" : "justify-end"}`}>
                  {item.principal && <span className="text-[11px] text-teal-400/80 font-medium">Abrir punto de venta</span>}
                  <span className="text-slate-500 group-hover:text-teal-400 text-sm transform group-hover:translate-x-1 transition-all">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">Control y configuración</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/dashboard/comprobantes/emitidos" className="group bg-[#111827] border border-slate-800/80 hover:border-slate-700 rounded-2xl p-6 min-h-[145px] flex flex-col justify-between">
              <div>
                <h3 className="text-base font-semibold text-white group-hover:text-teal-300 transition">Historial de Comprobantes</h3>
                <p className="text-xs text-slate-400 mt-1">{historial} documentos, con la bandeja de pendientes del SRI</p>
              </div>
              <div className="flex justify-end pt-4"><span className="text-slate-500 group-hover:text-teal-400 text-sm transform group-hover:translate-x-1 transition-all">→</span></div>
            </Link>
            <Link href="/dashboard/compras-recibidas" className="group bg-[#111827] border border-slate-800/80 hover:border-slate-700 rounded-2xl p-6 min-h-[145px] flex flex-col justify-between">
              <div>
                <h3 className="text-base font-semibold text-white group-hover:text-teal-300 transition">Compras recibidas</h3>
                <p className="text-xs text-slate-400 mt-1">{compras} compras para el ATS y la retención</p>
              </div>
              <div className="flex justify-end pt-4"><span className="text-slate-500 group-hover:text-teal-400 text-sm transform group-hover:translate-x-1 transition-all">→</span></div>
            </Link>
            <Link href="/dashboard/configuracion?tab=SECUENCIALES" className="group bg-[#111827] border border-slate-800/80 hover:border-slate-700 rounded-2xl p-6 min-h-[145px] flex flex-col justify-between">
              <div>
                <h3 className="text-base font-semibold text-white group-hover:text-teal-300 transition">Puntos de emisión</h3>
                <p className="text-xs text-slate-400 mt-1">Secuenciales 01, 03, 04, 05, 06 y 07</p>
              </div>
              <div className="flex justify-end pt-4"><span className="text-slate-500 group-hover:text-teal-400 text-sm transform group-hover:translate-x-1 transition-all">→</span></div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
