"use client"
import Link from "next/link"
import { MODULOS_ADICIONALES, nombreDocumentoAdicional } from "./catalogo"
import { avisarPlan, documentoAdicionalPermitido } from "@/lib/plan-acceso"
import { useModulosDelPlan } from "@/lib/use-modulos-plan"
import { Marco, tarjeta } from "./marco"

export default function ComprobantesAdicionalesPage() {
  const modulos = useModulosDelPlan()
  return (
    <Marco titulo="Comprobantes adicionales">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULOS_ADICIONALES.map((modulo) => {
          const permitido = !modulo.documentos?.length
            ? documentoAdicionalPermitido(modulos, modulo.titulo)
            : modulo.documentos.some((doc) => documentoAdicionalPermitido(modulos, nombreDocumentoAdicional(modulo.titulo, doc.titulo)))
          return (
          <Link key={modulo.slug} href={permitido ? `/dashboard/comprobantes-adicionales/${modulo.slug}` : "#"} onClick={(e) => { if (!permitido) avisarPlan(e) }} className={`${tarjeta} ${permitido ? "" : "opacity-50"}`}>
            <div>
              <p className="text-lg font-black text-white">{modulo.titulo}</p>
              <p className="text-sm text-slate-400 mt-2">{modulo.detalle}</p>
            </div>
            <p className="text-xs font-bold text-teal-400 mt-6">Abrir</p>
          </Link>
          )
        })}
      </div>
    </Marco>
  )
}
