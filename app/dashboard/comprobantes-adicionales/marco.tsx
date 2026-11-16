"use client"
import type { ReactNode } from "react"
import Link from "next/link"

export function Marco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#090D16] text-slate-200 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center gap-3 pb-6 border-b border-slate-800/80">
          <Link href="/dashboard" className="text-xs font-medium text-slate-300 hover:text-white bg-[#111827] border border-slate-800 px-4 py-2.5 rounded-xl">Dashboard</Link>
          <Link href="/dashboard/comprobantes-adicionales" className="text-xs font-medium text-slate-300 hover:text-white bg-[#111827] border border-slate-800 px-4 py-2.5 rounded-xl">Comprobantes adicionales</Link>
          <h1 className="text-2xl font-black text-white">{titulo}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}

export const tarjeta = "bg-[#111827]/90 hover:bg-[#151E32] border border-slate-800/90 hover:border-teal-500/40 rounded-2xl p-6 transition-all min-h-[150px] flex flex-col justify-between"
