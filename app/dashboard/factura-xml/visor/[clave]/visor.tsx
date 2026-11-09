"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

export function VisorComprobante({ clave }: { clave: string }) {
  const marco = useRef<HTMLIFrameElement>(null)
  const [ticket, setTicket] = useState(false)
  const [estado, setEstado] = useState("Enviando al SRI…")
  const [marca, setMarca] = useState(0)
  const src = `/dashboard/factura-xml/pdf/${clave}${ticket ? "?ticket=1" : ""}${ticket ? "&" : "?"}v=${marca}`

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const res = await fetch("/api/facturar/sri", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("meijsac_token") || ""}` },
        body: JSON.stringify({ claveAcceso: clave }),
      })
      const data = await res.json().catch(() => ({}))
      if (!vivo) return
      const fecha = String(data.fechaAutorizacion || "").trim()
      setEstado(fecha ? `Autorizado ${fecha}` : (data.mensaje || data.error || "Pendiente de autorización"))
      setMarca((n) => n + 1)
      try {
        const lista = await fetch("/api/facturas", { headers: { Authorization: `Bearer ${localStorage.getItem("meijsac_token") || ""}` } }).then((r) => r.json()).catch(() => [])
        const guardado = Array.isArray(lista) ? lista.find((d) => String(d?.claveAcceso || "").replace(/\D/g, "") === clave) : null
        const doc = guardado || { claveAcceso: clave, estadoSRI: fecha ? "AUTORIZADO" : "PENDIENTE", fechaAutorizacion: fecha, numeroAutorizacion: data.numeroAutorizacion || "", mensajeSri: data.mensaje || data.error || "" }
        const emitirEn = ["meijsac_comprobantes_emitidos", "meijsac_documentos_emitidos", "meijsac_enviados_sri"]
        const autorizarEn = fecha ? ["meijsac_comprobantes_sri", "meijsac_autorizados"] : []
        for (const caja of [...emitirEn, ...autorizarEn]) {
          const previa = JSON.parse(localStorage.getItem(caja) || "[]")
          const i = Array.isArray(previa) ? previa.findIndex((d: { claveAcceso?: string }) => String(d?.claveAcceso || "").replace(/\D/g, "") === clave) : -1
          const base = Array.isArray(previa) ? previa : []
          if (i >= 0) base[i] = { ...base[i], ...doc }
          else base.push(doc)
          localStorage.setItem(caja, JSON.stringify(base))
        }
      } catch {}
    })()
    return () => { vivo = false }
  }, [clave])

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="print:hidden bg-slate-900 text-white p-4 flex justify-between items-center gap-3 shadow-md sticky top-0 z-10">
        <div className="flex gap-2 flex-wrap">
          <Link href="/dashboard/factura-xml" className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-xs font-medium">Regresar a facturar</Link>
          <Link href="/dashboard" className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-xs font-medium">Ir al dashboard</Link>
        </div>
        <p className="text-[11px] text-slate-300 max-w-sm truncate">{estado}</p>
        <div className="flex gap-2 flex-wrap justify-end">
          <button type="button" onClick={() => marco.current?.contentWindow?.print()} className="bg-sky-600 hover:bg-sky-500 px-4 py-1.5 rounded text-xs font-bold">Imprimir documento</button>
          <button type="button" onClick={() => setTicket((v) => !v)} className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-xs font-medium">{ticket ? "Ver RIDE" : "Ticket 80mm"}</button>
          <a href={`/dashboard/factura-xml/pdf/${clave}?xml=1`} className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded text-xs font-medium">Descargar XML</a>
        </div>
      </div>
      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-y-auto">
        <div className={`bg-white shadow-lg border border-slate-200 rounded-lg print:shadow-none print:border-none ${ticket ? "w-[80mm] p-0" : "max-w-4xl w-full p-4"}`}>
          <iframe ref={marco} key={src} src={src} title="Comprobante" className={`w-full border-none ${ticket ? "h-[70vh]" : "h-[75vh]"}`} />
        </div>
      </div>
    </div>
  )
}
