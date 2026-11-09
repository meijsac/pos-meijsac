"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { guardarEmpresaLocal } from "@/lib/sesion-cliente"

const PROVINCIAS: any = {
  "Pichincha": ["Quito","Cayambe","Mejía","Rumiñahui"],
  "Guayas": ["Guayaquil","Durán","Daule","Samborondón"],
  "Azuay": ["Cuenca","Gualaceo","Paute"],
  "Manabí": ["Manta","Portoviejo","Chone"],
  "El Oro": ["Machala","Pasaje","Santa Rosa"],
  "Tungurahua": ["Ambato","Baños","Pelileo"],
  "Loja": ["Loja","Catamayo"],
  "Los Ríos": ["Babahoyo","Quevedo"],
  "Esmeraldas": ["Esmeraldas","Atacames"],
  "Orellana": ["Coca","Loreto","Joya de los Sachas"],
  "Napo": ["Tena","Archidona"],
  "Pastaza": ["Puyo"],
  "Sucumbíos": ["Nueva Loja","Shushufindi"],
  "Cotopaxi": ["Latacunga","Pujilí"],
  "Chimborazo": ["Riobamba","Alausí"],
  "Imbabura": ["Ibarra","Otavalo"],
  "Santo Domingo": ["Santo Domingo"],
  "Santa Elena": ["Santa Elena","La Libertad","Salinas"],
  "Cañar": ["Azogues"],
  "Bolívar": ["Guaranda"],
  "Carchi": ["Tulcán"],
  "Morona Santiago": ["Macas"],
  "Zamora Chinchipe": ["Zamora"],
  "Galápagos": ["San Cristóbal","Santa Cruz"]
}

const SECTORES = ["Tiendas de Abarrotes / Comercio General","Medicina General","Odontología","Optometría","Transporte","Gasolineras","Restaurantes","Hoteles","Servicios Técnicos","Condominios","Distribuidoras"]
const REGIMENES = [{id:"RIMPE_POPULAR",label:"RIMPE Negocio Popular",destino:"POST TICKET"},{id:"RIMPE_EMPRENDEDOR",label:"RIMPE Emprendedor",destino:"FACTURADOR XML"},{id:"GENERAL",label:"Régimen General",destino:"FACTURADOR XML"}]

