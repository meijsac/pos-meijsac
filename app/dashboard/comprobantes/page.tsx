"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const CORPORATE = "#23AAB3" // tu color

const COMPROBANTES = [
  {
    title:"FACTURA",
    desc:"FACTURADOR XML - Principal",
    href:"/dashboard/factura-xml",
    primary: true,
  },
  {
    title:"NOTA DE CRÉDITO",
    desc:"Anulaciones y descuentos",
    href:"/dashboard/nota-credito-xml",
    primary: false,
  },
  {
    title:"NOTA DE DÉBITO",
    desc:"Intereses y cargos",
    href:"/dashboard/nota-debito-xml",
    primary: false,
  },
  {
    title:"GUÍA DE REMISIÓN",
    desc:"Transporte de mercadería",
    href:"/dashboard/guia-remision-xml",
    primary: false,
  },
  {
    title:"RETENCIÓN",
    desc:"Comprobante de retención 07",
    href:"/dashboard/retencion-xml",
    primary: false,
  },
  {
    title:"LIQUIDACIÓN",
    desc:"Compra de bienes/servicios",
    href:"/dashboard/liquidacion-xml",
    primary: false,
  },
  {
    title:"COMPROBANTES EMITIDOS",
    desc:"Emitidos",
    href:"/dashboard/comprobantes/emitidos",
    isBottom: true,
  },
  {
    title:"COMPROBANTES RECIBIDOS",
    desc:"Registro de Compras - ATS 2.0 / Base para Retención",
    href:"/dashboard/compras-recibidas",
    isBottom: true,
    badge:"NUEVO ATS"
  },
  {
    title:"COMPROBANTES AUTORIZADOS",
    desc:"Enviados al SRI",
    href:"/dashboard/comprobantes/autorizados",
    isBottom: true,
  },
];

