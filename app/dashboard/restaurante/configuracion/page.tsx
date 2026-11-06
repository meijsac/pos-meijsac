"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ConfiguracionPage() {
  const router = useRouter()
  const [c, setC] = useState({
    // TIPO DE NEGOCIO PARA EL IF
    tipoNegocio: "restaurante", // restaurante | general | distribuidora | servicios

    // 9. Datos Generales del Contribuyente
    razon: "HERRERA VELOZ EDGAR FAVIAN",
    comercial: "CEVICHERIA EL VECINO",
    matriz: "AV DE LA PRENSA 3748 Y SALVADOR MARTINEZ",
    sucursal: "AV DE LA PRENSA 3748 Y SALVADOR MARTINEZ",
    email: "edgarherrera64@hotmail.com",
    tel: "3300881 - 0980262851",
    obligado: "NO",
    regimen: "Contribuyente Régimen RIMPE Negocio Popular",
    agenteRet: "NO",

    // 1. RUC del Emisor 13 dígitos
    ruc: "1707276760001",

    // 3. Número de Serie y Secuencial 15 dígitos
    estab: "001",
    pto: "002",
    secuencial: "000000347",

    // 6. Ambiente 1 Pruebas / 2 PRODUCCIÓN
    ambiente: "PRODUCCIÓN",

    // 7. Emisión - Fijo NORMAL Código 1
    emision: "NORMAL",
  })

  useEffect(() => {
    const g = localStorage.getItem("meijsac_config_restaurante") || localStorage.getItem("meijsac_config")
    if (g) {
      try {
        const parsed = JSON.parse(g)
        setC((prev) => ({...prev,...parsed }))
      } catch {}
    }
  }, [])

  const fechaEmision8 = new Date().toISOString().slice(0,10).replace(/-/g,"")
  const clavePreview = `${fechaEmision8}01${c.ruc}${c.ambiente==="PRODUCCIÓN"?"2":"1"}${c.estab}${c.pto}${c.secuencial.padStart(9,"0")}12345678`

  const guardar = () => {
    // Guardamos en los dos keys para que tu sistema restaurante y el general lo lean
    localStorage.setItem("meijsac_config_restaurante", JSON.stringify(c))
    localStorage.setItem("meijsac_config", JSON.stringify(c)) // Este es el que lee el IF de la página de estado
    localStorage.setItem("meijsac_secuencial", c.secuencial)

    alert(`✅ Configuración guardada:\nTipo: ${c.tipoNegocio.toUpperCase()}\nRUC ${c.ruc}\nSerie ${c.estab}-${c.pto}-${c.secuencial}\nAmbiente ${c.ambiente}`)

    // IF de redirección según tipo
    if (c.tipoNegocio === "restaurante") {
      window.location.href = "/dashboard/restaurante/facturador-xml"
    } else {
      window.location.href = "/dashboard/comprobantes/emitidos"
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="font-black text-xl">CONFIGURACION SRI - FICHA TECNICA 31 CAMPOS</h1>
          <p className="text-xs opacity-50">I. Datos del Emisor / Control SRI - Bloque Superior [sri-esquema-nota-debito]</p>
          <p className="text-[10px] opacity-30 font-mono">Clave 49 preview: {clavePreview} + DV Módulo 11 | Serie: {c.estab}-{c.pto}-{c.secuencial}</p>
        </div>
        <button onClick={()=>router.push("/dashboard")} className="bg-white/10 px-4 py-2 rounded-xl text-xs font-bold">← DASHBOARD</button>
      </div>

      <div className="max-w-4xl bg-slate-900 p-5 rounded-2xl border border-white/10 space-y-3">

        {/* NUEVO BLOQUE - IF TIPO DE NEGOCIO */}
        <div className="bg-[#ffbe0a]/10 border border-[#ffbe0a]/30 p-4 rounded-xl">
          <p className="text-[10px] font-black tracking-widest text-[#ffbe0a] mb-2">⚙️ TIPO DE NEGOCIO - SISTEMA IF (TU IDEA GENIAL)</p>
          <label className="text-[10px] opacity-70">¿Cómo se registra el cliente? Esto cambia los botones automáticamente</label>
          <select
            className="w-full mt-2 bg-black border border-[#ffbe0a]/30 p-3 rounded-lg text-sm font-black"
            value={c.tipoNegocio}
            onChange={e=>setC({...c, tipoNegocio: e.target.value})}
          >
            <option value="restaurante">🍽️ RESTAURANTE / CEVICHERÍA - Muestra VOLVER A MESAS</option>
            <option value="general">🔧 GENERAL / FERRETERÍA - Muestra VOLVER A COMPROBANTES</option>
            <option value="distribuidora">📦 DISTRIBUIDORA - Muestra VOLVER A FACTURACIÓN</option>
            <option value="servicios">💼 SERVICIOS - Muestra VOLVER A DASHBOARD</option>
          </select>
          <p className="text-[9px] opacity-40 mt-2">
            {c.tipoNegocio === "restaurante" && "→ En la página de estado saldrá: VOLVER A MESAS - MESA LIBRE AZUL"}
            {c.tipoNegocio === "general" && "→ En la página de estado saldrá: VOLVER A COMPROBANTES EMITIDOS"}
            {c.tipoNegocio === "distribuidora" && "→ En la página de estado saldrá: VOLVER A FACTURACIÓN"}
            {c.tipoNegocio === "servicios" && "→ En la página de estado saldrá: VOLVER A DASHBOARD"}
          </p>
        </div>

        <p className="text-[10px] font-black tracking-widest text-cyan-400">9. DATOS GENERALES DEL CONTRIBUYENTE</p>
        <input className="w-full bg-black border border-white/10 p-3 rounded-lg text-sm" value={c.razon} onChange={e=>setC({...c, razon: e.target.value})} placeholder="Razón Social: HERRERA VELOZ EDGAR FAVIAN" />
        <input className="w-full bg-black border border-white/10 p-3 rounded-lg text-sm" value={c.comercial} onChange={e=>setC({...c, comercial: e.target.value})} placeholder="Nombre Comercial: EL VECINO" />
        <input className="w-full bg-black border border-white/10 p-3 rounded-lg text-sm" value={c.matriz} onChange={e=>setC({...c, matriz: e.target.value})} placeholder="Dirección Matriz" />
        <input className="w-full bg-black border border-white/10 p-3 rounded-lg text-sm" value={c.sucursal} onChange={e=>setC({...c, sucursal: e.target.value})} placeholder="Dirección Sucursal" />

        <div className="grid grid-cols-2 gap-3">
          <input className="bg-black border border-white/10 p-3 rounded-lg text-sm" value={c.email} onChange={e=>setC({...c, email: e.target.value})} placeholder="Correo electrónico" />
          <input className="bg-black border border-white/10 p-3 rounded-lg text-sm" value={c.tel} onChange={e=>setC({...c, tel: e.target.value})} placeholder="Teléfono" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] opacity-50">Obligado Contabilidad</label>
            <select className="w-full bg-black border border-white/10 p-3 rounded-lg text-sm" value={c.obligado} onChange={e=>setC({...c, obligado: e.target.value})}>
              <option value="NO">NO</option>
              <option value="SI">SÍ</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] opacity-50">Régimen Tributario / Agente Retención</label>
            <input className="w-full bg-black border border-white/10 p-3 rounded-lg text-sm" value={c.regimen} onChange={e=>setC({...c, regimen: e.target.value})} placeholder="Contribuyente Régimen RIMPE" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] opacity-50">Agente de Retención - Resolución</label>
            <input className="w-full bg-black border border-white/10 p-3 rounded-lg text-sm" value={c.agenteRet} onChange={e=>setC({...c, agenteRet: e.target.value})} placeholder="NO o Nº Resolución" />
          </div>
          <div>
            <label className="text-[10px] opacity-50">7. Emisión - Código 1 NORMAL</label>
            <input className="w-full bg-black border border-white/10 p-3 rounded-lg text-sm" value={c.emision} onChange={e=>setC({...c, emision: e.target.value})} placeholder="NORMAL" />
          </div>
        </div>

        <p className="text-[10px] font-black tracking-widest text-cyan-400 pt-3 border-t border-white/10">I. CONTROL SRI - 1 al 8</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] opacity-50">1. RUC 13 dígitos sin guiones</label>
            <input className="w-full bg-black border border-white/10 p-3 rounded-lg text-sm font-black" value={c.ruc} onChange={e=>setC({...c, ruc: e.target.value})} />
          </div>
          <div>
            <label className="text-[10px] opacity-50">6. Ambiente Web Service 1 Pruebas / 2 PROD</label>
            <select className="w-full bg-black border border-white/10 p-3 rounded-lg text-sm" value={c.ambiente} onChange={e=>setC({...c, ambiente: e.target.value})}>
              <option>PRODUCCIÓN</option>
              <option>PRUEBAS</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] opacity-50">3. Establecimiento 001</label>
            <input className="w-full bg-black border border-white/10 p-3 rounded-lg text-sm" value={c.estab} onChange={e=>setC({...c, estab: e.target.value})} />
          </div>
          <div>
            <label className="text-[10px] opacity-50">Punto Emisión 002</label>
            <input className="w-full bg-black border border-white/10 p-3 rounded-lg text-sm" value={c.pto} onChange={e=>setC({...c, pto: e.target.value})} />
          </div>
          <div>
            <label className="text-[10px] opacity-50">Secuencial 9 dígitos</label>
            <input className="w-full bg-black border border-white/10 p-3 rounded-lg text-sm font-black" value={c.secuencial} onChange={e=>setC({...c, secuencial: e.target.value})} />
          </div>
        </div>

        <div className="bg-black p-3 rounded-lg border border-white/5">
          <p className="text-[9px] opacity-50">2. Denominación: Factura | 4. Clave Acceso 49 dígitos = Fecha8 + Tipo 01 + RUC13 + Ambiente1 + Serie6 + Secuencial9 + Código8 + TipoEmisión1 + DV Módulo11 | 5. Código Barras Code 128 = 49 dígitos | 8. Fecha Autorización = Sello Web Service SRI</p>
          <p className="text-[10px] font-mono mt-2 break-all">Serie Final: {c.estab}-{c.pto}-{c.secuencial.padStart(9,"0")} | Clave: {clavePreview}X</p>
        </div>

        <button
          onClick={guardar}
          className="w-full bg-cyan-400 text-black p-4 rounded-xl font-black text-sm hover:bg-white transition"
        >
          GUARDAR FICHA TECNICA - {c.tipoNegocio.toUpperCase()} - 31 CAMPOS BLINDADOS
        </button>
      </div>
    </div>
  )
}