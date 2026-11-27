"use client"
import Link from "next/link"
import { useParams } from "next/navigation"
import { moduloPorSlug, nombreDocumentoAdicional } from "../catalogo"
import { avisarPlan, documentoAdicionalPermitido } from "@/lib/plan-acceso"
import { useModulosDelPlan } from "@/lib/use-modulos-plan"
import { Marco, tarjeta } from "../marco"

export default function ModuloAdicionalPage() {
  const params = useParams<{ modulo: string }>()
  const modulos = useModulosDelPlan()
  const modulo = moduloPorSlug(String(params.modulo || ""))
  if (!modulo) {
    return (
      <Marco titulo="Apps adicionales">
        <p className="text-slate-300">Ese módulo no está en la lista.</p>
      </Marco>
    )
  }
  if (modulo.construccion) {
    return (
      <Marco titulo={modulo.titulo}>
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-10">
          <p className="text-2xl font-black text-white">En construcción</p>
        </div>
      </Marco>
    )
  }
  return (
    <Marco titulo={modulo.titulo}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(modulo.documentos || []).map((documento) => {
          const permitido = documentoAdicionalPermitido(modulos, nombreDocumentoAdicional(modulo.titulo, documento.titulo))
          return (
          <Link key={documento.slug} href={permitido ? (documento.href || `/dashboard/comprobantes-adicionales/${modulo.slug}/${documento.slug}`) : "#"} onClick={(e) => { if (!permitido) avisarPlan(e) }} className={`${tarjeta} ${permitido ? "" : "opacity-50"}`}>
            <p className="text-lg font-black text-white">{documento.titulo}</p>
            <p className="text-xs font-bold text-teal-400 mt-6">Abrir</p>
          </Link>
          )
        })}
      </div>
    </Marco>
  )
}
