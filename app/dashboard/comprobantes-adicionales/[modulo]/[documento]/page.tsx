"use client"
import Link from "next/link"
import { useParams } from "next/navigation"
import { moduloPorSlug } from "../../catalogo"
import { Marco } from "../../marco"

export default function DocumentoAdicionalPage() {
  const params = useParams<{ modulo: string; documento: string }>()
  const modulo = moduloPorSlug(String(params.modulo || ""))
  const documento = modulo?.documentos?.find((item) => item.slug === String(params.documento || ""))
  if (!modulo || modulo.construccion || !documento) {
    return (
      <Marco titulo={modulo?.titulo || "Comprobantes adicionales"}>
        <p className="text-slate-300">{modulo?.construccion ? "En construcción" : "Ese documento no está en la lista."}</p>
      </Marco>
    )
  }
  return (
    <Marco titulo={`${modulo.titulo} · ${documento.titulo}`}>
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-8 space-y-3">
        <p className="text-2xl font-black text-white">{documento.titulo}</p>
        <p className="text-slate-300">{modulo.titulo}</p>
        <Link href={`/dashboard/comprobantes-adicionales/${modulo.slug}`} className="inline-block text-sm font-bold text-teal-400">Volver a {modulo.titulo}</Link>
      </div>
    </Marco>
  )
}
