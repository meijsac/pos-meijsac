"use client";
import { useState, useEffect } from "react";
import { feriadosIvaReducido } from '@/lib/iva-feriados.config';
import { cargarEmpresaSesion } from "@/lib/sesion-cliente";
import { errorLogo } from "@/lib/logo-empresa";
import DocumentosLegales from "./documentos-legales";

const SRI_URLS = {
    "1": { nombre: "PRUEBAS", url: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl", auth: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl" },
    "2": { nombre: "PRODUCCION", url: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl", auth: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl" }
    
};
// === ENGRANAJE FUTURISTA - NO BORRA NADA DE TU LOGICA ===
function GearFuturista({ size = 48, active = false, onClick }: { size?: number, active?: boolean, onClick?: () => void }) {
  return (
    <button onClick={onClick} type="button" className={`grid place-items-center rounded-full bg-transparent border-0 cursor-pointer transition-all duration-700 ${active ? 'bg-[rgba(84,228,237,0.09)] shadow-[0_0_0_1px_rgba(84,228,237,0.4),0_0_34px_rgba(84,228,237,0.16)]' : 'hover:bg-[rgba(84,228,237,0.045)]'}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className={`w-[80%] h-[80%] transition-all duration-[1150ms] ${active ? 'rotate-45' : 'hover:rotate-[42deg]'}`} style={{ filter: active ? 'drop-shadow(0 0 18px rgba(84,228,237,0.75)) brightness(1.23)' : 'drop-shadow(0 0 8px rgba(84,228,237,0.25))' }}>
        <defs>
          <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a5f6f1"/><stop offset=".48" stopColor="#57dce6"/><stop offset="1" stopColor="#278ca7"/></linearGradient>
          <radialGradient id="core"><stop stopColor="#efffff"/><stop offset=".4" stopColor="#a1fff3"/><stop offset="1" stopColor="#30b9ce"/></radialGradient>
        </defs>
        <path d="M88 16H112L116 31 129 36 142 28 159 45 151 58 156 71 171 75 171 99 156 103 151 116 159 129 142 146 129 138 116 143 112 158 88 158 84 143 71 138 58 146 41 129 49 116 44 103 29 99 29 75 44 71 49 58 41 45 58 28 71 36 84 31Z" transform="translate(0 13)" fill="#112d35" stroke="url(#metal)" strokeWidth="5" strokeLinejoin="round"/>
        <circle cx="100" cy="100" r="47" fill="#153842" stroke="url(#metal)" strokeWidth="3"/>
        <circle cx="100" cy="100" r="22" fill="#0d2831" stroke="#79e9eb" strokeWidth="2.5"/>
        <circle cx="100" cy="100" r="14" fill="url(#core)"/>
      </svg>
    </button>
  )
}
// MOTOR UNIVERSAL - SIRVE PARA CHIFA, RESTAURANTE, BAR, HOTEL, CUALQUIER NEGOCIO
export const calcularTotalesUniversal = (itemsCarrito: any[]) => {
  if (typeof window === 'undefined') {
    return { subtotal15: 0, subtotal0: 0, subtotalTuristico: 0, ivaCalculado: 0, total: 0, codigoSri: '2', esFeriado: false, label: 'IVA 15%' }
  }
  const hoy = new Date().toISOString().split('T')[0]
  const config = JSON.parse(localStorage.getItem('negocio_config') || '{"sectorTuristico":true}')
  const sectorTuristico = config.sectorTuristico
  const feriadoActivo = sectorTuristico ? feriadosIvaReducido.find((f:any) => hoy >= f.inicio && hoy <= f.fin) : null

  let subtotal15 = 0, subtotal0 = 0, subtotalTuristico = 0
  const esExento = localStorage.getItem('meijsac_regimen') === 'EXENTO_ESPECIAL'

  itemsCarrito.forEach((item: any) => {
    const base = (item.cantidad * item.precio) - (item.descuento || 0)
    if (esExento) {
      subtotal0 += base
    } else if (item.tarifaIva === "15%" || item.tarifaIva === "2" || item.iva > 0) {
      if (feriadoActivo) {
        subtotalTuristico += base
      } else {
        subtotal15 += base
      }
    } else {
      subtotal0 += base
    }
  })

  const tasa = feriadoActivo ? feriadoActivo.tasaIva : 0.15
  const iva = esExento ? 0 : (subtotal15 * 0.15) + (subtotalTuristico * tasa)

  return {
    subtotal15,
    subtotal0,
    subtotalTuristico,
    ivaCalculado: iva,
    total: subtotal15 + subtotal0 + subtotalTuristico + iva,
    codigoSri: esExento ? '0' : (feriadoActivo ? '4' : '2'),
    esFeriado: !!feriadoActivo,
    label: feriadoActivo ? `IVA ${tasa*100}% ${feriadoActivo.nombre}` : 'IVA 15%'
  }
}

export default function ConfiguracionAvanzadaSRI() {
    const [tab, setTab] = useState("IDENTIDAD");
    useEffect(() => {
        const pedido = new URLSearchParams(window.location.search).get("tab");
        if (pedido === "DOCUMENTOS") setTab("DOCUMENTOS");
    }, []);
    const [cfg, setCfg] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [infoFirma, setInfoFirma] = useState<any>(null);
    const [guardando, setGuardando] = useState(false);
    const [avisoLogo, setAvisoLogo] = useState("");
    const firmaSubida = !!(cfg?.firma?.nombre || cfg?.firma?.expira || infoFirma?.ok);

    const handleFirmaChange = async (e:any) => {
  const file = e.target.files[0];
  if(!file) return;

  // 1. Si no hay clave, no intentar
  if(!cfg?.firma?.clave){
    alert("⚠️ Primero escribe la clave de la firma .p12");
    e.target.value = ""; // Limpia el input para que no quede pegado
    return;
  }

  const form = new FormData();
  form.append('p12', file);
  form.append('clave', cfg?.firma?.clave || "");
  form.append('rucEmpresa', cfg?.ruc || "");
  const res = await fetch('/api/sri/validar-firma', {method:'POST', body: form});
  const data = await res.json();
  setInfoFirma(data);

  if(data.ok){
    // CLAVE CORRECTA: SÍ se guarda
    setCfg((prev:any)=>({...prev, firma:{...prev.firma, nombre: file.name, expira: data.fechaExpiracion, diasRestantes: data.diasRestantes, rucDetectado: data.rucEnFirma}}));
  } else {
    // CLAVE INCORRECTA: NO SE GUARDA NADA
    alert("❌ Clave incorrecta. La firma NO se guardó.");
    setInfoFirma(data);
    // Borra el nombre para que en el Dashboard principal siga igual, como si no hubieras subido nada
    setCfg((prev:any)=>({...prev, firma:{...prev.firma, nombre: "", expira: "", diasRestantes: null, rucDetectado: ""}}));
    e.target.value = ""; // Limpia el input
    localStorage.removeItem("meijsac_config_pro"); // No deja basura guardada
  }
};

    const elegirLogo = (file?: File) => {
      if (!file) return
      const aviso = errorLogo(file.name, file.type, file.size)
      if (aviso) {
        setAvisoLogo(aviso)
        setCfg((p: any) => ({ ...p, logoFile: null, logoNombre: "" }))
        return
      }
      const url = URL.createObjectURL(file)
      setAvisoLogo("")
      setCfg((p: any) => ({ ...p, logoPreview: url, logoFile: file, logoNombre: file.name }))
    }

    const handleGuardar = async () => {
      if (avisoLogo) return
      try {
        setGuardando(true);
        const payload = { ...cfg };
        let logoGuardado = false
        if (payload.logoFile instanceof File) {
          const fd = new FormData()
          fd.append("file", payload.logoFile)
          const subida = await fetch("/api/empresa/logo", {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("meijsac_token") || ""}` },
            body: fd,
          })
          const data = await subida.json().catch(() => ({}))
          if (!subida.ok || !data.logo_url) {
            const texto = data.error || "No se pudo guardar el logo: error de base. Intenta de nuevo."
            setAvisoLogo(texto)
            return
          }
          payload.logo_url = data.logo_url
          payload.logoUrl = data.logo_url
          payload.marca_ride = data.logo_url
          payload.logoPreview = data.logo_url
          logoGuardado = true
          setAvisoLogo("Logotipo guardado correctamente")
        }
        delete payload.logoFile;
        delete payload.firmaFile;

        const res = await fetch("/api/configuracion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`Error ${res.status}`);
        try { localStorage.setItem("meijsac_config_pro", JSON.stringify({ ...payload, logoPreview: undefined })) } catch {}
        const empresa = await cargarEmpresaSesion()
        const logo = empresa.logo_url || empresa.logoUrl || empresa.marca_ride || payload.logo_url || ""
        setCfg((p: any) => ({ ...p, ...payload, logoFile: null, logo_url: logo, logoUrl: logo, marca_ride: logo, logoPreview: logo || p?.logoPreview || "" }))
        setAvisoLogo(logoGuardado ? "Logotipo guardado correctamente" : "")
        if (!logoGuardado) alert("Configuración guardada")
      } catch (e:any) {
        if (String(e?.message || "").includes("logo")) setAvisoLogo(e.message)
        else alert("❌ " + e.message);
      } finally {
        setGuardando(false);
      }
    };

    useEffect(() => {
      let vivo = true
      ;(async () => {
        const reg = JSON.parse(localStorage.getItem("meijsac_registro") || "{}");
        const emp = JSON.parse(localStorage.getItem("meijsac_empresa") || "{}");
        const clientes = JSON.parse(localStorage.getItem("meijsac_clientes") || "[]");
        const clienteActual = emp?.ruc ? (clientes.find((c:any)=> c.ruc === emp.ruc) || {}) : {};
        let datosReales: any = { ...reg, ...emp, ...clienteActual };
        try {
          const empresa = await cargarEmpresaSesion()
          const conValor = Object.fromEntries(Object.entries(empresa).filter(([, v]) => v !== "" && v != null))
          datosReales = { ...datosReales, ...conValor }
        } catch (e: any) {
          if (!datosReales.ruc) alert(e?.message || "No se pudo cargar la empresa")
        }
        if (!vivo) return
if(datosReales.razon && !datosReales.razonSocial) datosReales.razonSocial = datosReales.razon;
if(datosReales.direccion && !datosReales.dirMatriz) datosReales.dirMatriz = datosReales.direccion;
        const saved = JSON.parse(localStorage.getItem("meijsac_config_pro") || "null");
        const base = saved || {
    ruc: datosReales.ruc || "",
    razonSocial: datosReales.razonSocial || datosReales.razon || "",
    nombreComercial: datosReales.nombreComercial || "",
    dirMatriz: datosReales.dirMatriz || datosReales.direccion || "",
    dirEstablecimiento: datosReales.dirEstablecimiento || datosReales.dirMatriz || "",
    // === NUEVO: PROVINCIA Y CIUDAD - ANTES NO EXISTÍAN ===
    provincia: datosReales.provincia || "",
    ciudad: datosReales.ciudad || "",
    regimen: datosReales.regimen || "",
    contribuyenteEspecial: datosReales.contribuyenteEspecial || "",
    resolucionAgente: datosReales.resolucionAgente || datosReales.resolucionAgenteRetencion || "",
    obligadoConta: datosReales.obligadoConta || datosReales.obligadoContabilidad || "",
    agenteRetencion: datosReales.agenteRetencion || "NO",
    ambiente: datosReales.ambiente || "1",
    telefono: datosReales.telefono || "",
    email: datosReales.email || "",
    actividad: datosReales.actividad || datosReales.actividadEconomica || "",
    // === SUCURSALES: YA NO FIJAS, VIENEN DEL CLIENTE O VACÍAS ===
    sucursales: datosReales.sucursales || [],
    firma: { nombre: "", clave: "", expira: "", diasRestantes: null, ambiente: "1", ws: "celcer.sri.gob.ec" },
    secuenciales: [
      { estab: "001", pto: "001", codigo:"01", tipo: "01 FACTURA", ultimo: "00000125", alerta: 50, estado: "ACTIVO" },
      { estab: "001", pto: "002", codigo:"01", tipo: "01 FACTURA", ultimo: "00000010", alerta: 50, estado: "ACTIVO" },
      { estab: "002", pto: "001", codigo:"04", tipo: "04 NOTA CREDITO", ultimo: "00000005", alerta: 50, estado: "ACTIVO" }
    ],
    modoOffline:false,
    colaOffline:[],
    ultimoEnvioOffline:"",
    impuestos: { ivaActual: 15, historial: [{ fecha: "01/04/2024", iva: 15, motivo: "Reforma LORTI - IVA 15%" }, { fecha: "01/01/2023", iva: 12, motivo: "IVA 12%" }], },
    cuentas: { caja: "1.01.01.01", ventas0: "4.01.01.01", ventas15: "4.01.01.02", ivaVentas: "2.01.04.01", retencion: "2.01.05.01" },
    moneda: { principal: "USD", secundaria: false, tipoCambio: 1 },
    marca: {logo:"", colorPrimario:"#00f5d4", colorSecundario:"#ffbe0a", plantillaEmail:"Hola {cliente}", facebook:"", instagram:"", mensaje:"Gracias por su compra, visítenos en..."},
    roles: [
        { usuario: "admin", nombre: "Alexandra", rol: "ADMIN", permisos: { verCostos: true, editarRUC: false, anular: true, verReportes: true, cambiarAmbiente: true } },
        { usuario: "caja1", nombre: "Cajero 1", rol: "CAJERO", permisos: { verCostos: false, editarRUC: false, anular: false, verReportes: false, cambiarAmbiente: false } }
    ],
};
       // === PUNTO 1 VA AQUÍ - JUSTO DESPUÉS DEL }; DE LA LÍNEA 163 ===
// NORMALIZAR RÉGIMEN Y OBLIGADO - UNA SOLA CLAVE PARA TODO
let regimenNorm = (datosReales.regimen || base.regimen || "").toUpperCase().trim();
if (regimenNorm.includes("RIMPE") && regimenNorm.includes("POPULAR")) regimenNorm = "RIMPE NEGOCIO POPULAR";
else if (regimenNorm.includes("RIMPE")) regimenNorm = "RIMPE EMPRENDEDOR";
else if (regimenNorm.includes("GENERAL")) regimenNorm = "REGIMEN GENERAL";
else if (regimenNorm === "") regimenNorm = "";

let obligadoNorm = (datosReales.obligadoConta || datosReales.obligadoContabilidad || base.obligadoConta || "").toUpperCase().trim();
if (obligadoNorm.startsWith("S")) obligadoNorm = "SI";
else if (obligadoNorm.startsWith("N")) obligadoNorm = "NO";
else obligadoNorm = "";

base.regimen = regimenNorm;
base.obligadoConta = obligadoNorm;
base.obligadoContabilidad = obligadoNorm;

base.ruc = datosReales.ruc || base.ruc;
// NO BLOQUEAR NADA - CARGAR LO QUE EL CLIENTE ESCRIBIÓ EN EL REGISTRO
base.ruc = datosReales.ruc || base.ruc || "";
base.razonSocial = datosReales.razonSocial || datosReales.razon || base.razonSocial || "";
base.nombreComercial = datosReales.nombreComercial || base.nombreComercial || "";
base.telefono = datosReales.telefono || base.telefono || "";
base.email = datosReales.email || base.email || "";
base.actividad = datosReales.actividad || datosReales.actividadEconomica || base.actividad || "";
base.dirMatriz = datosReales.dirMatriz || base.dirMatriz || "";
base.provincia = datosReales.provincia || base.provincia || "";
base.ciudad = datosReales.ciudad || base.ciudad || "";
base.sucursales = datosReales.sucursales || base.sucursales || [];
        const logoGuardado = datosReales.logo_url || datosReales.logoUrl || datosReales.marca_ride || "";
        if (logoGuardado) {
          base.logo_url = logoGuardado;
          base.logoUrl = logoGuardado;
          base.marca_ride = logoGuardado;
          base.logoPreview = logoGuardado;
        }
        setCfg(base);
        setLogs(JSON.parse(localStorage.getItem("meijsac_logs") || "[]"));
      })()
      return () => { vivo = false }
    }, []);

    useEffect(()=>{
      if(!cfg) return;
      if(!cfg.modoOffline) return;

      const sincronizarCola = async () => {
        if(!navigator.onLine) return;
        if(!cfg.colaOffline || cfg.colaOffline.length === 0) return;

        console.log(`[OFFLINE SYNC] Intentando enviar ${cfg.colaOffline.length} comprobantes...`);
        
        let colaRestante = [...cfg.colaOffline];
        let enviados = 0;

        for(let i=0; i<colaRestante.length; i++){
          const comp = colaRestante[i];
          try{
            const res = await fetch("/api/sri/envio-offline", {
              method: "POST",
              body: JSON.stringify({ xmlFirmado: comp.xml, claveAcceso: comp.clave })
            });
            if(res.ok){
              colaRestante.splice(i,1); i--;
              enviados++;
            }
          }catch(e){
            console.log("Sin internet, reintento en 5min");
            break;
          }
        }

        if(enviados > 0){
          const nuevaCfg = { ...cfg, colaOffline: colaRestante, ultimoEnvioOffline: new Date().toLocaleString() };
          setCfg(nuevaCfg);
          localStorage.setItem("meijsac_config_pro", JSON.stringify(nuevaCfg));
          alert(`SRI SYNC: ${enviados} facturas enviadas automáticamente`);
        }
      };

      window.addEventListener("online", sincronizarCola);
      const intervalo = setInterval(sincronizarCola, 5 * 60 * 1000);
      sincronizarCola();

      return () => {
        window.removeEventListener("online", sincronizarCola);
        clearInterval(intervalo);
      };
    }, [cfg?.modoOffline, cfg?.colaOffline?.length]);

    if (!cfg) return null;
    const wsActual = SRI_URLS[(cfg.firma?.ambiente || cfg.ambiente || "1") as "1" | "2"];

    const guardar = (accion: string) => {
        localStorage.setItem("meijsac_config_pro", JSON.stringify(cfg));
        const nuevoLog = { accion, usuario: cfg.roles[0].usuario, ip: "192.168.1.10", fecha: new Date().toLocaleString() };
        const all = [nuevoLog, ...logs].slice(0, 50);
        localStorage.setItem("meijsac_logs", JSON.stringify(all));
        setLogs(all);
        alert(`✓ ${accion} - Ambiente: ${wsActual.nombre} - ${wsActual.url}`);
    };

    return (
        <div className="min-h-screen bg-[#060608] text-white p-4">
            <div className="flex justify-between items-center mb-4 bg-[#0c1e24] border border-[#294650] rounded-[20px] px-5 py-3">
    <div className="flex items-center gap-4">
      <GearFuturista size={52} active={tab === "AMBIENTE SRI"} onClick={() => setTab("AMBIENTE SRI")} />
      <h1 className="text-white font-black text-[14px] tracking-widest">
        MEIJSAC POS - CENTRO DE CONTROL MODULAR SRI - <span className={`${cfg?.ambiente==='PRODUCCIÓN'? 'text-[#00ff5d]' : 'text-[#00f5d4]'}`}>{cfg?.ambiente || 'PRUEBAS'}</span>
      </h1>
    </div>
    <button onClick={() => location.href = '/dashboard'} className="bg-white/10 px-4 py-2 rounded-xl text-xs">← Dashboard</button>
</div>


            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {["IDENTIDAD", "FIRMA", "SECUENCIALES", "IMPUESTOS", "MARCA RIDE", "DOCUMENTOS", "PERMISOS", "AMBIENTE SRI"].map(t => (
                    <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap ${tab === t ? 'bg-[#00f5d4] text-black' : 'bg-[#11131a] border border-white/10'}`}>{t}</button>
                ))}
            </div>

            <div className="bg-[#11131a] rounded-[20px] p-6 border border-white/5">
                {tab === "IDENTIDAD" && (
                    <div className="space-y-4">
                      {/* === SUCURSALES COMPLETAS SRI - SIN PROMPT === */}
<div className="md:col-span-3 border-t border-white/10 pt-4">
  <div className="flex justify-between items-center mb-3">
    <p className="text-[#00f5d4] font-bold text-[11px]">SUCURSALES / ESTABLECIMIENTOS DEL CLIENTE - SEGÚN RUC SRI</p>
    <button onClick={() => {
      const sig = `00${(cfg.sucursales?.length || 0) + 1}`.slice(-3);
      const nueva = {
        id: sig, // Código establecimiento 3 dígitos SRI: 001 matriz, 002, 003...
        nombre: "", // Nombre comercial sucursal
        nombreComercial: "",
        dir: "", // Dirección exacta SRI: calle, número, intersección
        provincia: cfg.provincia || "",
        ciudad: cfg.ciudad || "",
        email: "", // Email sucursal para notificaciones
        telefono: "",
        ptoEmision: "001", // Código punto emisión 3 dígitos: caja / terminal
        secuencialInicio: "000000001", // 9 dígitos, primer comprobante
        ambiente: cfg.ambiente || "1", // 1 PRUEBAS / 2 PRODUCCIÓN
        obligadoConta: cfg.obligadoConta || "",
        regimen: cfg.regimen || "",
      };
      setCfg({ ...cfg, sucursales: [...(cfg.sucursales || []), nueva] });
    }} className="bg-[#00f5d4] text-black px-3 py-1 rounded-full text-[10px] font-bold">+ AGREGAR SUCURSAL</button>
  </div>

  {(cfg.sucursales || []).length === 0 && <p className="text-[10px] text-white/40">Sin sucursales. Solo matriz 001.</p>}

  {(cfg.sucursales || []).map((s:any, i:number) => (
    <div key={i} className="bg-black p-4 rounded-xl border border-white/10 mt-3 space-y-2">
      <div className="flex justify-between">
        <p className="text-[10px] font-bold text-teal-300">ESTABLECIMIENTO {s.id} - {s.nombre || "NUEVA SUCURSAL"}</p>
        <button onClick={()=> setCfg({...cfg, sucursales: cfg.sucursales.filter((_:any, idx:number)=> idx!==i)})} className="bg-red-500/20 text-red-400 rounded-xl text-xs px-3">Eliminar</button>
      </div>
      <div className="grid md:grid-cols-3 gap-2">
        <div><label className="text-[8px] text-white/40">Código Establecimiento SRI * 3 dígitos</label><input value={s.id} maxLength={3} onChange={e=>{const a=[...cfg.sucursales]; a[i].id=e.target.value.replace(/[^0-9]/g,""); setCfg({...cfg, sucursales:a})}} className="w-full bg-[#11131a] p-2 rounded-xl text-sm border border-white/10" placeholder="001" /></div>
        <div><label className="text-[8px] text-white/40">Nombre Comercial Sucursal *</label><input value={s.nombre} onChange={e=>{const a=[...cfg.sucursales]; a[i].nombre=e.target.value.toUpperCase(); setCfg({...cfg, sucursales:a})}} className="w-full bg-[#11131a] p-2 rounded-xl text-sm border border-white/10 uppercase" placeholder="EJ: MEICSACONT LORETO" /></div>
        <div><label className="text-[8px] text-white/40">Email Sucursal *</label><input value={s.email || ""} onChange={e=>{const a=[...cfg.sucursales]; a[i].email=e.target.value; setCfg({...cfg, sucursales:a})}} className="w-full bg-[#11131a] p-2 rounded-xl text-sm border border-white/10" placeholder="sucursal@gmail.com" /></div>
        <div className="md:col-span-2"><label className="text-[8px] text-white/40">Dirección Exacta SRI * Calle, número, intersección</label><input value={s.dir} onChange={e=>{const a=[...cfg.sucursales]; a[i].dir=e.target.value; setCfg({...cfg, sucursales:a})}} className="w-full bg-[#11131a] p-2 rounded-xl text-sm border border-white/10" placeholder="N57B Y AV DE LA PRENSA" /></div>
        <div><label className="text-[8px] text-white/40">Teléfono Sucursal</label><input value={s.telefono || ""} onChange={e=>{const a=[...cfg.sucursales]; a[i].telefono=e.target.value; setCfg({...cfg, sucursales:a})}} className="w-full bg-[#11131a] p-2 rounded-xl text-sm border border-white/10" /></div>
        <div><label className="text-[8px] text-white/40">Provincia</label><select value={s.provincia || ""} onChange={e=>{const a=[...cfg.sucursales]; a[i].provincia=e.target.value; setCfg({...cfg, sucursales:a})}} className="w-full bg-[#11131a] p-2 rounded-xl text-sm border border-white/10"><option value="">Seleccione</option>{["Azuay","Bolívar","Cañar","Carchi","Chimborazo","Cotopaxi","El Oro","Esmeraldas","Galápagos","Guayas","Imbabura","Loja","Los Ríos","Manabí","Morona Santiago","Napo","Orellana","Pastaza","Pichincha","Santa Elena","Santo Domingo","Sucumbíos","Tungurahua","Zamora Chinchipe"].map(p => <option key={p} value={p}>{p}</option>)}</select></div>
        <div><label className="text-[8px] text-white/40">Ciudad</label><input value={s.ciudad || ""} onChange={e=>{const a=[...cfg.sucursales]; a[i].ciudad=e.target.value.toUpperCase(); setCfg({...cfg, sucursales:a})}} className="w-full bg-[#11131a] p-2 rounded-xl text-sm border border-white/10 uppercase" placeholder="QUITO" /></div>
        <div><label className="text-[8px] text-white/40">Punto Emisión * 3 dígitos (Caja)</label><input value={s.ptoEmision || "001"} maxLength={3} onChange={e=>{const a=[...cfg.sucursales]; a[i].ptoEmision=e.target.value.replace(/[^0-9]/g,""); setCfg({...cfg, sucursales:a})}} className="w-full bg-[#11131a] p-2 rounded-xl text-sm border border-white/10" placeholder="001" /></div>
        <div><label className="text-[8px] text-white/40">Secuencial Inicial 9 dígitos</label><input value={s.secuencialInicio || "000000001"} onChange={e=>{const a=[...cfg.sucursales]; a[i].secuencialInicio=e.target.value.replace(/[^0-9]/g,""); setCfg({...cfg, sucursales:a})}} className="w-full bg-[#11131a] p-2 rounded-xl text-sm border border-white/10" /></div>
        <div><label className="text-[8px] text-white/40">Ambiente</label><select value={s.ambiente || "1"} onChange={e=>{const a=[...cfg.sucursales]; a[i].ambiente=e.target.value; setCfg({...cfg, sucursales:a})}} className="w-full bg-[#11131a] p-2 rounded-xl text-sm border border-white/10"><option value="1">1 - PRUEBAS</option><option value="2">2 - PRODUCCIÓN</option></select></div>
        <div><label className="text-[8px] text-white/40">Obligado Contabilidad</label><select value={s.obligadoConta || cfg.obligadoConta || ""} onChange={e=>{const a=[...cfg.sucursales]; a[i].obligadoConta=e.target.value; setCfg({...cfg, sucursales:a})}} className="w-full bg-[#11131a] p-2 rounded-xl text-sm border border-white/10"><option value="">Hereda de matriz</option><option value="SI">SI</option><option value="NO">NO</option></select></div>
      </div>
      <p className="text-[9px] text-white/30">SRI: Estab {s.id} - Pto {s.ptoEmision} - Secuencial desde {s.secuencialInicio} - {s.provincia} - {s.ciudad} - RUC {cfg.ruc}</p>
    </div>
  ))}
</div>
                        <p className="text-[#00f5d4] font-bold text-[11px]">GESTIÓN DE IDENTIDAD Y DATOS LEGALES - PERFIL EMISOR SRI</p>
                        <div className="grid md:grid-cols-3 gap-3">
                            <div><label className="text-[9px] text-white/40">RUC *</label>
  <input 
    value={cfg.ruc || ""} 
    onChange={e => setCfg({ ...cfg, ruc: e.target.value.replace(/[^0-9]/g,"").slice(0,13) })} 
    placeholder="EJ: 1713314415001"
    className="w-full bg-black p-3 rounded-xl text-sm border border-white/10" />
</div>
<div className="md:col-span-2"><label className="text-[9px] text-white/40">RAZÓN SOCIAL * - TAL COMO ESTÁ EN EL SRI</label>
  <input 
    value={cfg.razonSocial || ""} 
    onChange={e => setCfg({ ...cfg, razonSocial: e.target.value.toUpperCase() })} 
    placeholder="EJ: NOMBRE COMPLETO SI ES PERSONA NATURAL, O NOMBRE DE LA EMPRESA"
    className="w-full bg-black p-3 rounded-xl text-sm border border-white/10 uppercase" />
  <p className="text-[9px] text-white/30 mt-1">Si eres persona natural como MEICSACONT, va tu nombre completo. Si eres empresa como MEIJSAC S.A.S, va el nombre de la empresa. Lo que escribas aquí es lo que sale en la factura.</p>
</div>
                            <div><label className="text-[9px] text-white/40">Nombre Comercial</label><input value={cfg.nombreComercial} onChange={e => setCfg({ ...cfg, nombreComercial: e.target.value.toUpperCase() })} className="w-full bg-black p-3 rounded-xl text-sm border border-white/10 uppercase" /></div>
                            <div><label className="text-[9px] text-white/40">Teléfono Empresa * RIDE</label><input value={cfg.telefono || ""} onChange={e => setCfg({ ...cfg, telefono: e.target.value })} placeholder="099..." className="w-full bg-black p-3 rounded-xl border border-white/10 text-sm" /></div>
                            <div><label className="text-[9px] text-white/40">Email Empresa * RIDE</label><input value={cfg.email || ""} onChange={e => setCfg({ ...cfg, email: e.target.value })} placeholder="ventas@meijsac.com" className="w-full bg-black p-3 rounded-xl border border-white/10 text-sm" /></div>
                            <div className="md:col-span-3"><label className="text-[9px] text-white/40">Actividad Económica Principal (RIDE Pie)</label><input value={cfg.actividad || ""} onChange={e => setCfg({ ...cfg, actividad: e.target.value.toUpperCase() })} placeholder="VENTA AL POR MENOR DE ALIMENTOS" className="w-full bg-black p-3 rounded-xl border border-white/10 text-sm uppercase" /></div>
                            <div><label className="text-[9px] text-white/40">Régimen SRI</label><select value={cfg.regimen} onChange={e => setCfg({ ...cfg, regimen: e.target.value })} className="w-full bg-black p-3 rounded-xl text-sm border border-white/10"><option>RIMPE EMPRENDEDOR</option><option>RIMPE NEGOCIO POPULAR</option><option>REGIMEN GENERAL</option></select></div>
                            <div><label className="text-[9px] text-white/40">Obligado Contabilidad</label><select value={cfg.obligadoConta} onChange={e => setCfg({ ...cfg, obligadoConta: e.target.value })} className="w-full bg-black p-3 rounded-xl text-sm border border-white/10"><option>SI</option><option>NO</option></select></div>
                            <div className="md:col-span-2"><label className="text-[9px] text-white/40">Dirección Matriz SRI</label><input value={cfg.dirMatriz} onChange={e => setCfg({ ...cfg, dirMatriz: e.target.value })} className="w-full bg-black p-3 rounded-xl text-sm border border-white/10" /></div>
                            <div><label className="text-[9px] text-white/40">Contribuyente Especial N°</label><input value={cfg.contribuyenteEspecial} onChange={e => setCfg({ ...cfg, contribuyenteEspecial: e.target.value })} className="w-full bg-black p-3 rounded-xl text-sm border border-white/10" placeholder="Vacío si no es" /></div>
                            <div><label className="text-[9px] text-white/40">Resolución Agente Retención</label><input value={cfg.resolucionAgente} onChange={e => setCfg({ ...cfg, resolucionAgente: e.target.value })} className="w-full bg-black p-3 rounded-xl text-sm border border-white/10" /><div className="flex gap-2 mt-2"><span className="text-[9px]">Toggle Agente:</span><button onClick={() => setCfg({ ...cfg, agenteRetencion: cfg.agenteRetencion === "SI" ? "NO" : "SI" })} className={`px-3 py-1 rounded-full text-[9px] ${cfg.agenteRetencion === "SI" ? "bg-green-500" : "bg-white/10"}`}>{cfg.agenteRetencion}</button></div></div>
                        </div>
                        <p className="text-[10px] bg-black p-3 rounded-xl border border-[#00f5d4]/20">
    Contribuyente Régimen {cfg.regimen} | Obligado Contab: {cfg.obligadoConta} {cfg.agenteRetencion === "SI" ? `| Agente Retención Res. N° ${cfg.resolucionAgente}` : ""} | {cfg.actividad || "Actividad: No definida"} | {cfg.provincia ? `${cfg.provincia} - ${cfg.ciudad}` : ""}
</p>
                    </div>
                )}

                {tab === "FIRMA" && (
                  <div className="space-y-4">
                    <p className="text-[#ffbe0a] font-bold text-[11px]">2. MÓDULO FIRMA ELECTRÓNICA AVANZADO - CARGA VISUAL.P12</p>

                    <div
                      onDrop={(e:any)=>{e.preventDefault(); const f=e.dataTransfer.files[0]; if(!f.name.toLowerCase().endsWith('.p12')){ alert('Solo archivos.p12'); return; } if(f){ setCfg((p:any)=>({...p, firma:{...p?.firma, nombre:f.name}})); handleFirmaChange({target:{files:[f]}} as any); }}}
                      onDragOver={(e)=>e.preventDefault()}
                      className="bg-black border-2 border-dashed border-white/20 rounded-xl p-6 text-center"
                    >
                      <p className="text-xs font-bold text-white">Caja Arrastrar y Soltar (Drag & Drop)</p>
                      <p className="text-[9px] text-white/40 mb-3">Arrastra tu.p12 aquí o selecciona</p>
                      <input type="file" accept=".p12" onChange={(e:any)=>{ const f=e.target.files?.[0]; if(f){ if(!f.name.toLowerCase().endsWith('.p12')){ alert('Solo se permite archivo.p12'); return; } setCfg((p:any)=>({...p, firma:{...p?.firma, nombre:f.name}})); handleFirmaChange(e); } }} className="mt-3 text-xs mx-auto block text-white" />
                      {cfg?.firma?.nombre && <p className="mt-3 text-[11px] text-[#00f5d4]">Archivo cargado: {cfg.firma.nombre}</p>}
                    </div>

                    {infoFirma && (
                      <div className="mt-3 p-4 rounded-xl border text-[12px] bg-black">
                        {infoFirma.error && <p className="text-red-500 font-bold">❌ {infoFirma.error}</p>}
                        {infoFirma.ok && (
                          <>
                            <p className="text-white">📅 Expira: {new Date(infoFirma.fechaExpiracion).toLocaleDateString()} ({infoFirma.diasRestantes} días)</p>
                            <p className="text-white">🪪 RUC en firma: {infoFirma.rucEnFirma}</p>
                            {!infoFirma.rucCoincide && <p className="text-red-500 font-bold mt-2 text-[12px]">🚨 ALERTA ROJA: El RUC {infoFirma.rucEnFirma} no coincide con el RUC de la empresa {cfg?.ruc}</p>}
                            {infoFirma.rucCoincide && <p className="text-green-400 font-bold mt-2">✅ RUC coincide correctamente</p>}
                          </>
                        )}
                      </div>
                    )}

                    <div><label className="text-[9px] text-white/40">Clave Firma.p12 * (oculto)</label><input type="password" value={cfg?.firma?.clave || ""} onChange={(e:any)=> setCfg((p:any)=>({...p, firma:{...p.firma, clave: e.target.value}}))} className="w-full bg-black border border-white/10 rounded p-2 text-[11px] text-white" /></div>
                  </div>
                )}
                
                {tab === "SECUENCIALES" && (
                  <div className="space-y-4">
                    <p className="text-[#00f5d4] font-bold text-[11px]">3. MATRIZ DE SECUENCIALES Y PUNTOS DE EMISIÓN - NIVEL EXPERTO SRI</p>

                    <div className="bg-black rounded-xl border border-white/10 overflow-hidden">
                      <table className="w-full text-[11px]">
                        <thead className="text-white/30 bg-white/5">
                          <tr><th className="p-2 text-left">Estab.</th><th>Pto.</th><th className="text-left">Tipo Comprobante SRI</th><th>Último Secuencial</th><th>Estado</th><th>X</th></tr>
                        </thead>
                        <tbody>
                          {cfg.secuenciales.map((s:any,i:number)=>(
                            <tr key={i} className="border-b border-white/5">
                              <td className="p-1"><input value={s.estab} maxLength={3} onChange={e=>{const a=[...cfg.secuenciales]; a[i].estab=e.target.value.replace(/[^0-9]/g,""); setCfg({...cfg, secuenciales:a})}} className="bg-[#11131a] p-1 rounded w-12 text-center border border-white/10 font-bold" /></td>
                              <td className="p-1"><input value={s.pto} maxLength={3} onChange={e=>{const a=[...cfg.secuenciales]; a[i].pto=e.target.value.replace(/[^0-9]/g,""); setCfg({...cfg, secuenciales:a})}} className="bg-[#11131a] p-1 rounded w-12 text-center border border-white/10 font-bold" /></td>
                              <td className="p-1">
                                <select value={s.codigo||"01"} onChange={e=>{const a=[...cfg.secuenciales]; a[i].codigo=e.target.value; a[i].tipo={ "01":"01 FACTURA", "04":"04 NOTA CRÉDITO", "03":"03 LIQ. COMPRA", "07":"07 RETENCIÓN", "06":"06 GUÍA REMISIÓN"}[e.target.value]; setCfg({...cfg, secuenciales:a})}} className="bg-[#11131a] p-1 rounded w-full border border-white/10 text-[10px]">
                                  <option value="01">01 FACTURA</option>
                                  <option value="04">04 NOTA DE CRÉDITO</option>
                                  <option value="03">03 LIQUIDACIÓN COMPRA</option>
                                  <option value="07">07 COMPROBANTE RETENCIÓN</option>
                                  <option value="06">06 GUÍA DE REMISIÓN</option>
                                </select>
                              </td>
                              <td className="p-1"><input value={s.ultimo} onChange={e=>{const a=[...cfg.secuenciales]; a[i].ultimo=e.target.value; setCfg({...cfg, secuenciales:a})}} className="bg-[#11131a] p-1 rounded w-24 text-center border border-white/10" /></td>
                              <td className="text-center"><span className={`px-2 py-0.5 rounded text-[9px] ${Number(s.ultimo.slice(-3))>950?"bg-red-600 animate-pulse":"bg-green-600"}`}>{Number(s.ultimo.slice(-3))>950?"¡ALERTA 50!":"ACTIVO"}</span></td>
                              <td className="text-center"><button onClick={()=>setCfg({...cfg, secuenciales:cfg.secuenciales.filter((_:any,idx:number)=>idx!==i)})} className="text-red-400">X</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button onClick={()=>setCfg({...cfg, secuenciales:[...cfg.secuenciales, {estab:"001", pto:"001", codigo:"01", tipo:"01 FACTURA", ultimo:"000000001"}]})} className="bg-[#00f5d4] text-black px-3 py-2 rounded-xl text-[10px] font-bold">+ Factura 001-001</button>
                      <button onClick={()=>setCfg({...cfg, secuenciales:[...cfg.secuenciales, {estab:"001", pto:"001", codigo:"04", tipo:"04 NOTA CRÉDITO", ultimo:"000000001"}]})} className="bg-white text-black px-3 py-2 rounded-xl text-[10px] font-bold">+ NC 001-001</button>
                      <button onClick={()=>setCfg({...cfg, secuenciales:[...cfg.secuenciales, {estab:"001", pto:"001", codigo:"07", tipo:"07 RETENCIÓN", ultimo:"000000001"}]})} className="bg-white/10 border border-white/10 px-3 py-2 rounded-xl text-[10px]">+ Retención 001-001</button>
                      <button onClick={()=>setCfg({...cfg, secuenciales:[...cfg.secuenciales, {estab:"001", pto:"002", codigo:"01", tipo:"01 FACTURA", ultimo:"000000001"}]})} className="bg-white/10 border border-white/10 px-3 py-2 rounded-xl text-[10px]">+ Caja 2 (001-002)</button>
                      <button onClick={()=>setCfg({...cfg, secuenciales:[...cfg.secuenciales, {estab:"002", pto:"001", codigo:"01", tipo:"01 FACTURA", ultimo:"000000001"}]})} className="bg-white/10 border border-white/10 px-3 py-2 rounded-xl text-[10px]">+ Sucursal Loreto 002-001</button>
                    </div>

                    <div className="bg-[#11131a] border border-[#00f5d4]/20 rounded-xl p-3 space-y-2">
                      <p className="text-[#00f5d4] font-bold text-[10px]">🏛️ MODO DESCONECTADO - COLA OFFLINE SRI (72H)</p>
                      <div className="flex items-center gap-3">
                        <label className="text-[10px] flex items-center gap-2"><input type="checkbox" checked={cfg.modoOffline||false} onChange={e=>setCfg({...cfg, modoOffline:e.target.checked})} /> Activar Facturación en Cola Offline</label>
                        <span className="text-[9px] text-white/40">Genera clave de acceso de 49 dígitos al instante, entrega RIDE al cliente, y envía XML firmado hasta 72h después cuando vuelva internet (Capacitor)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div className="bg-black p-2 rounded">En Cola: <b className="text-[#ffbe0a]">{cfg.colaOffline?.length||0} comprobantes</b></div>
                        <div className="bg-black p-2 rounded">Último envío: <b>{cfg.ultimoEnvioOffline||"Nunca"}</b></div>
                        <div className="bg-black p-2 rounded">Estado SRI: <b className="text-green-400">{cfg.modoOffline?"OFFLINE ACTIVO":"ONLINE"}</b></div>
                      </div>
                      <p className="text-[8px] text-white/30">Lógica: if (!navigator.onLine || cfg.modoOffline) guardar en IndexedDB colaOffline con claveAcceso + xmlFirmado + estado PENDIENTE. Al volver online, job cada 5min envía lote al SRI.</p>
                    </div>
                  </div>
                )}

                {tab === "IMPUESTOS" && (
                  <div className="space-y-5">
                    <p className="text-[#00f5d4] font-bold text-[11px]">4. AUTOMATIZACIÓN IMPUESTOS Y MONEDA</p>

                    <div className="flex items-center gap-3">
                      <label className="text-[10px] text-white/60">IVA Actual SRI</label>
                      <select value={cfg?.ivaActual || "15%"} onChange={(e:any)=> setCfg((p:any)=>({...p, ivaActual: e.target.value}))} className="bg-black border border-white/10 rounded-lg px-3 py-1 text-[12px] text-white">
                        <option>15%</option><option>12%</option><option>0%</option>
                      </select>
                      <span className="text-[9px] text-white/30">No altera reportes históricos - Historial: 2 cambios</span>
                    </div>

                    <div className="bg-black border border-white/10 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div><label className="text-[9px] text-white/40">Cuenta Caja</label><input value={cfg?.cuentaCaja || "1.01.01.01"} onChange={(e:any)=> setCfg((p:any)=>({...p, cuentaCaja: e.target.value}))} className="w-full bg-[#1e293b] rounded p-2 text-[12px] text-white" /></div>
                      <div><label className="text-[9px] text-white/40">Ventas IVA 0%</label><input value={cfg?.ventas0 || "4.01.01.01"} onChange={(e:any)=> setCfg((p:any)=>({...p, ventas0: e.target.value}))} className="w-full bg-[#1e293b] rounded p-2 text-[12px] text-white" /></div>
                      <div><label className="text-[9px] text-white/40">Ventas IVA 15%</label><input value={cfg?.ventas15 || "4.01.01.02"} onChange={(e:any)=> setCfg((p:any)=>({...p, ventas15: e.target.value}))} className="w-full bg-[#1e293b] rounded p-2 text-[12px] text-white" /></div>
                    </div>

                    <div className="bg-[#0f172a] border border-[#00f5d4]/30 rounded-xl p-4">
                      <p className="text-[#ffbe0a] font-bold text-[10px] mb-3">↳ RETENCIONES QUE TE APLICAN TUS CLIENTES (Crédito Tributario)</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-[9px] text-[#00f5d4]">Cuenta Retención IVA</label>
                          <input placeholder="1.01.05.01" value={cfg?.cuentaRetIva || ""} onChange={(e:any)=> setCfg((p:any)=>({...p, cuentaRetIva: e.target.value}))} className="w-full bg-black border border-[#00f5d4]/20 rounded p-2 text-[12px] text-white" />
                          <span className="text-[8px] text-white/30">Ej: Crédito Tributario IVA</span>
                        </div>
                        <div>
                          <label className="text-[9px] text-[#00f5d4]">Cuenta Ret. Renta Bienes (1.75%)</label>
                          <input placeholder="1.01.05.02" value={cfg?.cuentaRetRentaBienes || ""} onChange={(e:any)=> setCfg((p:any)=>({...p, cuentaRetRentaBienes: e.target.value}))} className="w-full bg-black border border-[#00f5d4]/20 rounded p-2 text-[12px] text-white" />
                          <span className="text-[8px] text-white/30">Venta de bienes corporales</span>
                        </div>
                        <div>
                          <label className="text-[9px] text-[#00f5d4]">Cuenta Ret. Renta Servicios (2.75%)</label>
                          <input placeholder="1.01.05.03" value={cfg?.cuentaRetRentaServicios || ""} onChange={(e:any)=> setCfg((p:any)=>({...p, cuentaRetRentaServicios: e.target.value}))} className="w-full bg-black border border-[#00f5d4]/20 rounded p-2 text-[12px] text-white" />
                          <span className="text-[8px] text-white/30">Prestación de servicios</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-white/40 mt-2">💡 Si eres Régimen General, estas 3 cuentas se usan cuando tu cliente te retiene y te entrega comprobante de retención.</p>
                    </div>

                  </div>
                )}
                
                {tab === "DOCUMENTOS" && <DocumentosLegales />}

                {tab === "MARCA RIDE" && (
                  <div className="space-y-5">
                    <p className="text-[#00f5d4] font-bold text-[11px]">5. MARCA RIDE - IMAGEN PARA FACTURA ELECTRÓNICA</p>

                    <div
                      onDrop={(e:any)=>{ e.preventDefault(); elegirLogo(e.dataTransfer.files?.[0]); }}
                      onDragOver={(e)=>e.preventDefault()}
                      className="bg-black border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-[#00f5d4]/50 transition"
                    >
                      <p className="text-[10px] font-bold text-white mb-1">Logotipo de Empresa (RIDE)</p>
                      <p className="text-[9px] text-white/30 mb-3">PNG, JPG o WEBP. Máximo 2 MB.</p>

                      {(cfg?.logoPreview || cfg?.logoUrl || cfg?.logo_url)? (
                        <div className="mx-auto w-48 h-48 bg-white rounded-lg p-3 flex items-center justify-center mb-3">
                          <img src={cfg?.logoPreview || cfg?.logoUrl || cfg?.logo_url} alt="Logotipo" className="max-w-full max-h-full object-contain" />
                        </div>
                      ) : (
                        <div className="mx-auto w-48 h-28 bg-white/5 rounded-lg flex items-center justify-center mb-3 border border-white/10">
                          <span className="text-[11px] text-white/40">Sin logotipo</span>
                        </div>
                      )}

                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        onChange={(e:any)=>{ elegirLogo(e.target.files?.[0]); e.target.value = ""; }}
                        className="mt-2 text-[10px] mx-auto block text-white/60 file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-[#00f5d4] file:text-black file:text-[10px] file:font-bold hover:file:bg-[#00f5d4]/80"
                      />
                      {cfg?.logoNombre && <p className="mt-2 text-[10px] text-[#00f5d4]">📁 {cfg.logoNombre}</p>}
                      {avisoLogo && (
                        <p className={`mt-3 text-[12px] font-bold ${avisoLogo === "Logotipo guardado correctamente" ? "text-green-400" : "text-red-400"}`}>{avisoLogo}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black border border-white/10 rounded-xl p-4">
                      <div>
                        <label className="text-[9px] text-white/40">Facebook (URL completa)</label>
                        <input
                          placeholder="https://facebook.com/meijsac"
                          value={cfg?.facebook || ""}
                          onChange={(e:any)=> setCfg((p:any)=>({...p, facebook: e.target.value}))}
                          className="w-full bg-[#1e293b] rounded p-2 text-[12px] text-white mt-1"
                        />
                        <span className="text-[8px] text-white/30">Se usará como botón en el RIDE</span>
                      </div>
                      <div>
                        <label className="text-[9px] text-white/40">Instagram (Nombre de usuario)</label>
                        <input
                          placeholder="meijsac - sin @"
                          value={(cfg?.instagram || "").replace('@','')}
                          onChange={(e:any)=>{ const limpio = e.target.value.replace('@','').replace('https://','').replace('instagram.com/','').replace('/',''); setCfg((p:any)=>({...p, instagram: limpio})); }}
                          className="w-full bg-[#1e293b] rounded p-2 text-[12px] text-white mt-1"
                        />
                        <span className="text-[8px] text-[#00f5d4]">Se generará: https://instagram.com/{cfg?.instagram || "tu_usuario"}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="text-[9px] text-white/40">Color Primario RIDE</label><input type="color" value={cfg?.colorPrimario || "#00f5d4"} onChange={(e:any)=> setCfg((p:any)=>({...p, colorPrimario: e.target.value}))} className="w-full h-9 bg-black rounded" /></div>
                      <div><label className="text-[9px] text-white/40">Slogan / Leyenda</label><input placeholder="Tu confianza, nuestra calidad" value={cfg?.slogan || ""} onChange={(e:any)=> setCfg((p:any)=>({...p, slogan: e.target.value}))} className="w-full bg-[#1e293b] rounded p-2 text-[12px] text-white" /></div>
                    </div>
                  </div>
                )}

                {tab === "PERMISOS" && (
                  <div className="space-y-4">
                    <p className="text-[#00f5d4] font-bold text-[11px]">6. PERMISOS AVANZADOS - CONTROL DE CAJEROS Y ANTI-FRAUDE</p>

                    <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-4">
                      <div className="bg-black border border-white/10 rounded-xl p-3 h-fit">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-[10px] font-bold text-white">Usuarios del POS ({(cfg?.usuarios || []).length})</p>
                          <button onClick={()=>{
                            const nuevo = { id: Date.now().toString(), nombre:"", email:"", rol:"Cajero", establecimiento:"001", puntoEmision:"002", bodega:"Bodega Principal", activo:true, permisos:{ descuento:false, limiteDescuento:5, modificarPrecio:false, anulaciones:false, verCostos:false, verReportes:false, modificarSecuenciales:false, obligarApertura:true, reaperturaCaja:false }};
                            setCfg((p:any)=>({...p, usuarios:[...(p?.usuarios||[]), nuevo], usuarioSel: nuevo.id}));
                          }} className="bg-[#00f5d4] text-black text-[9px] font-bold px-3 py-1 rounded-full">+ NUEVO</button>
                        </div>

                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                          {(cfg?.usuarios || []).map((u:any)=>(
                            <div key={u.id} onClick={()=> setCfg((p:any)=>({...p, usuarioSel: u.id}))} className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer ${cfg?.usuarioSel===u.id? 'bg-[#1e293b] border-[#00f5d4]/50' : 'bg-[#0f172a] border-white/5'}`}>
                              <div className="w-7 h-7 rounded-full bg-[#ffbe0a] text-black font-bold text-[10px] flex items-center justify-center">{u.nombre?.[0]?.toUpperCase() || 'U'}</div>
                              <div className="flex-1">
                                <p className="text-[11px] text-white font-bold">{u.nombre || 'Sin nombre'}</p>
                                <p className="text-[8px] text-white/40">{u.rol} {u.establecimiento}-{u.puntoEmision} {u.bodega}</p>
                              </div>
                              <span className={`text-[7px] px-2 py-0.5 rounded-full font-bold ${u.rol==='Administrador'?'bg-[#ffbe0a] text-black': u.rol==='Contador'?'bg-[#00f5d4] text-black':'bg-white/10 text-white'}`}>{u.rol}</span>
                            </div>
                          ))}
                          {(!cfg?.usuarios || cfg.usuarios.length===0) && <p className="text-[9px] text-white/20 text-center py-10">No hay usuarios. Crea el primer cajero.</p>}
                        </div>
                      </div>

                      <div className="bg-[#111827] border border-white/10 rounded-xl p-4">
                        {(()=>{
                          const u = (cfg?.usuarios || []).find((x:any)=>x.id===cfg?.usuarioSel);
                          if(!u) return <p className="text-[10px] text-white/30 text-center py-20">Selecciona un usuario a la izquierda para configurar permisos</p>;
                          const upd = (patch:any)=> setCfg((p:any)=>({...p, usuarios: p.usuarios.map((x:any)=> x.id===u.id? {...x,...patch} : x)}));
                          const updPerm = (k:string, v:any)=> upd({ permisos:{...u.permisos, [k]:v} });
                          return (
                            <div className="space-y-4">
                              <p className="text-[#ffbe0a] text-[10px] font-bold">PERFIL Y AMARRE A CAJA / BODEGA (CRÍTICO)</p>
                              <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-[8px] text-white/40">Nombre Empleado</label><input value={u.nombre} onChange={e=>upd({nombre:e.target.value})} className="w-full bg-black rounded p-2 text-[11px] text-white border border-white/10" placeholder="Ej: Juan Cajero"/></div>
                                <div><label className="text-[8px] text-white/40">Rol</label><select value={u.rol} onChange={e=>upd({rol:e.target.value})} className="w-full bg-black rounded p-2 text-[11px] text-white border border-white/10"><option>Administrador</option><option>Cajero</option><option>Contador</option><option>Bodeguero</option></select></div>
                                <div><label className="text-[8px] text-white/40">Correo / Usuario</label><input value={u.email} onChange={e=>upd({email:e.target.value})} className="w-full bg-black rounded p-2 text-[11px] text-white border border-white/10" placeholder="cajero@meijsac.com"/></div>
                                <div><label className="text-[8px] text-white/40">Contraseña</label><input type="password" value={u.password||''} onChange={e=>upd({password:e.target.value})} className="w-full bg-black rounded p-2 text-[11px] text-white border border-white/10" placeholder="****"/></div>
                                <div><label className="text-[8px] text-[#00f5d4]">Establecimiento</label><select value={u.establecimiento} onChange={e=>upd({establecimiento:e.target.value})} className="w-full bg-black rounded p-2 text-[11px] text-white border border-[#00f5d4]/20"><option>001</option><option>002</option><option>003</option></select></div>
                                <div><label className="text-[8px] text-[#00f5d4]">Punto Emisión (Caja)</label><select value={u.puntoEmision} onChange={e=>upd({puntoEmision:e.target.value})} className="w-full bg-black rounded p-2 text-[11px] text-white border border-[#00f5d4]/20"><option>001</option><option>002</option><option>003</option><option>004</option></select></div>
                                <div className="col-span-2"><label className="text-[8px] text-[#00f5d4]">Bodega Asignada</label><select value={u.bodega} onChange={e=>upd({bodega:e.target.value})} className="w-full bg-black rounded p-2 text-[11px] text-white border border-[#00f5d4]/20"><option>Bodega Principal</option><option>Bodega Secundaria</option><option>Bodega Quito</option></select><span className="text-[7px] text-white/30">Solo rebaja stock de esta bodega</span></div>
                                {/* === PROVINCIA Y CIUDAD - NO BORRA LO ANTERIOR, SOLO AGREGA === */}
                                <div><label className="text-[9px] text-white/40">Provincia *</label>
                                <select value={cfg.provincia || ""} onChange={e => setCfg({ ...cfg, provincia: e.target.value })} className="w-full bg-black p-3 rounded-xl text-sm border border-white/10">
                                <option value="">Seleccione provincia</option>
                                {["Azuay","Bolívar","Cañar","Carchi","Chimborazo","Cotopaxi","El Oro","Esmeraldas","Galápagos","Guayas","Imbabura","Loja","Los Ríos","Manabí","Morona Santiago","Napo","Orellana","Pastaza","Pichincha","Santa Elena","Santo Domingo","Sucumbíos","Tungurahua","Zamora Chinchipe"].map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                      </div>
                                        <div><label className="text-[9px] text-white/40">Ciudad *</label>
                                        <input value={cfg.ciudad || ""} onChange={e => setCfg({ ...cfg, ciudad: e.target.value.toUpperCase() })} placeholder="Ej: QUITO, COCA, LORETO" className="w-full bg-black p-3 rounded-xl text-sm border border-white/10 uppercase" />
                                  </div>
                              </div>

                              <p className="text-[#ffbe0a] text-[10px] font-bold pt-2 border-t border-white/5">2. MATRIZ ANTI-FRAUDE POS</p>
                              <div className="space-y-2 bg-black rounded-lg p-3 border border-white/5">
                                {[
                                  {k:'descuento', label:'Permitir Descuentos Manuales', desc:'Si OFF, solo vende a precio fijo'},
                                  {k:'modificarPrecio', label:'Permitir Modificar Precios Unitarios', desc:'Editar precio en carrito'},
                                  {k:'anulaciones', label:'Permitir Anulaciones / Notas de Crédito', desc:'FRAUDE COMÚN - solo admin'},
                                  {k:'obligarApertura', label:'Obligar Apertura de Caja', desc:'No factura sin caja chica inicial'},
                                  {k:'reaperturaCaja', label:'Permiso Reapertura de Caja Cerrada', desc:'Reabrir caja consolidada'},
                                ].map((p:any)=>(
                                  <label key={p.k} className="flex items-center justify-between py-1 cursor-pointer">
                                    <div><p className="text-[10px] text-white">{p.label}</p><p className="text-[7px] text-white/30">{p.desc}</p></div>
                                    <input type="checkbox" checked={!!u.permisos?.[p.k]} onChange={e=>updPerm(p.k, e.target.checked)} className="w-4 h-4 accent-[#00f5d4]" />
                                  </label>
                                ))}
                                <div className="flex items-center gap-2 pt-2"><label className="text-[9px] text-white">Límite Máx Descuento %</label><input type="number" value={u.permisos?.limiteDescuento||5} onChange={e=>updPerm('limiteDescuento', Number(e.target.value))} className="w-16 bg-[#1e293b] rounded p-1 text-[11px] text-white text-center" /><span className="text-[8px] text-white/30">Requiere clave supervisor si excede</span></div>
                              </div>

                              <p className="text-[#ffbe0a] text-[10px] font-bold pt-2 border-t border-white/5">3. PRIVACIDAD DE INFORMACIÓN</p>
                              <div className="space-y-2 bg-black rounded-lg p-3 border border-white/5">
                                {[
                                  {k:'verCostos', label:'Permitir Ver Costos de Compra y Utilidad', desc:'Costo proveedor y margen - privado del dueño'},
                                  {k:'verReportes', label:'Acceso a Reportes Financieros y Dashboard', desc:'Totales mes, gráficas, cierres globales'},
                                  {k:'modificarSecuenciales', label:'Permitir Modificar Secuenciales / Config SRI', desc:'CRÍTICO - solo administrador'},
                                ].map((p:any)=>(
                                  <label key={p.k} className="flex items-center justify-between py-1 cursor-pointer">
                                    <div><p className="text-[10px] text-white">{p.label}</p><p className="text-[7px] text-white/30">{p.desc}</p></div>
                                    <input type="checkbox" checked={!!u.permisos?.[p.k]} onChange={e=>updPerm(p.k, e.target.checked)} className="w-4 h-4 accent-[#ffbe0a]" />
                                  </label>
                                ))}
                              </div>

                              <div className="flex gap-2 pt-2">
                                <button onClick={()=>{ if(confirm('¿Eliminar usuario?')) setCfg((p:any)=>({...p, usuarios: p.usuarios.filter((x:any)=>x.id!==u.id), usuarioSel:null}))}} className="text-[9px] text-red-400 border border-red-400/20 rounded px-3 py-1">Eliminar Usuario</button>
                                <span className="text-[8px] text-white/20 ml-auto self-center">ID: {u.id} {u.establecimiento}-{u.puntoEmision}</span>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {tab === "AMBIENTE SRI" && (
                  <div className="space-y-5">
                    <p className="text-[#00f5d4] font-bold text-[11px]">AMBIENTE SRI - PRUEBAS / PRODUCCIÓN</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div
                        onClick={()=> setCfg((p:any)=>({...p, ambiente:'PRUEBAS'}))}
                        className={`rounded-xl p-4 border-2 cursor-pointer transition-all ${
                          (cfg?.ambiente||'PRUEBAS')==='PRUEBAS'
                           ? 'bg-[#0f172a] border-[#00f5d4] shadow-[0_0_20px_rgba(0,245,212,0.3)] scale-[1.02]'
                           : 'bg-black border-white/10 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <p className="text-[11px] font-bold text-white">🧪 PRUEBAS</p>
                        <p className="text-[9px] text-white/50 mt-1">Conectado a SRI de pruebas. Facturas sin validez tributaria.</p>
                        <span className={`mt-2 inline-block text-[8px] px-2 py-0.5 rounded-full font-bold ${(cfg?.ambiente||'PRUEBAS')==='PRUEBAS'?'bg-[#00f5d4] text-black':'bg-white/10 text-white/30'}`}>ACTIVO</span>
                      </div>

                      <div
                        onClick={() => { if(confirm("Activar PRODUCCION REAL? Las facturas tendran validez legal ante el SRI.")) setCfg((p:any)=>({...p, ambiente:"PRODUCCIÓN"})) }}
                        className={`rounded-xl p-4 border-2 cursor-pointer transition-all ${
                          cfg?.ambiente==='PRODUCCIÓN'
                           ? 'bg-[#0f172a] border-[#00ff5d] shadow-[0_0_20px_rgba(0,255,93,0.4)] scale-[1.02]'
                           : 'bg-black border-white/10 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <p className="text-[11px] font-bold text-white">🚀 PRODUCCIÓN REAL</p>
                        <p className="text-[9px] text-white/50 mt-1">Conectado al SRI real. Facturas con validez tributaria inmediata.</p>
                        <span className={`mt-2 inline-block text-[8px] px-2 py-0.5 rounded-full font-bold ${cfg?.ambiente==='PRODUCCIÓN'?'bg-[#00ff5d] text-black':'bg-white/10 text-white/30'}`}>{cfg?.ambiente==='PRODUCCIÓN'?'ACTIVO':'INACTIVO'}</span>
                      </div>
                    </div>

                    <div className={`p-3 rounded-lg border text-[9px] ${cfg?.ambiente==='PRODUCCIÓN'?'bg-[#00ff5d]/10 border-[#00ff5d]/30 text-[#00ff5d]':'bg-[#00f5d4]/10 border-[#00f5d4]/20 text-[#00f5d4]'}`}>
                      {cfg?.ambiente==='PRODUCCIÓN'? '⚠️ ESTÁS EN PRODUCCIÓN REAL - Cada factura se envía al SRI y genera XML autorizado.' : 'ℹ️ Estás en PRUEBAS - Ideal para configurar firma, RIDE y permisos sin riesgo.'}
                    </div>
                  </div>
                )}

                <div className="flex justify-end mt-8">
                  <button
                    onClick={handleGuardar}
                    disabled={guardando || avisoLogo.startsWith("Formato") || avisoLogo.startsWith("La imagen")}
                    className={`font-black text-[11px] px-6 py-2 rounded-full transition-all ${
                      cfg?.ambiente==='PRODUCCIÓN'
                       ? 'bg-[#00ff5d] text-black shadow-[0_0_15px_rgba(0,255,93,0.5)] hover:bg-[#00ff5d]/90'
                       : 'bg-[#00f5d4] text-black shadow-[0_0_15px_rgba(0,245,212,0.3)] hover:bg-[#00f5d4]/90'
                    }`}
                  >
                    {cfg?.ambiente==='PRODUCCIÓN'? '✓ GUARDAR EN PRODUCCIÓN REAL' : '✓ GUARDAR PRUEBAS'}
                  </button>
                </div>
            </div>
        </div>
    );
}