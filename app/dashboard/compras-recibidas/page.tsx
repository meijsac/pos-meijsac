"use client"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"

interface CompraATS {
  id:string; claveAccesoProveedor:string; secuencial:string; rucProveedor:string; razonSocialProveedor:string; fechaEmision:string;
  subtotalNoObjeto:number; subtotalIva0:number; subtotalIva15:number; subtotalExento:number; valorIva:number; totalDocumento:number;
  sustento:string; estadoAts:'POR RETENER'|'RETENIDO'; tipo:string; numRetencion?:string
}

const CATALOGO_RENTA = [
  { code:"312", label:"312 - Bienes Muebles 1.75%", porc:1.75, desc:"Compra general mercadería" },
  { code:"343", label:"343 - RIMPE EMPRENDEDOR 1% ★", porc:1.00, desc:"EL REY DEL RESTAURANTE", fav:true },
  { code:"348", label:"348 - RIMPE NEGOCIO POPULAR 0%", porc:0.00, desc:"Informativo XML obligatorio" },
  { code:"320", label:"320 - Servicios Mano Obra 2.75%", porc:2.75, desc:"Fletes, limpieza, seguridad" },
  { code:"332", label:"332 - Otras Compras 2.75%", porc:2.75, desc:"Código descarte contable" },
  { code:"344", label:"344 - Microempresas 1.75%", porc:1.75, desc:"Rezagos microempresas" },
  { code:"303", label:"303 - Honorarios con Título 10%", porc:10.00, desc:"Abogados, contadores" },
  { code:"304", label:"304 - Honorarios sin Título 8%", porc:8.00, desc:"Intelectuales sin título" },
  { code:"307", label:"307 - Comisiones 8%", porc:8.00, desc:"Delivery, agencias" },
  { code:"308", label:"308 - Artistas 2%", porc:2.00, desc:"Deportistas, comunicación" },
  { code:"319", label:"319 - Arriendo Inmueble 8%", porc:8.00, desc:"Pago local comercial" },
  { code:"314A", label:"314A - Publicidad 1%", porc:1.00, desc:"Medios locales/digitales" },
  { code:"322", label:"322 - Seguros 1.75%", porc:1.75, desc:"Primas seguros" },
  { code:"311", label:"311 - Agrícola 1%", porc:1.00, desc:"Pollo/verdura directo productor" },
  { code:"338", label:"338 - Combustible 1%", porc:1.00, desc:"Gas, diesel" },
  { code:"310", label:"310 - Construcción 1.75%", porc:1.75, desc:"Obra civil" },
  { code:"346", label:"346 - Tarjetas/Bancos 0%", porc:0.00, desc:"Datafast automático" },
  { code:"318", label:"318 - Dividendos 15%/25%", porc:15.00, desc:"Distribución utilidades" },
]

const CATALOGO_IVA = [
  { code:"1", label:"1 - 30% Bienes", porc:30 },
  { code:"2", label:"2 - 70% Servicios", porc:70 },
  { code:"3", label:"3 - 100% Total", porc:100 },
  { code:"9", label:"9 - 10% Exportador", porc:10 },
  { code:"10", label:"10 - 20% Grandes Contrib", porc:20 },
  { code:"7", label:"7 - 0% No Retención", porc:0 },
]