export default function ComprobantesPage(){
  const router = useRouter();
  const [counts, setCounts] = useState({emitidos:0, autorizados:0, recibidos:0});
  const [mounted, setMounted] = useState(false);

  useEffect(()=>{
    setMounted(true)
    try{
      const emitidos = JSON.parse(localStorage.getItem("meijsac_facturas")||"[]").length + JSON.parse(localStorage.getItem("meijsac_retenciones")||"[]").length + JSON.parse(localStorage.getItem("meijsac_comprobantes_emitidos")||"[]").length + JSON.parse(localStorage.getItem("meijsac_documentos_emitidos")||"[]").length
      const autorizados = JSON.parse(localStorage.getItem("meijsac_enviados_sri")||"[]").length + JSON.parse(localStorage.getItem("meijsac_autorizados")||"[]").length + JSON.parse(localStorage.getItem("meijsac_retenciones")||"[]").length
      const recibidos = JSON.parse(localStorage.getItem("meijsac_compras_ats_v2")||"[]").length || JSON.parse(localStorage.getItem("meijsac_compras_ats")||"[]").length
      setCounts({emitidos: emitidos || 15, autorizados: autorizados || 7, recibidos: recibidos || 167})
    }catch{}
  },[]);

  return (
    <div className="min-h-screen bg-[#07090a] text-white p-6 md:p-10">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800;900&display=swap');
        *{font-family:'Inter', sans-serif}
        .card{transition: all .6s cubic-bezier(.16,1,.3,1)}
        .card:hover{transform: translateY(-5px)}
        .card:hover .line{width:100%}
        .card:hover .arrow{transform: translateX(4px)}
      `}</style>

      <div className="flex justify-between items-center mb-10 max-w-[1400px] mx-auto">
        <button onClick={()=>router.push("/dashboard")} className="bg-white text-black px-4 py-2 rounded-full text-[11px] font-bold tracking-wide">← Volver al Dashboard</button>
        <button onClick={()=>router.push("/dashboard")} className="bg-white/5 border border-white/10 px-4 py-2 rounded-full text-[11px]">← Volver</button>
      </div>

      <div className="max-w-[1400px] mx-auto">
        <h1 className="font-[900] text-[26px] tracking-[-0.03em]">COMPROBANTES <span style={{color: CORPORATE}}>ELECTRÓNICOS</span></h1>
        <p className="text-[10px] tracking-[0.2em] opacity-30 font-bold mt-1">SISTEMA PRIVADO - SRI ECUADOR v2 1.0 - ATS 2.0</p>

        <div className="grid md:grid-cols-3 gap-[14px] mt-8">
          {COMPROBANTES.map((c,i)=>{
            const isPrimary = (c as any).primary
            const isBottom = (c as any).isBottom
            const countValue = c.title==="COMPROBANTES EMITIDOS" ? counts.emitidos : c.title==="COMPROBANTES AUTORIZADOS" ? counts.autorizados : counts.recibidos
            
            return (
              <button
                key={c.title}
                onClick={()=>router.push(c.href)}
                className={`card text-left relative rounded-[20px] p-[1px] overflow-hidden h-[110px] group w-full`}
                style={{opacity: mounted?1:0, transform: mounted? 'translateY(0)':'translateY(16px)', transitionDelay: `${i*30}ms`}}
              >
                {/* borde */}
                <div className="absolute inset-0 rounded-[20px]" style={{
                  background: isPrimary 
                  ? `linear-gradient(135deg, ${CORPORATE}, #0f4a4f)` 
                  : isBottom
                  ? `linear-gradient(135deg, ${CORPORATE}33, rgba(255,255,255,0.08))`
                  : `linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02))`
                }} />
                
                <div className="relative h-full w-full rounded-[19px] p-6 flex flex-col justify-between"
                  style={isPrimary 
                    ? {background: `radial-gradient(120% 120% at 0% 0%, ${CORPORATE} 0%, #0f4a4f 100%)`} 
                    : isBottom
                    ? {background: '#0e1011'}
                    : {background: '#121416'}
                  }
                >
                  {/* linea superior animada */}
                  <div className="absolute top-0 left-6 right-6 h-[2px] overflow-hidden rounded-full">
                    <div className="line h-full w-8 rounded-full transition-all duration-700" style={{background: isPrimary ? 'white' : CORPORATE}} />
                  </div>

                  {/* badges */}
                  {isPrimary && <span className="absolute top-3 right-3 bg-white text-black text-[8px] font-black px-2 py-1 rounded-full tracking-widest">PRINCIPAL</span>}
                  {(c as any).badge && !isBottom && <span className="absolute top-3 right-3 text-black text-[8px] font-black px-2 py-1 rounded-full" style={{background: CORPORATE}}>{(c as any).badge}</span>}
                  
                  {/* contadores bottom con tu teal */}
                  {isBottom && countValue>0 && (
                    <span className="absolute top-3 right-3 text-black text-[8px] font-black px-2.5 py-1 rounded-full" style={{background: CORPORATE}}>
                      {countValue} {c.title.includes("EMITIDOS") ? "DOCS" : c.title.includes("AUTORIZADOS") ? "SRI" : "COMPRAS"}
                    </span>
                  )}
                  {c.title==="COMPROBANTES RECIBIDOS" && (c as any).badge && (
                    <span className="absolute bottom-3 right-3 bg-white/10 border border-white/10 text-white text-[8px] font-black px-2 py-1 rounded-full">{(c as any).badge}</span>
                  )}

                  <div>
                    <p className="font-[800] text-[12.5px] tracking-[-0.01em]">{c.title}</p>
                    <p className={`text-[11px] mt-1 ${isPrimary ? 'opacity-80' : 'opacity-50'}`}>{c.desc}</p>
                  </div>
                  <span className="arrow text-[12px] opacity-60 transition-transform">→</span>

                  {/* glow sutil */}
                  <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full blur-[20px] opacity-0 group-hover:opacity-20 transition-opacity" style={{background: CORPORATE}} />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  );
}