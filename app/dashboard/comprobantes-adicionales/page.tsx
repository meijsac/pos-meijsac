"use client"
import Link from "next/link"
import { MODULOS_ADICIONALES } from "./catalogo"
import { Marco, tarjeta } from "./marco"

export default function ComprobantesAdicionalesPage() {
  return (
    <Marco titulo="Comprobantes adicionales">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULOS_ADICIONALES.map((modulo) => (
          <Link key={modulo.slug} href={`/dashboard/comprobantes-adicionales/${modulo.slug}`} className={tarjeta}>
            <div>
              <p className="text-lg font-black text-white">{modulo.titulo}</p>
              <p className="text-sm text-slate-400 mt-2">{modulo.detalle}</p>
            </div>
            <p className="text-xs font-bold text-teal-400 mt-6">Abrir</p>
          </Link>
        ))}
      </div>
    </Marco>
  )
}