export function RegisterEmpresa({ dark, setTipo }: any) {
  const [paso, setPaso] = useState(1)
  const [error, setError] = useState("")
  const router = useRouter()
  // CORREGIDO 1 y 2: ya agregué actividad y contribuyenteEspecial aquí
  const [form, setForm] = useState({ ruc:"", razon:"", nombreComercial:"", tipoContribuyente:"PERSONA_NATURAL", obligado:"NO", provincia:"", canton:"", direccion:"", telefono:"", celular:"", correo:"", respNombre:"", respCelular:"", adminUser:"", adminPass:"", adminPass2:"", sector:"", regimen:"", actividad:"", contribuyenteEspecial:"" })
  
  const validarPaso1 = () => {
    if(form.ruc.length!==13) return "RUC debe tener 13 dígitos"
    if(!form.razon) return "Razón Social obligatoria"
    if(!form.provincia) return "Elige Provincia"
    if(!form.canton) return "Elige Ciudad/Cantón"
    if(form.telefono &&!/^\d{9}$/.test(form.telefono)) return "Teléfono debe tener 9 dígitos"
    if(!/^\d{10}$/.test(form.celular)) return "Celular empresa 10 dígitos"
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) return "Correo no válido"
    return ""
  }
  const validarPaso2 = () => {
    if(!form.respNombre) return "Nombre del responsable obligatorio"
    if(!/^\d{10}$/.test(form.respCelular)) return "Celular responsable 10 dígitos"
    if(!form.adminUser) return "Usuario ADMIN obligatorio"
    if(form.adminPass.length<6) return "Contraseña mínimo 6"
    if(form.adminPass!==form.adminPass2) return "Contraseñas no coinciden"
    return ""
  }

  const siguiente = () => {
    let err=""
    if(paso===1) err=validarPaso1()
    if(paso===2) err=validarPaso2()
    if(paso===3 &&!form.sector) err="Elige Sector"
    if(err){ setError(err); return }
    setError(""); setPaso(paso+1)
  }

  const guardar = async () => {
    if(!form.regimen){ setError("Elige un Régimen SRI"); return }

    // CORREGIDO 3 y 4: sin duplicados, cada campo una sola vez
    const datosEmpresa = {
      ruc: form.ruc,
      razon: form.razon,
      razonSocial: form.razon,
      nombreComercial: form.nombreComercial,
      tipoContribuyente: form.tipoContribuyente,
      obligado: form.obligado,
      obligadoConta: form.obligado,
      provincia: form.provincia,
      canton: form.canton,
      direccion: form.direccion,
      dirMatriz: form.direccion,
      actividad: form.actividad || "",
      contribuyenteEspecial: form.contribuyenteEspecial || "",
      telefono: form.telefono || form.celular || "",
      celular: form.celular,
      correo: form.correo,
      email: form.correo,
      respNombre: form.respNombre,
      respCelular: form.respCelular,
      sector: form.sector,
      regimen: form.regimen,
      adminUser: form.adminUser,
      adminPass: btoa(form.adminPass),
      posTicketHabilitado: form.regimen === "RIMPE_POPULAR",
      fecha: new Date().toISOString(),
      planEstado: "PRUEBA"
    }

    const res = await fetch("/api/empresa/registro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...datosEmpresa, adminPass: form.adminPass }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || "No se pudo abrir el plan de prueba")
      return
    }

    const { adminPass: _clave, ...publico } = datosEmpresa
    guardarEmpresaLocal({ ...publico, ...(data.empresa || {}) }, data.token)
    localStorage.setItem('meijsac_caja_user', JSON.stringify({
      usuario: form.adminUser,
      ruc: form.ruc
    }))

    alert('✅ Empresa y usuario creados: ' + form.ruc)
    router.push('/dashboard')
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {[1,2,3,4].map((p)=><div key={p} className={`h-1 flex-1 rounded-full ${paso>=p?"bg-[#00f5d4]":"bg-white/10"}`}></div>)}
      </div>
      {error && <div className="bg-red-500/20 border border-red-500 text-red-300 text-[11px] p-2 rounded-lg">{error}</div>}

      {paso===1 && (
        <div className="space-y-2">
          <h3 className="font-black text-[12px] text-white">PASO 1: Datos y Ubicación</h3>
          <input value={form.ruc} onChange={e=>setForm({...form, ruc:e.target.value.replace(/\D/g,'')})} placeholder="RUC 13 dígitos *" maxLength={13} className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.tipoContribuyente} onChange={e=>setForm({...form, tipoContribuyente:e.target.value})} className="p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs">
              <option value="PERSONA_NATURAL">Persona Natural</option>
              <option value="SOCIEDAD">Sociedad / Jurídica</option>
            </select>
            <select value={form.obligado} onChange={e=>setForm({...form, obligado:e.target.value})} className="p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs">
              <option value="NO">NO Obligado Contabilidad</option>
              <option value="SI">SI Obligado Contabilidad</option>
            </select>
          </div>
          <input value={form.razon} onChange={e=>setForm({...form, razon:e.target.value})} placeholder="Razón Social *" className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs" />
          <input value={form.nombreComercial} onChange={e=>setForm({...form, nombreComercial:e.target.value})} placeholder="Nombre Comercial" className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs" />
          {/* CORREGIDO 5: ya tienen className igual que los demás */}
          <input placeholder="Actividad Económica Ej: VENTA DE ROPA" value={form.actividad} onChange={e=>setForm({...form, actividad: e.target.value.toUpperCase()})} className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs" />
          <input placeholder="Contribuyente Especial N° (si no es, dejar vacío)" value={form.contribuyenteEspecial} onChange={e=>setForm({...form, contribuyenteEspecial: e.target.value})} className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.provincia} onChange={e=>setForm({...form, provincia:e.target.value, canton:""})} className="p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs">
              <option value="">Provincia *</option>
              {Object.keys(PROVINCIAS).map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.canton} onChange={e=>setForm({...form, canton:e.target.value})} className="p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs">
              <option value="">Cantón *</option>
              {(PROVINCIAS[form.provincia]||[]).map((c:string)=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <input value={form.direccion} onChange={e=>setForm({...form, direccion:e.target.value})} placeholder="Dirección Matriz" className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.telefono} onChange={e=>setForm({...form, telefono:e.target.value.replace(/\D/g,'')})} placeholder="Teléfono 9 dígitos" maxLength={9} className="p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs" />
            <input value={form.celular} onChange={e=>setForm({...form, celular:e.target.value.replace(/\D/g,'')})} placeholder="Celular 10 dígitos *" maxLength={10} className="p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs" />
          </div>
          <input value={form.correo} onChange={e=>setForm({...form, correo:e.target.value})} placeholder="Correo empresa *" className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs" />
        </div>
      )}

      {paso===2 && (
        <div className="space-y-2">
          <h3 className="font-black text-[12px] text-white">PASO 2: Responsable y Acceso</h3>
          <input value={form.respNombre} onChange={e=>setForm({...form, respNombre:e.target.value})} placeholder="Nombre de quien registra *" className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs" />
          <input value={form.respCelular} onChange={e=>setForm({...form, respCelular:e.target.value.replace(/\D/g,'')})} placeholder="Celular responsable 10 dígitos *" maxLength={10} className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs" />
          <div className="h-[1px] bg-white/10 my-1"></div>
          <input value={form.adminUser} onChange={e=>setForm({...form, adminUser:e.target.value})} placeholder="Usuario ADMIN *" className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs" />
          <input type="password" value={form.adminPass} onChange={e=>setForm({...form, adminPass:e.target.value})} placeholder="Contraseña (será cifrada) *" className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs" />
          <input type="password" value={form.adminPass2} onChange={e=>setForm({...form, adminPass2:e.target.value})} placeholder="Repetir Contraseña *" className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs" />
          <p className="text-[9px] text-[#00f5d4]">🔒 Contraseña cifrada con bcrypt en backend</p>
        </div>
      )}

      {paso===3 && (
        <div className="space-y-2">
          <h3 className="font-black text-[12px] text-white">PASO 3: Sector Económico</h3>
          <div className="grid gap-1.5 max-h-[260px] overflow-y-auto">
            {SECTORES.map(s=><button key={s} onClick={()=>setForm({...form, sector:s})} className={`text-left p-3 rounded-xl border text-[11px] ${form.sector===s?"bg-[#00f5d4] text-black border-[#00f5d4] font-bold":"bg-white/5 text-white/70 border-white/10"}`}>{s}</button>)}
          </div>
        </div>
      )}

      {paso===4 && (
        <div className="space-y-2">
          <h3 className="font-black text-[12px] text-white">PASO 4: Régimen SRI</h3>
          <div className="grid gap-2">
            {REGIMENES.map(r=><button key={r.id} onClick={()=>setForm({...form, regimen:r.id})} className={`text-left p-3 rounded-xl border ${form.regimen===r.id?"bg-[#00f5d4] text-black border-[#00f5d4]":"bg-white/5 text-white/70 border-white/10"}`}><div className="font-black text-[12px]">{r.label} → {r.destino}</div></button>)}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {paso>1 && <button onClick={()=>setPaso(paso-1)} className="flex-1 py-3 rounded-xl bg-white/10 text-white text-xs">Atrás</button>}
        {paso<4? <button onClick={siguiente} className="flex-1 py-3 rounded-xl bg-[#00f5d4] text-black font-black text-xs">Siguiente</button> : <button onClick={guardar} className="flex-1 py-3 rounded-xl bg-[#00f5d4] text-black font-black text-xs">CREAR EMPRESA</button>}
      </div>
      <button onClick={()=>setTipo("principal")} className="w-full text-[10px] text-white/30">¿Ya tienes cuenta? Ingresar</button>
    </div>
  )
}