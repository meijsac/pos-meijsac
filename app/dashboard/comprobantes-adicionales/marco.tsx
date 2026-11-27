"use client"
import type { ReactNode } from "react"
import Link from "next/link"

export function Marco({ titulo, children, claro = false }: { titulo: string; children: ReactNode; claro?: boolean }) {
  return (
    <div className={claro ? "min-h-screen bg-white text-slate-900 p-6 md:p-10" : "min-h-screen bg-[#090D16] text-slate-200 p-6 md:p-10"}>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className={claro ? "flex flex-wrap items-center gap-3 pb-6 border-b border-slate-200" : "flex flex-wrap items-center gap-3 pb-6 border-b border-slate-800/80"}>
          <Link href="/dashboard" className={claro ? "text-xs font-medium text-slate-700 hover:text-slate-950 bg-white border border-slate-300 px-4 py-2.5 rounded-xl" : "text-xs font-medium text-slate-300 hover:text-white bg-[#111827] border border-slate-800 px-4 py-2.5 rounded-xl"}>Dashboard</Link>
          <Link href="/dashboard/comprobantes-adicionales" className={claro ? "text-xs font-medium text-slate-700 hover:text-slate-950 bg-white border border-slate-300 px-4 py-2.5 rounded-xl" : "text-xs font-medium text-slate-300 hover:text-white bg-[#111827] border border-slate-800 px-4 py-2.5 rounded-xl"}>Apps adicionales</Link>
          <h1 className={claro ? "text-2xl font-black text-slate-950" : "text-2xl font-black text-white"}>{titulo}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}

export const tarjeta = "bg-[#111827]/90 hover:bg-[#151E32] border border-slate-800/90 hover:border-teal-500/40 rounded-2xl p-6 transition-all min-h-[150px] flex flex-col justify-between"