export default function ComprasRecibidasV2(){
  const [compras,setCompras]=useState<CompraATS[]>([])
  const router = useRouter()
  const [show,setShow]=useState(false)
  const [showRet,setShowRet]=useState(false)
  const [form,setForm]=useState<Record<string,string>>({})
  const [activa,setActiva]=useState<CompraATS|null>(null)
  const [retForm,setRetForm]=useState<Record<string,any>>({})

  const [filtroBusqueda, setFiltroBusqueda] = useState("")
  const [periodoFiltro, setPeriodoFiltro] = useState("2026-09")
  const [alertaDuplicado, setAlertaDuplicado] = useState("")

  useEffect(()=>{
    try{
      const viejas = JSON.parse(localStorage.getItem("meijsac_compras_ats")||"[]")
      const nuevas = JSON.parse(localStorage.getItem("meijsac_compras_ats_v2")||"[]")
      if(viejas.length>0 && nuevas.length===0){
        const migradas = viejas.map((c:any)=>({
          id:c.id, claveAccesoProveedor:c.claveAcceso||c.claveAccesoProveedor||"", secuencial:c.secuencial,
          rucProveedor:c.ruc||c.rucProveedor, razonSocialProveedor:c.razonSocial||c.razonSocialProveedor,
          fechaEmision:c.fecha||c.fechaEmision, subtotalNoObjeto:0, subtotalIva0:parseFloat(c.base0||0),
          subtotalIva15:parseFloat(c.base12||c.base15||0), subtotalExento:0, valorIva:parseFloat(c.iva||0),
          totalDocumento:parseFloat(c.total||0), sustento:"01", estadoAts:"POR RETENER", tipo:c.tipo||"01 - FACTURA"
        }))
        setCompras(migradas)
      } else {
        setCompras(nuevas.length? nuevas : viejas.map((c:any)=>({...c, estadoAts:c.estadoAts||'POR RETENER'})))
      }
    }catch{}
  },[])

  const save = (list:CompraATS[])=>{
    setCompras(list)
    localStorage.setItem("meijsac_compras_ats_v2", JSON.stringify(list))
    localStorage.setItem("meijsac_compras_ats", JSON.stringify(list))
  }

  const calcularPeriodoFiscal = (fecha:string)=>{
    if(!fecha) return "09/2026"
    const parts = fecha.split(/[\/\-]/)
    if(parts.length>=3) return `${parts[1].padStart(2,"0")}/${parts[2]}`
    return "09/2026"
  }

  const manejarSeleccionCompraParaRetener = (compraSeleccionada:CompraATS)=>{
    const periodo = calcularPeriodoFiscal(compraSeleccionada.fechaEmision)
    const baseRenta = compraSeleccionada.subtotalIva15
    const baseIva = compraSeleccionada.valorIva
    const esIvaCero = baseIva===0
    const esNotaVenta = compraSeleccionada.tipo.includes("02") || compraSeleccionada.tipo.includes("NOTA")

    let rentaDefault, ivaDefault
    if(esNotaVenta){
      rentaDefault = CATALOGO_RENTA.find(x=>x.code==="348")!
      ivaDefault = CATALOGO_IVA.find(x=>x.code==="7")!
    } else {
      rentaDefault = CATALOGO_RENTA.find(x=>x.code==="343")!
      ivaDefault = esIvaCero? CATALOGO_IVA.find(x=>x.code==="7")! : CATALOGO_IVA.find(x=>x.code==="1")!
    }

    setActiva(compraSeleccionada)
    setRetForm({
      proveedorRuc: compraSeleccionada.rucProveedor,
      proveedorNombre: compraSeleccionada.razonSocialProveedor,
      claveAccesoSustento: compraSeleccionada.claveAccesoProveedor,
      secuencialCompra: compraSeleccionada.secuencial,
      fechaEmisionCompra: compraSeleccionada.fechaEmision,
      periodoFiscalCalculado: periodo,
      baseImponibleRentaAuto: baseRenta,
      codigoRenta: rentaDefault.code,
      porcRenta: rentaDefault.porc,
      valorRetRenta: +(baseRenta * rentaDefault.porc / 100).toFixed(2),
      baseImponibleIvaAuto: baseIva,
      codigoIva: ivaDefault.code,
      porcIvaRet: ivaDefault.porc,
      valorRetIva: +(baseIva * ivaDefault.porc / 100).toFixed(2),
      detalleIva: ivaDefault.label,
      esIvaCero: esIvaCero || esNotaVenta,
      esNotaVenta
    })
    setShowRet(true)
  }

  const onChangeRenta = (code:string)=>{
    const cat = CATALOGO_RENTA.find(x=>x.code===code)!
    setRetForm((prev:any)=>({...prev, codigoRenta:code, porcRenta:cat.porc, valorRetRenta: +(prev.baseImponibleRentaAuto * cat.porc / 100).toFixed(2)}))
  }
  const onChangeIva = (code:string)=>{
    const cat = CATALOGO_IVA.find(x=>x.code===code)!
    setRetForm((prev:any)=>({...prev, codigoIva:code, detalleIva:cat.label, porcIvaRet:cat.porc, valorRetIva: +(prev.baseImponibleIvaAuto * cat.porc / 100).toFixed(2)}))
  }

  const generarRetencion07 = ()=>{
    if(!activa) return
    const numRet = `001-001-${String(compras.filter(c=>c.estadoAts==='RETENIDO').length+1).padStart(9,"0")}`
    const fechaISO = new Date().toISOString()
    const rets = JSON.parse(localStorage.getItem("meijsac_retenciones")||"[]")
    const nuevaRet = { id:Date.now()+"",...retForm, numRetencion:numRet, fechaGeneracion:fechaISO, claveAccesoSustento: activa.claveAccesoProveedor, estado:"AUTORIZADO" }
    rets.push(nuevaRet)
    localStorage.setItem("meijsac_retenciones", JSON.stringify(rets))

    const docParaEmitidos = {
      id: nuevaRet.id,
      tipo: "07 - RETENCIÓN",
      secuencial: numRet,
      claveAcceso: "07" + activa.claveAccesoProveedor.slice(2),
      proveedor: activa.razonSocialProveedor,
      razon: activa.razonSocialProveedor,
      ruc: activa.rucProveedor,
      fecha: fechaISO,
      total: retForm.valorRetRenta + retForm.valorRetIva,
      estado: "AUTORIZADO",
      origen: "ATS v2 - COMPRAS",
      xmlFirmado: true,
      valorRetenido: retForm.valorRetRenta + retForm.valorRetIva
    }

    const destinos = [
      "meijsac_facturas", 
      "meijsac_documentos_emitidos", 
      "meijsac_comprobantes_emitidos", 
      "meijsac_enviados_sri", 
      "meijsac_autorizados", 
      "meijsac_sri_documentos",
      "meijsac_comprobantes_sri",
      "meijsac_facturas_emitidas"
    ];

    destinos.forEach(key=>{
      const lista = JSON.parse(localStorage.getItem(key)||"[]")
      if(!lista.some((d:any)=>d.secuencial===numRet)){
        lista.push(docParaEmitidos)
        localStorage.setItem(key, JSON.stringify(lista))
      }
    })

    const lista = compras.map(c=> c.id===activa.id? {...c, estadoAts:'RETENIDO' as const, numRetencion:numRet} : c)
    save(lista)
    setShowRet(false)
    alert(`✅ Retención ${numRet} generada para ${activa.razonSocialProveedor}\n→ Ahora aparece en COMPROBANTES / EMITIDOS y AUTORIZADOS`)
  }

  // --- CORREGIDO LINEA 195 - SIN e:any ---
  const procesarTxtSRI = async (e: React.ChangeEvent<HTMLInputElement>)=>{
    const file = e.target.files?.[0]; 
    if(!file) return
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l:string)=>l.trim().length>5)
    if(lines.length===0) return
    const delim = lines[0].includes("\t")? "\t" : lines[0].includes(";")? ";" : ","
    const start = lines[0].toLowerCase().includes("ruc")?1:0
    const nuevas:CompraATS[]=[]
    for(let i=start;i<lines.length;i++){
      const cols = lines[i].split(delim).map((c:string)=>c.replace(/"/g,"").trim())
      if(cols.length<6) continue
      const ruc = cols.find((c:string)=>/^[0-9]{13}$/.test(c))||cols[0]
      const clave = cols.find((c:string)=>c.length>=49)||""
      const fecha = cols.find((c:string)=>/\d{2}\/\d{2}\/\d{4}/.test(c))||""
      const numeros = cols.map((c:string)=>parseFloat(c.replace(",","."))).filter((n:number)=>!isNaN(n))
      const totalDoc = numeros.length? numeros[numeros.length-1]:0
      const ivaTxt = numeros.length>1? numeros[numeros.length-2]:0
      const baseGravada15 = ivaTxt>0? +(ivaTxt/0.15).toFixed(2):0
      const residuo = +(totalDoc - baseGravada15 - ivaTxt).toFixed(2)
      const serie = cols.find((c:string)=>/^\d{3}-\d{3}$/.test(c))||"001-001"
      const secuencialNum = cols.find((c:string)=>/^\d{9}$/.test(c))||"000000001"
      const razon = cols[1]||"PROVEEDOR SRI"
      nuevas.push({ id:`${Date.now()}-${i}`, claveAccesoProveedor:clave, secuencial:`${serie}-${secuencialNum}`, rucProveedor:ruc, razonSocialProveedor:razon, fechaEmision:fecha, subtotalNoObjeto:0, subtotalIva0:residuo>0?residuo:0, subtotalIva15:baseGravada15, subtotalExento:0, valorIva:ivaTxt, totalDocumento:totalDoc, sustento:"01", estadoAts:'POR RETENER', tipo:"01 - FACTURA" })
    }
    const filtradas = nuevas.filter(n => {
      const existe = compras.some(c => c.claveAccesoProveedor === n.claveAccesoProveedor && n.claveAccesoProveedor.length===49)
      return !existe
    })
    const duplicados = nuevas.length - filtradas.length
    if(duplicados>0){
      setAlertaDuplicado(`⚠️ COMPROBANTE DUPLICADO: ${duplicados} facturas de Arcacontinental/Danec ya existen. Se omitió la carga.`)
      setTimeout(()=> setAlertaDuplicado(""), 5000)
    }
    if(filtradas.length) save([...filtradas,...compras])
  }

  const guardarManual = ()=>{
    if(!form.claveAccesoProveedor || form.claveAccesoProveedor.length<49){ alert("Clave 49 dígitos obligatoria"); return }
    const existe = compras.some(c => c.claveAccesoProveedor === form.claveAccesoProveedor)
    if(existe){
      setAlertaDuplicado(`⚠️ DUPLICADO: La Clave ${form.claveAccesoProveedor.slice(0,15)}... ya está registrada.`)
      setTimeout(()=> setAlertaDuplicado(""), 4000)
      return
    }
    const esNotaVenta = (form.tipo||"").includes("02") || (form.tipo||"").includes("NOTA")
    save([{
      id:Date.now()+"", claveAccesoProveedor:form.claveAccesoProveedor, secuencial:form.secuencial,
      rucProveedor:form.rucProveedor, razonSocialProveedor:form.razonSocialProveedor, fechaEmision:form.fechaEmision,
      subtotalNoObjeto:parseFloat(form.subtotalNoObjeto||"0"), 
      subtotalIva0: esNotaVenta ? parseFloat(form.totalDocumento||"0") : parseFloat(form.subtotalIva0||"0"),
      subtotalIva15: esNotaVenta ? 0 : parseFloat(form.subtotalIva15||"0"), 
      subtotalExento:parseFloat(form.subtotalExento||"0"),
      valorIva: esNotaVenta ? 0 : parseFloat(form.valorIva||"0"), 
      totalDocumento:parseFloat(form.totalDocumento||"0"),
      sustento:form.sustento||"01", estadoAts:'POR RETENER', tipo:form.tipo||"01 - FACTURA"
    } as CompraATS,...compras])
    setShow(false)
  }

  const eliminarCompra = (id:string, estado:string)=>{
    if(estado==='RETENIDO'){
      alert("🔒 CANDADO CONTABLE: No puedes borrar compra RETENIDA. Tiene retención 07 autorizada en el SRI. Requiere clave ADMIN.")
      return
    }
    if(confirm("¿Eliminar compra POR RETENER? Se borrará del localStorage.")){
      save(compras.filter(c=>c.id!==id))
    }
  }

  const comprasFiltradas = useMemo(()=>{
    return compras.filter(c=>{
      const cumpleBusqueda = filtroBusqueda==="" ? true : 
        c.rucProveedor.includes(filtroBusqueda) || c.razonSocialProveedor.toLowerCase().includes(filtroBusqueda.toLowerCase())
      const cumplePeriodo = periodoFiltro==="" ? true : c.fechaEmision.includes(periodoFiltro.split("-")[1]) || c.fechaEmision.includes(periodoFiltro)
      return cumpleBusqueda && cumplePeriodo
    })
  }, [compras, filtroBusqueda, periodoFiltro])

  return (
    <div className="min-h-screen bg-[#080a0f] text-white p-4">
      <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={()=>router.push("/dashboard/comprobantes")} className="bg-[#1a1f2e] hover:bg-white hover:text-black border border-white/10 px-4 py-2 rounded-full font-black text-[11px] transition">← DASHBOARD</button>
          <h1 className="font-black">COMPRAS RECIBIDAS - ATS v2</h1>
        </div>
        <div className="flex items-center gap-2">
          <input value={filtroBusqueda} onChange={e=> setFiltroBusqueda(e.target.value)} placeholder="🔍 RUC o Danec / Coca-Cola" className="bg-black border border-white/10 rounded-xl px-3 py-2 text-[11px] w-[200px]" />
          <select value={periodoFiltro} onChange={e=> setPeriodoFiltro(e.target.value)} className="bg-black border border-white/10 rounded-xl px-3 py-2 text-[11px]">
            <option value="">Todo periodo</option>
            <option value="2026-09">Septiembre 2026</option>
            <option value="2026-10">Octubre 2026</option>
            <option value="09/2026">09/2026</option>
          </select>
          <label className="bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-2 rounded-full text-[10px] font-bold cursor-pointer">
            📥 TXT SRI
            <input type="file" accept=".txt,.csv" onChange={procesarTxtSRI} className="hidden" />
          </label>
          <button onClick={()=> setShow(true)} className="bg-[#00ffc6] text-black px-4 py-2 rounded-full font-black text-[11px]">+ MANUAL</button>
        </div>
      </div>

      {alertaDuplicado && (
        <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-300 p-3 rounded-xl text-[11px] mb-3 animate-pulse">
          {alertaDuplicado}
        </div>
      )}

      <div className="space-y-2">
        {comprasFiltradas.map(c=>(
          <div key={c.id} className={`bg-[#1a1f2e] p-3 rounded-xl flex justify-between text-[11px] border-l-4 ${c.estadoAts==='POR RETENER'?'border-orange-500':'border-emerald-500'}`}>
            <div className="flex-1">
              <b>{c.razonSocialProveedor}</b> - {c.rucProveedor} | {c.secuencial}<br/>
              <span className="opacity-60 text-[10px]">Clave:{c.claveAccesoProveedor?.slice(0,30)}... | Base15:${c.subtotalIva15} | IVA:${c.valorIva} | Total:{c.totalDocumento} | {c.fechaEmision} | {c.tipo}</span>
            </div>
            <div className="flex items-center gap-2">
              {c.estadoAts==='POR RETENER'? (
                <button onClick={()=>manejarSeleccionCompraParaRetener(c)} className="bg-orange-500 hover:bg-orange-400 px-4 py-2 rounded-full font-black text-[10px] animate-pulse">POR RETENER</button>
              ):(
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-black text-[9px]">✓ RETENIDO {c.numRetencion}</span>
              )}
              <button onClick={()=> eliminarCompra(c.id, c.estadoAts)} className={`p-2 rounded-full border ${c.estadoAts==='RETENIDO' ? 'border-white/5 text-white/20 cursor-not-allowed' : 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white'}`}>🗑️</button>
            </div>
          </div>
        ))}
        {comprasFiltradas.length===0 && <div className="text-center opacity-30 text-xs py-10">Sin compras en este filtro - prueba con otro RUC</div>}
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#121725] w-full max-w-[700px] rounded-[20px] p-6 border border-white/10 max-h-[90vh] overflow-y-auto">
            <h2 className="font-black text-[13px] mb-1">NUEVO COMPROBANTE RECIBIDO - SUSTENTO ATS</h2>
            <p className="text-[10px] opacity-50 mb-4">Formulario corregido ATS - Incluye Nota de Venta RIMPE Popular</p>
            <label className="text-[10px] text-[#00ffc6]">CLAVE DE ACCESO 49 DÍGITOS *OBLIGATORIA SRI*</label>
            <input value={form.claveAccesoProveedor||""} onChange={e=>setForm({...form, claveAccesoProveedor:e.target.value})} placeholder="Ej: 12102026..." className="bg-black w-full p-3 rounded-xl text-[12px] mb-3 border border-[#00ffc6]/30" />
            <div className="grid grid-cols-2 gap-3">
              <input value={form.rucProveedor||""} onChange={e=>setForm({...form, rucProveedor:e.target.value})} placeholder="RUC Proveedor 13 dígitos" className="bg-black p-3 rounded-xl text-[12px]" />
              <input value={form.razonSocialProveedor||""} onChange={e=>setForm({...form, razonSocialProveedor:e.target.value})} placeholder="RAZON SOCIAL" className="bg-black p-3 rounded-xl text-[12px]" />
            </div>
            <input value={form.secuencial||""} onChange={e=>setForm({...form, secuencial:e.target.value})} placeholder="Secuencial 001-005-000012345" className="bg-black w-full p-3 rounded-xl text-[12px] mt-3" />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <select value={form.tipo||"01 - FACTURA"} onChange={e=>setForm({...form, tipo:e.target.value})} className="bg-black p-3 rounded-xl text-[12px]">
                <option>01 - FACTURA</option>
                <option>02 - NOTA DE VENTA RIMPE POPULAR</option>
                <option>04 - NOTA DE CREDITO</option>
                <option>07 - RETENCION</option>
              </select>
              <select value={form.sustento||"01"} onChange={e=>setForm({...form, sustento:e.target.value})} className="bg-black p-3 rounded-xl text-[12px]">
                <option value="01">01 - Crédito Tributario IVA - Materia Prima</option>
                <option value="02">02 - Costo / Gasto</option>
                <option value="03">03 - Activo Fijo - Congelador / Cocina / Mobiliario</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div><label className="text-[9px]">BASE NO OBJETO IVA</label><input type="number" value={form.subtotalNoObjeto||""} onChange={e=>setForm({...form, subtotalNoObjeto:e.target.value})} className="bg-black w-full p-2 rounded-xl text-[12px]" /></div>
              <div><label className="text-[9px]">BASE 0%</label><input type="number" value={form.subtotalIva0||""} onChange={e=>setForm({...form, subtotalIva0:e.target.value})} className="bg-black w-full p-2 rounded-xl text-[12px]" /></div>
              <div><label className={`text-[9px] ${form.tipo?.includes("02") ? "text-red-400" : ""}`}>BASE GRAVADA 15% {form.tipo?.includes("02") && "(BLOQUEADO RIMPE)"}</label><input type="number" disabled={form.tipo?.includes("02")} value={form.subtotalIva15||""} onChange={e=>setForm({...form, subtotalIva15:e.target.value})} className={`bg-black w-full p-2 rounded-xl text-[12px] ${form.tipo?.includes("02") ? "opacity-20" : ""}`} /></div>
              <div><label className="text-[9px]">BASE EXENTA</label><input type="number" value={form.subtotalExento||""} onChange={e=>setForm({...form, subtotalExento:e.target.value})} className="bg-black w-full p-2 rounded-xl text-[12px]" /></div>
              <div><label className={`text-[9px] ${form.tipo?.includes("02") ? "text-red-400" : ""}`}>MONTO IVA {form.tipo?.includes("02") && "→ $0.00"}</label><input type="number" disabled={form.tipo?.includes("02")} value={form.valorIva||""} onChange={e=>setForm({...form, valorIva:e.target.value})} className={`bg-black w-full p-2 rounded-xl text-[12px] ${form.tipo?.includes("02") ? "opacity-20" : ""}`} /></div>
              <div><label className="text-[9px]">TOTAL DOCUMENTO</label><input type="number" value={form.totalDocumento||""} onChange={e=>setForm({...form, totalDocumento:e.target.value})} className="bg-black w-full p-2 rounded-xl text-[12px] border border-[#00ffc6]/30" /></div>
            </div>
            {form.tipo?.includes("02") && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 p-2 rounded-xl mt-3 text-[10px] text-yellow-300">📌 Nota de Venta RIMPE Popular: Todo va a Base 0% - IVA $0 - Auto Retención 348 0% Informativa SRI</div>
            )}
            <div className="flex gap-3 mt-6"><button onClick={()=>setShow(false)} className="flex-1 bg-[#2a2f3e] p-3 rounded-full font-bold text-[12px]">CANCELAR</button><button onClick={guardarManual} className="flex-1 bg-[#00ffc6] text-black p-3 rounded-full font-black text-[12px]">REGISTRAR COMPRA ATS</button></div>
          </div>
        </div>
      )}

      {showRet && activa && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#121725] w-full max-w-[760px] rounded-[20px] p-6 border border-white/10 max-h-[90vh] overflow-y-auto">
            <h2 className="font-black text-[13px] mb-1">REGISTRO DE RETENCIÓN 07 - AUTO - CATALOGO MAESTRO</h2>
            <p className="text-[10px] opacity-50 mb-3">Sustento: {retForm.claveAccesoSustento}</p>
            <div className="bg-black/50 p-3 rounded-xl text-[11px] mb-3">
              <div><b>Proveedor:</b> {retForm.proveedorNombre} - {retForm.proveedorRuc}</div>
              <div><b>Factura Sustento:</b> {retForm.secuencialCompra} | {retForm.fechaEmisionCompra} {retForm.esNotaVenta && <span className="bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded ml-2">RIMPE POPULAR</span>}</div>
              <div className="flex gap-2 mt-1">
                <span className="bg-[#1a1f2e] px-2 py-1 rounded">Periodo Fiscal: <b>{retForm.periodoFiscalCalculado}</b></span>
                <span className="bg-[#00ffc6]/20 text-[#00ffc6] px-2 py-1 rounded">Clave 49 dig validada ✓</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-black p-3 rounded-xl">
                <label className="text-[9px] opacity-60">FILA RENTA - Código SRI 1 - CATALOGO COMPLETO</label>
                <div className="text-[11px] mt-1">Base: <b>${retForm.baseImponibleRentaAuto}</b></div>
                <select value={retForm.codigoRenta} onChange={e=>onChangeRenta(e.target.value)} className="bg-[#1a1f2e] w-full p-2 rounded mt-2 text-[11px]">
                  {CATALOGO_RENTA.map(cat=>(
                    <option key={cat.code} value={cat.code}>{cat.label} - {cat.desc}</option>
                  ))}
                </select>
                <div className="mt-2 font-black text-[#00ffc6]">Ret. Renta: ${retForm.valorRetRenta} ({retForm.porcRenta}%)</div>
              </div>
              <div className="bg-black p-3 rounded-xl">
                <label className="text-[9px] opacity-60">FILA IVA - Código SRI 2 - OFICIAL SRI</label>
                <div className="text-[11px] mt-1">Base: <b>${retForm.baseImponibleIvaAuto}</b> {retForm.esIvaCero && "- Auto Código 7 0%"}</div>
                <select value={retForm.codigoIva} onChange={e=>onChangeIva(e.target.value)} className="bg-[#1a1f2e] w-full p-2 rounded mt-2 text-[11px]">
                  {CATALOGO_IVA.map(cat=>(
                    <option key={cat.code} value={cat.code}>{cat.label}</option>
                  ))}
                </select>
                <div className="mt-2 font-black text-[#00ffc6]">Ret. IVA: ${retForm.valorRetIva} ({retForm.porcIvaRet}%)</div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={()=>setShowRet(false)} className="flex-1 bg-[#2a2f3e] p-3 rounded-full font-bold text-[12px]">CANCELAR</button>
              <button onClick={generarRetencion07} className="flex-1 bg-[#00ffc6] text-black p-3 rounded-full font-black text-[12px]">GENERAR RETENCIÓN 07</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}