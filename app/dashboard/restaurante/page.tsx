"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

export default function RestauranteHub(){
  const [ocupadas, setOcupadas] = useState(0)

  useEffect(()=>{
    const m = localStorage.getItem("meijsac_restaurante_mesas")
    if(m) try{ setOcupadas(JSON.parse(m).filter((x:any)=>x.estado==="OCUPADA").length) }catch{}
  },[])

  return (
    <div className="min-h-screen bg-[#080a0f] text-white p-6">
      <div className="max-w-6xl mx-auto">

        <div className="mb-8">
          <Link href="/dashboard" className="inline-flex items-center bg-white text-black px-5 py-2.5 rounded-full text-[11px] font-black hover:bg-white/90 transition">
            ← Volver a MEIJSAC POS
          </Link>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-black tracking-tight">RESTAURANTE POS</h1>
          <p className="text-[10px] tracking-[0.3em] opacity-30 mt-1">ECOSISTEMA AISLADO - SALÓN / MESERO / KDS / FACTURACIÓN</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/dashboard/restaurante/salon" className="group bg-[#11131a] border border-white/[0.05] hover:border-[#00f5d4]/30 rounded-[24px] p-8 flex flex-col items-center text-center transition-all hover:-translate-y-1">
            <div className="w-16 h-16 rounded-full bg-[#00f5d4]/10 flex items-center justify-center mb-5"><span className="text-3xl">🍽️</span></div>
            <h2 className="font-black text-[14px] text-[#00f5d4]">SALÓN POS</h2>
            <p className="text-[11px] text-white/40 mt-2">Mapa de Mesas • Comandas, split, modificadores</p>
            <div className="mt-6 text-[10px] bg-[#00f5d4]/10 text-[#00f5d4] px-3 py-1 rounded-full">{ocupadas} ocupadas</div>
          </Link>
          <Link href="/dashboard/restaurante/mesero" className="group bg-[#11131a] border border-white/[0.05] hover:border-blue-500/30 rounded-[24px] p-8 flex flex-col items-center text-center transition-all hover:-translate-y-1">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-5"><span className="text-3xl">📱</span></div>
            <h2 className="font-black text-[14px] text-blue-400">APP MESERO</h2>
            <p className="text-[11px] text-white/40 mt-2">Toma pedidos celular • Modo mesero</p>
            <div className="mt-6 text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full">Optimizado móvil</div>
          </Link>
          <Link href="/dashboard/restaurante/kds" className="group bg-[#11131a] border border-white/[0.05] hover:border-red-400/30 rounded-[24px] p-8 flex flex-col items-center text-center transition-all hover:-translate-y-1">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-5"><span className="text-3xl">👨‍🍳</span></div>
            <h2 className="font-black text-[14px] text-red-400">KDS COCINA</h2>
            <p className="text-[11px] text-white/40 mt-2">Pantalla Chef • Timer • Cola de cocina</p>
            <div className="mt-6 text-[10px] bg-red-500/10 text-red-400 px-3 py-1 rounded-full animate-pulse">En vivo</div>
          </Link>
          <Link href="/dashboard/factura-xml" className="group bg-[#11131a] border border-white/[0.05] hover:border-violet-500/30 rounded-[24px] p-8 flex flex-col items-center text-center transition-all hover:-translate-y-1">
            <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center mb-5"><span className="text-3xl">🧾</span></div>
            <h2 className="font-black text-[14px] text-violet-400">FACTURADOR XML</h2>
            <p className="text-[11px] text-white/40 mt-2">SRI 01/19/20 • Propina • Cierre rápido</p>
            <div className="mt-6 text-[10px] bg-violet-500/10 text-violet-400 px-3 py-1 rounded-full">SRI + Cierre rápido</div>
          </Link>
        </div>

        <div className="mt-16 border-t border-white/[0.03] pt-6 flex justify-between">
          <p className="text-[10px] text-white/20">MEIJSAC POS v2.1 • Restaurante</p>
          <p className="text-[10px] text-white/20">System • 2026</p>
        </div>
      </div>
    </div>
  )
}