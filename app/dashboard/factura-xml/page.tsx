"use client"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import ModalCajaMixto from "./components/ModalCajaMixto"
import { elegirSecuencial, puntoActivoFactura } from "@/lib/sri/punto-emision"
import { normalizarComprador } from "@/lib/sri/xml-factura"

function codigosProducto(p: any) {
  return [p?.codigo, p?.codigoBarras, p?.codigo_barras, p?.codigoAuxiliar, p?.codigoInterno, p?.codigo_interno, p?.sku, p?.codigoAlterno, p?.codigo_alterno]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
}

function coincideProducto(p: any, texto: string) {
  const t = texto.trim().toLowerCase()
  if (!t) return false
  const nombre = String(p?.nombre || p?.descripcion || "").toLowerCase()
  return nombre.includes(t) || codigosProducto(p).some((c) => c.toLowerCase().includes(t))
}

function productoDeApi(p: any) {
  const ficha = p?.ficha && typeof p.ficha === "object" ? p.ficha : {}
  return {
    ...ficha,
    ...p,
    codigo: String(p?.codigo || ficha.codigo || "").trim(),
    nombre: String(p?.nombre || ficha.nombre || p?.descripcion || "").trim(),
    codigoAuxiliar: String(ficha.codigoAuxiliar || p?.codigoAuxiliar || p?.codigoBarras || "").trim(),
    precio: Number(ficha.precioMinorista ?? p?.precio ?? 0),
    precioMinorista: Number(ficha.precioMinorista ?? p?.precio ?? 0),
    stock: Number(p?.stock ?? ficha.stock ?? 0),
    tipoIvaSRI: ficha.tipoIvaSRI || p?.tipoIvaSRI,
    codigoPorcentaje: ficha.codigoPorcentaje || p?.codigoPorcentaje,
  }
}

async function buscarProductosEnBase(texto: string) {
  const q = texto.trim()
  if (!q) return []
  const res = await fetch(`/api/productos?q=${encodeURIComponent(q)}`)
  const data = await res.json().catch(() => [])
  return Array.isArray(data) ? data.map(productoDeApi) : []
}

function productoExacto(productos: any[], texto: string) {
  const t = texto.trim().toLowerCase()
  if (!t) return null
  return productos.find((p) => codigosProducto(p).some((c) => c.toLowerCase() === t)) || null
}

const PROVINCIAS = {
   "PICHINCHA": ["QUITO", "CAYAMBE", "MEJÍA", "PEDRO MONCAYO", "PEDRO VICENTE MALDONADO", "PUERTO QUITO", "RUMIÑAHUI", "SAN MIGUEL DE LOS BANCOS"],
  "GUAYAS": ["ALFREDO BAQUERIZO MORENO (JUJÁN)", "BALAO", "BALZAR", "COLIMES", "CORONEL MARCELINO MARIDUEÑA", "DAULE", "DURÁN", "EL EMPALME", "EL TRIUNFO", "GENERAL ANTONIO ELIZALDE (BUCAY) ", "GENERAL VILLAMIL PLAYAS", "GUAYAQUIL", "ISIDRO AYORA", "LOMAS DE SARGENTILLO", "MILAGRO", "NARANJAL", "NARANJITO", "NOBOL", "PALESTINA", "PEDRO CARBO", "SALITRE", "SAMBORONDÓN", "SAN JACINTO DE YAGUACHI", "SANTA LUCÍA", "SIMÓN BOLÍVAR"],
  "AZUAY": ["CUENCA", "GUALACEO", "PAUTE", "CHORDELEG", "SÍGSIG", "GIRÓN", "SANTA ISABEL", "CAMILO PONCE ENRÍQUEZ", "SAN FERNANDO", "PUCARÁ", "NABÓN", "OÑA", "SEVILLA DE ORO", "GUACHAPALA", "EL PAN"],
  "MANABI": ["PORTOVIEJO", "MANTA", "CHONE", "BAHÍA DE CARÁQUEZ", "MONTECRISTI", "JIPIJAPA", "CALCETA", "EL CARMEN", "PEDERNALES", "SANTA ANA", "ROCAFUERTE", "TOSAGUA", "SUCRE", "FLAVIO ALFARO", "PAJÁN", "JAMA", "SAN VICENTE", "PUERTO LÓPEZ", "24 DE MAYO", "OLMEDO", "PICHINCHA", "JARAMIJÓ"],
  "EL ORO": ["MACHALA", "PASAJE", "SANTA ROSA", "HUAQUILLAS", "ARENILLAS", "PIÑAS", "ZARUMA", "BALSAS", "MARCABELÍ", "CHILLA", "ATAHUALPA", "PORTOVELO", "EL GUABO", "LAS LAJAS"],
  "TUNGURAHUA": ["AMBATO", "BAÑOS DE AGUA SANTA", "PELILEO", "PÍLLARO", "QUERO", "CEVALLOS", "MOCHA", "TISALEO", "PATATE"],
  "IMBABURA": ["IBARRA", "OTAVALO", "COTACACHI", "ATUNTAQUI", "PIMAMPIRO", "URCUQUÍ"],
  "LOJA": ["LOJA", "CATAMAYO", "CARIAMANGA", "CATACOCHA", "MACARÁ", "ALAMOR", "CELICA", "PALTAS", "SARAGURO", "PINDAL", "ZAPOTILLO", "CHAGUARPAMBA", "ESPÍNDOLA", "GONZANAMÁ", "QUILANGA", "SOZORANGA"],
  "COTOPAXI": ["LATACUNGA", "PUJILÍ", "SALCEDO", "SAQUISILÍ", "PANGUA", "LA MANÁ", "SIGCHOS"],
  "CHIMBORAZO": ["RIOBAMBA", "ALAUASÍ", "COLTA", "GUANO", "CHAMBO", "GUAMOTE", "CHUNCHI", "PALLATANGA", "CUMANDÁ", "PENIPE"],
  "ESMERALDAS": ["ESMERALDAS", "ATACAMES", "QUININDÉ", "SAN LORENZO", "ELOY ALFARO", "MUISNE", "RÍO VERDE"],
  "LOS RIOS": ["BABAHOYO", "QUEVEDO", "BABA", "BUENA FE", "MOCACHE", "MONTALVO", "PALENQUE", "PUEBLOVIEJO", "URDANETA", "VENTANAS", "VÍNCES", "VALENCIA", "QUINSALOMA"],
  "SANTO DOMINGO": ["SANTO DOMINGO", "LA CONCORDIA"],
  "SANTA ELENA": ["SANTA ELENA", "SALINAS", "LA LIBERTAD"],
  "CARCHI": ["TULCÁN", "SAN GABRIEL", "EL ÁNGEL", "HUACA", "BOLÍVAR", "MIRA"],
  "BOLIVAR": ["GUARANDA", "SAN MIGUEL", "CHILLANES", "CHUMBO", "ECHEANDÍA", "CALUMA", "LAS NAVES"],
  "CAÑAR": ["AZOGUES", "CAÑAR", "LA TRONCAL", "BIBLIÁN", "EL TAMBO", "DÉLEG", "SUSCAL"],
  "MORONA SANTIAGO": ["MACAS", "SUCÚA", "GUALAQUIZA", "GENERAL LEONIDAS PLAZA GUTIÉRREZ", "SANTIAGO DE MÉNDEZ", "LOGROÑO", "PALORA", "SANTIAGO", "SAN JUAN BOSCO", "HUAMBOYA", "PABLO SEXTO", "TAISHA"],
  "NAPO": ["TENA", "ARCHIDONA", "EL CHACO", "BAEZA", "CARLOS JULIO AROSEMENA TOLA"],
  "ORELLANA": ["PUERTO FRANCISCO DE ORELLANA", "JOYA DE LOS SACHAS", "TIPUTINI", "LORETO"],
  "PASTAZA": ["PUYO", "MERA", "SANTA CLARA", "SHELL"],
  "SUCUMBIOS": ["NUEVA LOJA", "SHUSHUFINDI", "EL DORADO DE CASCALES", "LUMBAQUÍ", "PUERTO EL CARMEN DE PUTUMAYO", "TARAPOA", "LA BONITA"],
  "ZAMORA CHINCHIPE": ["ZAMORA", "YANTZAZA", "EL PANGUI", "ZUMBA", "PALANDA", "GUAYZIMI", "ZUMBI", "PAQUISHA", "28 DE MAYO"],
  "GALAPAGOS": ["PUERTO BAQUERIZO MORENO", "PUERTO AYORA", "PUERTO VILLAMIL"],
} as const

const POLITICAS = {
  BLOQUEADO: "Bloqueado (Sin Crédito)",
  REQUISITO: "Crédito Bajo Requisito",
  VIP: "Crédito Libre / VIP"
} as const
const PLAZOS = [7,15,30,45,60,90]

type Item = {
  codigo:string; 
  descripcion:string; 
  detalle:string;
  cant:number; 
  pUnit:number; 
  descPorc:number;
  codigoPorcentaje:string; // string para que agarre "10"
  tarifa?:number; // <- con ? ya no te obliga en todos lados
  iva:number;
  ice:number;
  esPlastico:boolean;
  valorIva?:number;
  detalleAdicional?: string;
  descDolar?: number;
  tarifas?: {min:number, may:number, dist:number}
}

const Chisme = ({texto, titulo}:{texto:string, titulo:string}) => (
  <div className="absolute -top-[58px] left-1/2 -translate-x-1/2 hidden group-hover:block z-50">
    <div className="bg-black border border-[#00f5d4] rounded-xl px-3 py-2 shadow-[0_0_20px_rgba(0,245,212,0.3)] min-w-[220px]">
      <p className="text-[#00f5d4] font-black text-[11px]">{titulo}</p>
      <p className="text-white text-[10px] mt-1">— {texto}</p>
    </div>
    <div className="w-2 h-2 bg-black border-r border-b border-[#00f5d4] rotate-45 mx-auto -mt-1"></div>
  </div>
);

export default function FacturadorXMLReal(){
  const [fecha, setFecha] = useState("")
  const [puntoEmision, setPuntoEmision] = useState({ ambiente: "1" as "1" | "2", nombre: "PRUEBAS", estab: "", pto: "", serie: "", secuencial: "", ultimo: "", indice: -1 })
  const cargarPunto = (estabElegido?: string) => {
    let cfg: any = {}
    try { cfg = JSON.parse(localStorage.getItem("meijsac_config_pro") || "{}") } catch { cfg = {} }
    const leido = puntoActivoFactura(cfg.secuenciales, cfg.ambiente, estabElegido)
    const usados = new Set<string>()
    for (const clave of ["meijsac_comprobantes_sri", "meijsac_comprobantes_emitidos", "meijsac_enviados_sri"]) {
      try {
        const lista = JSON.parse(localStorage.getItem(clave) || "[]")
        for (const d of lista) {
          const partes = String(d?.secuencial || "").split("-")
          const est = partes.length >= 3 ? `${partes[0]}-${partes[1]}` : String(d?.establecimiento || "")
          if (est !== leido.punto.serie) continue
          const n = (partes.length >= 3 ? partes[2] : String(d?.secuencial || "")).replace(/\D/g, "").padStart(9, "0").slice(-9)
          if (n && n !== "000000000") usados.add(n)
        }
      } catch {}
    }
    let contadorLocal = ""
    try { contadorLocal = JSON.parse(localStorage.getItem("meijsac_contador_secuencial") || "{}")[leido.punto.serie] || "" } catch { contadorLocal = "" }
    const ultimoConocido = Number(String(contadorLocal).replace(/\D/g, "") || "0") > Number(String(leido.punto.ultimo).replace(/\D/g, "") || "0") ? contadorLocal : leido.punto.ultimo
    const codigo = String(cfg.ambiente || "").toUpperCase().includes("PROD") || String(cfg.ambiente) === "2" ? "2" : "1"
    setPuntoEmision({
      ambiente: codigo as "1" | "2",
      nombre: codigo === "2" ? "PRODUCCIÓN" : "PRUEBAS",
      estab: leido.punto.estab,
      pto: leido.punto.pto,
      serie: leido.punto.serie,
      secuencial: leido.punto.serie ? elegirSecuencial("", ultimoConocido, usados) : "",
      ultimo: ultimoConocido,
      indice: leido.punto.indice,
    })
  }
  const guardarSecuencialUsado = (serie: string, usado: string) => {
    if (!serie || !usado) return
    try {
      const mapa = JSON.parse(localStorage.getItem("meijsac_contador_secuencial") || "{}")
      const previo = Number(String(mapa[serie] || "0").replace(/\D/g, ""))
      if (Number(usado) >= previo) mapa[serie] = usado
      localStorage.setItem("meijsac_contador_secuencial", JSON.stringify(mapa))
      const cfg = JSON.parse(localStorage.getItem("meijsac_config_pro") || "{}")
      const lista = Array.isArray(cfg.secuenciales) ? cfg.secuenciales : []
      const [estab, pto] = serie.split("-")
      const i = lista.findIndex((s: any) => String(s?.estab || "").replace(/\D/g, "").padStart(3, "0").slice(-3) === estab && String(s?.pto || "").replace(/\D/g, "").padStart(3, "0").slice(-3) === pto)
      if (i < 0) lista.push({ estab, pto, codigo: "01", tipo: "01 FACTURA", ultimo: usado, estado: "ACTIVO" })
      else lista[i] = { ...lista[i], ultimo: usado }
      cfg.secuenciales = lista
      localStorage.setItem("meijsac_config_pro", JSON.stringify(cfg))
    } catch {}
  }
  useEffect(() => { cargarPunto() }, [])
  const [configEmisor, setConfigEmisor] = useState<any>({})
  const [emisorListo, setEmisorListo] = useState(false)
  const [emisorCargando, setEmisorCargando] = useState(true)
    // --- AGREGADO TEMA Y CLIENTE ---
  const [isDark, setIsDark] = useState(true)
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [buscandoSRI, setBuscandoSRI] = useState(false)
  const [nuevoCliForm, setNuevoCliForm] = useState({ razon:"", identificacion:"", direccion:"", email:"", telefono:"" })
  

  useEffect(()=>{
    setFecha(new Date().toLocaleDateString('es-EC'))
    let vivo = true
    const cargarEmisorFactura = async () => {
      const conTexto = (...vals: unknown[]) => {
        for (const v of vals) {
          if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim()
        }
        return ""
      }
      let empresa: any = {}
      try { empresa = JSON.parse(localStorage.getItem("meijsac_empresa") || "{}") } catch { empresa = {} }
      let cfg: any = {}
      try { cfg = JSON.parse(localStorage.getItem("meijsac_config_pro") || "{}") } catch { cfg = {} }
      const armar = (emp: any, conf: any) => {
        const sucursal = (conf.sucursales || emp.sucursales || []).find((s: any) => s?.dir || s?.direccion) || null
        const ambienteRaw = conTexto(conf.ambiente, sucursal?.ambiente, emp.ambiente)
        const ambiente = ambienteRaw === "2" || ambienteRaw.toUpperCase().includes("PROD") ? "PRODUCCIÓN" : "PRUEBAS"
        return {
          empresaId: emp.id || emp.empresaId || "",
          razon: conTexto(conf.razonSocial, emp.razonSocial, emp.razon),
          comercial: conTexto(conf.nombreComercial, emp.nombreComercial),
          ruc: conTexto(conf.ruc, emp.ruc),
          matriz: conTexto(conf.dirMatriz, emp.dirMatriz, emp.direccion),
          sucursal: conTexto(sucursal?.dir, sucursal?.direccion, conf.dirEstablecimiento, emp.dirEstablecimiento),
          obligado: conTexto(conf.obligadoConta, conf.obligadoContabilidad, emp.obligadoConta, emp.obligado),
          regimen: conTexto(conf.regimen, emp.regimen),
          ambiente,
          logo: [conf.logo_url, conf.logoUrl, conf.marca?.logo, emp.logo_url, emp.logoUrl].map(v => String(v || "").trim()).find(v => v.startsWith("http") || v.startsWith("data:")) || "",
          modo_negocio: conTexto(conf.modo_negocio, emp.modo_negocio),
          datosTransferencia: conf.datosTransferencia || conf.transferencia || null,
          datosTransferenciaActivo: Boolean(conf.datosTransferenciaActivo || conf.transferenciaActiva || conf.datosTransferencia?.activo || conf.transferencia?.activo),
        }
      }
      const local = armar(empresa, cfg)
      if (vivo && local.razon && local.ruc) {
        setConfigEmisor(local)
        setEmisorListo(true)
        setEmisorCargando(false)
      }
      try {
        const { cargarEmpresaSesion } = await import("@/lib/sesion-cliente")
        empresa = await cargarEmpresaSesion()
      } catch {}
      cfg = {}
      try { cfg = JSON.parse(localStorage.getItem("meijsac_config_pro") || "{}") } catch { cfg = {} }
      const emisor = armar(empresa, cfg)
      if (!vivo) return
      setConfigEmisor(emisor)
      setEmisorListo(Boolean(emisor.razon && emisor.ruc && emisor.regimen))
      setEmisorCargando(false)
      const claves = new Set(
        [emisor.empresaId, localStorage.getItem("empresaId"), localStorage.getItem("empresa_id"), "EMPRESA_001"].filter(Boolean) as string[]
      )
      for (let i = 0; i < localStorage.length; i++) {
        const llave = localStorage.key(i) || ""
        if (llave.startsWith("productos_")) claves.add(llave.slice("productos_".length))
      }
      const locales: any[] = []
      claves.forEach((id) => {
        try { locales.push(...JSON.parse(localStorage.getItem(`productos_${id}`) || "[]")) } catch {}
      })
      let remotos: any[] = []
      try {
        const res = await fetch("/api/productos")
        const data = await res.json()
        if (Array.isArray(data)) remotos = data
      } catch {}
      const normal = (p: any) => {
        const ficha = p?.ficha && typeof p.ficha === "object" ? p.ficha : {}
        return {
          ...ficha,
          ...p,
          codigo: String(p.codigo || ficha.codigo || p.codigoInterno || p.codigo_interno || "").trim(),
          nombre: String(p.nombre || ficha.nombre || p.descripcion || "").trim(),
          codigoAuxiliar: String(ficha.codigoAuxiliar || p.codigoAuxiliar || p.codigoBarras || p.codigo_barras || p.sku || "").trim(),
          codigoBarras: String(p.codigoBarras || p.codigo_barras || ficha.codigoAuxiliar || p.codigoAuxiliar || "").trim(),
          sku: String(p.sku || ficha.sku || ficha.codigoAuxiliar || "").trim(),
          precio: Number(ficha.precioMinorista ?? p.precioMinorista ?? p.precioSinIVA ?? p.precio ?? 0),
          precioMinorista: Number(ficha.precioMinorista ?? p.precioMinorista ?? p.precio ?? 0),
          tipoIvaSRI: ficha.tipoIvaSRI || p.tipoIvaSRI,
          codigoPorcentaje: ficha.codigoPorcentaje || p.codigoPorcentaje,
        }
      }
      const vistos = new Set<string>()
      const lista = [...locales, ...remotos].map(normal).filter((p) => {
        const clave = String(p.codigo || p.id || p.nombre || "").toLowerCase()
        if (!clave || vistos.has(clave)) return false
        vistos.add(clave)
        return true
      })
      console.log("PRODUCTOS CARGADOS:", lista.length, lista[0])
      if (vivo) setProductos(lista)
      try {
        const clientes = await fetch("/api/clientes").then((r) => r.json())
        const cf = Array.isArray(clientes) ? clientes.find((c: any) => String(c.identificacion) === "9999999999999") : null
        if (vivo && cf) {
          setCliente((prev: any) => ({
            ...prev,
            tipoDoc: "07",
            identificacion: "9999999999999",
            razon: cf.razonSocial,
            direccion: cf.direccion || "QUITO",
            email: cf.email || "",
            telefono: cf.telefono || "",
            celular: cf.telefono || "",
            provincia: cf.provincia || "",
            ciudad: cf.ciudad || "",
            tipoCliente: cf.tipoCliente || "",
            regimen: cf.regimen || "",
          }))
        }
      } catch {}
    }
    cargarEmisorFactura()
    return () => { vivo = false }
  },[])


  const [cliente, setCliente] = useState<any>({
    tipoDoc:"07", identificacion:"9999999999999", razon:"CONSUMIDOR FINAL",
    tipold: "",
    direccion:"QUITO",
    email:"",
    telefono: "",
    celular: "",
    provincia: "Pichincha",
    ciudad: "Quito",
    tipoEstablecimiento: "matriz",
    codSucursal: "",
    limiteCredito: 200,
    diasCredito: 30,
    politicaCredito: "REQUISITO" as keyof typeof POLITICAS,
    requisitosEntregados: false
  })
  useEffect(() => { cargarPunto(cliente.codSucursal) }, [cliente.codSucursal])

 const [catalogoRapido, setCatalogoRapido] = useState<any[]>([]);
useEffect(()=>{
  const s = localStorage.getItem('catalogo_rapido_meijsac');
  if(s) try{ setCatalogoRapido(JSON.parse(s)) }catch{}
},[]);
useEffect(()=>{
  localStorage.setItem('catalogo_rapido_meijsac', JSON.stringify(catalogoRapido));
},[catalogoRapido]);

const [busquedaLector, setBusquedaLector] = useState("");
const [sugerencias, setSugerencias] = useState<any[]>([]);

  const [sucursalesFactura, setSucursalesFactura] = useState<any[]>([]);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<any>(null);

    const cargarSucursalesFactura = async (clienteId: string) => {
  try {
    const res = await fetch(`/api/sucursales?clienteId=${clienteId}`);
    const data = await res.json();
    // Quita duplicados por código
    const unicas = Array.from(new Map(data.map((s:any)=>[s.codigo, s])).values());
    setSucursalesFactura(unicas);
    setSucursalSeleccionada(unicas.find((s:any)=>s.esMatriz) || unicas[0]);
  } catch (e) { console.error(e); }
};

  // ESTE VA JUSTO DEBAJO DE CLIENTE
  const manejarBusquedaCliente = async () => {
    const id = cliente.identificacion;
    if(!id) return alert("Pon cédula o RUC");
    
    // 1. Busca primero en tus clientes guardados
    try {
      const local = await fetch(`/api/clientes?q=${id}`).then(r => r.json());
      if(local && local.length > 0){
        setCliente({
          ...cliente,
          razon: local[0].razonSocial || local[0].razon,
          direccion: local[0].direccion,
          email: local[0].email,
          telefono: local[0].telefono,
          tipoId: local[0].tipoId
        });
        return;
      }
    } catch(e){}

    // 2. Si no existe, va al SRI
    setBuscandoSRI(true);
    try {
      const res = await fetch(`/api/sri/buscar-ruc?id=${id}`);
      const json = await res.json();
      if(json.success){
        setCliente((f: any) => ({...f, razon: json.data.razonSocial, direccion: json.data.direccion}));
      } else {
        alert("No encontrado en SRI");
      }
    } catch(e){ alert("Error SRI"); }
    setBuscandoSRI(false);
  }

  const guardarClienteRapido = async () => {
    if(!cliente.razon || cliente.razon === "CONSUMIDOR FINAL") return alert("Busca primero un cliente en SRI");
    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        id: Date.now().toString(),
        tipoId: cliente.tipoId || "05",
        identificacion: cliente.identificacion,
        razonSocial: cliente.razon,
        direccion: cliente.direccion,
        email: cliente.email,
        telefono: cliente.telefono,
        tipoCliente: "NATURAL",
        categoria: "DETALLISTA",
        descuento: 0,
        diasCredito: 0,
        limiteCredito: 0
      })
    });
    const json = await res.json();
    if(json.success){
      alert("✅ Guardado. Ya aparece en dashboard/clientes");
    }
  }

  const [productos, setProductos] = useState<any[]>([])
    const codigoRef = useRef<HTMLInputElement>(null)
  const [codigoRapido, setCodigoRapido] = useState("")
  const [errorLector, setErrorLector] = useState("")
  const [indiceLector, setIndiceLector] = useState(-1)
  const lectorRef = useRef<HTMLInputElement>(null)
  const textoLector = useRef("")
  const busquedaId = useRef(0)
  // --- DETECTOR AUTOMÁTICO DE FERIADOS ECUADOR - SRI CÓDIGO 8 ---
const FERIADOS_ECUADOR = [
  "2025-01-01", "2025-03-03", "2025-03-04", "2025-04-18", "2025-05-01", "2025-05-24",
  "2025-08-10", "2025-10-09", "2025-11-02", "2025-11-03", "2025-12-25",
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-04-03", "2026-05-01", "2026-05-25",
  "2026-08-10", "2026-10-09", "2026-11-02", "2026-11-03", "2026-12-25",
  "2027-01-01", "2027-02-08", "2027-02-09", "2027-03-26", "2027-05-01", "2027-05-24",
];

const [esTurismoFeriado, setEsTurismoFeriado] = useState(false);
const [esDiaFeriadoHoy, setEsDiaFeriadoHoy] = useState(false);
const [anuncioFeriadoCerrado, setAnuncioFeriadoCerrado] = useState(false); 
useEffect(()=>{
  const hoy = new Date().toISOString().slice(0,10); // YYYY-MM-DD
  const esFeriado = FERIADOS_ECUADOR.includes(hoy);
  const esFinde = [0,6].includes(new Date().getDay()); // Domingo o Sábado, por si hay decreto puente
  if(esFeriado){
    setEsDiaFeriadoHoy(true);
    console.log("🏖️ HOY ES FERIADO SRI - Se habilita Código 8 (8%)");
  }
}, []);

const toggleTurismoFeriado = (checked: boolean) => {
  setEsTurismoFeriado(checked);
  setItems((prev: any[]) => prev.map((it:any) => {
    if (checked) {
      if (it.codigoPorcentaje === "4") {
        return { ...it, codigoPorcentaje: "8", tarifa: 8, codigoPorcentajeAnterior: "4" };
      }
    } else {
      if (it.codigoPorcentaje === "8") {
        const codAnterior = it.codigoPorcentajeAnterior || "4";
        return { ...it, codigoPorcentaje: codAnterior, tarifa: CATALOGO_IVA_SRI[codAnterior].tarifa, codigoPorcentajeAnterior: undefined };
      }
    }
    return it;
  }));
};

  const [filtroProd, setFiltroProd] = useState("")
  const [items, setItems] = useState<Item[]>([])
  
  const [pagos, setPagos] = useState({ efectivo:0, redBancaria:0, tarjeta:0, debito:0, compensacion:0, dineroElec:0, prepago:0, endoso:0 } as any)
  const [propinaCheck, setPropinaCheck] = useState(false)
  const [abonos, setAbonos] = useState({ efectivo: 0, transfer: 0, tarjeta: 0, credito: 0 })
  const [tarjetaData, setTarjetaData] = useState({ tipoSRI:"19", forma:"CORRIENTE", plazo:0, franquicia:"Datafast - Visa / Mastercard" })
  const [conteoCaja, setConteoCaja] = useState({ "100":0,"50":0,"20":0,"10":0,"5":0,"1":0,"0.50":0,"0.25":0,"0.10":0,"0.05":0,"0.01":0 } as any)
  const [pagoRealizado, setPagoRealizado] = useState(false)
  const [cajaAbierta, setCajaAbierta] = useState(false)
  const [tipoCobro, setTipoCobro] = useState<'efectivo'|'tarjeta'|'transfer'|'pendiente'|'credito'>('efectivo')
  const [refTarjeta, setRefTarjeta] = useState("")
  const [refTransfer, setRefTransfer] = useState("")
  const [plazoElegido, setPlazoElegido] = useState(30)
  const [formaPendiente, setFormaPendiente] = useState("01 - SIN UTILIZACION DEL SISTEMA FINANCIERO")
  const [plazoCredito, setPlazoCredito] = useState(0)
  const [unidadPlazo, setUnidadPlazo] = useState<"Días" | "Meses">("Días")
  const [cuotasCredito, setCuotasCredito] = useState(0)
  const [valorCredito, setValorCredito] = useState(0)
  const [avisoCredito, setAvisoCredito] = useState("")
  const bufferLector = useRef("")
  const buscarRef = useRef<(texto: string) => void>(() => {})

  useEffect(()=>{ setPlazoElegido(cliente.diasCredito) }, [cliente.diasCredito])

  useEffect(() => { lectorRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return
      if (e.key === "Enter") {
        const code = bufferLector.current.trim()
        bufferLector.current = ""
        if (!code) return
        e.preventDefault()
        buscarRef.current(code)
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) bufferLector.current += e.key
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
      // LIMPIEZA AUTOMATICA CADA VEZ QUE ABRES CAJA
useEffect(()=>{
  if(cajaAbierta){
    setAbonos({ efectivo: 0, transfer: 0, tarjeta: 0, credito: 0 })
    setConteoCaja({ "100":0,"50":0,"20":0,"10":0,"5":0,"1":0,"0.50":0,"0.25":0,"0.10":0,"0.05":0,"0.01":0 })
    setRefTarjeta("")
    setRefTransfer("")
    setTipoCobro('efectivo')
  }
},[cajaAbierta])

    useEffect(()=>{
          const tema = localStorage.getItem("meijsac_factura_tema")
    if(tema) setIsDark(tema === "dark")
    const transito = localStorage.getItem("meijsac_transito_factura")
    if(transito){
      try{
        const data = JSON.parse(transito)
        const itemsRestaurante: Item[] = data.items.map((it:any, idx:number)=>({
  codigo: `REST-${Date.now()}-${idx}`,
  descripcion: it.descripcion,
  detalle: it.descripcion,
  cant: it.cantidad || 1,
  pUnit: it.precio,
  descPorc: 0,
  codigoPorcentaje: "4", // ANTES tenias 2, AHORA 4 = 15% VIGENTE según Tabla 17
  iva: 15,
  ice: 0,
  esPlastico: false,
  tarifas: { min:0, may:0, dist:0 }
}))
        setItems(itemsRestaurante)
        setCliente((prev:any)=>({...prev, razon: data.cliente?.nombre || data.origen || `MESA ${data.mesaOrigenId||''} - CONSUMIDOR FINAL`, tipoDoc: "07", identificacion: data.cliente?.ruc || "9999999999999" }))
        // No borramos el transito aqui, se borra despues de AUTORIZAR en emitirComprobante
      } catch(e){ console.error("Error transito", e) }
    }
  },[])

    const toggleTema = ()=>{
    const nuevo = !isDark
    setIsDark(nuevo)
    localStorage.setItem("meijsac_factura_tema", nuevo ? "dark" : "light")
  }

const manejarConsultaSRIExpress = async () => {
  const identificacion = cliente.identificacion.trim();
  if (identificacion.length !== 10 && identificacion.length !== 13) {
    alert('Por favor, ingresa una cédula (10 dígitos) o RUC (13 dígitos) válido.');
    return;
  }
  setBuscandoSRI(true);
  try {
    const response = await fetch(`/api/sri/consulta-ciudadano?id=${identificacion}`, { 
      cache: "no-store" 
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'No se encontraron datos');
    }
    setCliente((prev: any) => ({
      ...prev,
      razon: result.data.razonSocial,
      direccion: result.data.direccion,
    }));
    console.log('Datos cargados:', result.data);
  } catch (error: any) {
    console.error('Error SRI:', error);
    alert(error.message);
  } finally {
    setBuscandoSRI(false);
  }
};

  const guardarNuevoCliente = ()=>{
    if(!nuevoCliForm.identificacion || !nuevoCliForm.razon){ alert("Cédula y Razón obligatorios"); return }
    const guardados = JSON.parse(localStorage.getItem("meijsac_clientes")||"[]")
    localStorage.setItem("meijsac_clientes", JSON.stringify([...guardados, {...nuevoCliForm, id:Date.now()}]))
    setCliente({...cliente, identificacion:nuevoCliForm.identificacion, razon:nuevoCliForm.razon, direccion:nuevoCliForm.direccion||"TENA"})
    setShowNuevoCliente(false)
    setNuevoCliForm({ razon:"", identificacion:"", direccion:"", email:"", telefono:"" })
  }
  
  const tarifaProducto = (p:any) => {
    const t = String(p?.tipoIvaSRI ?? p?.codigoPorcentaje ?? "").trim().toUpperCase()
    if (t === "15%" || t === "15" || t === "4") return { codigoPorcentaje: "4", tarifa: 15 }
    if (t === "0%" || t === "0") return { codigoPorcentaje: "0", tarifa: 0 }
    if (t === "EXENTO" || t === "7") return { codigoPorcentaje: "7", tarifa: 0 }
    if (t === "NO_OBJETO" || t === "NO OBJETO" || t === "6") return { codigoPorcentaje: "6", tarifa: 0 }
    return null
  }
  const addProducto = (p:any) => {
  const tarifa = tarifaProducto(p)
  if (!tarifa) return alert(`"${p?.nombre || p?.codigo || "Producto"}" no tiene tarifa IVA en Inventario. No se agrega a la factura.`)
  const precio = Number(p.precioMinorista ?? p.precio ?? p.precioSinIVA)
  if (!Number.isFinite(precio)) return alert(`"${p?.nombre || p?.codigo}" no tiene precio.`)
  const idx = items.findIndex(i=>i.codigo===p.codigo || i.codigo===p.codigoBarras)
  if(idx>=0){
    const n=[...items]; n[idx].cant+=1; setItems(n)
  } else {
    setItems([...items, {
      codigo:p.codigo, descripcion:p.nombre || p.descripcion, detalle:"", detalleAdicional:p.detalle || "", cant:1, pUnit:precio, descPorc:Number(p.descuento)||0, descDolar:0,
      codigoPorcentaje:tarifa.codigoPorcentaje, tarifa:tarifa.tarifa, iva:tarifa.tarifa, ice:Number(p.porcIce)||0, esPlastico:false,
      tarifas:{min:precio, may:Number(p.precioMayorista ?? p.precioMay ?? precio), dist:Number(p.precioDistribuidor ?? p.precioDist ?? precio)}
    }])
  }
  // --- CATALOGO RAPIDO: ultimos usados ---
  setCatalogoRapido(prev=>{
    const sinDup = prev.filter((x:any)=>x.codigo!==p.codigo);
    return [p, ...sinDup].slice(0,12);
  });
}
    const enfocarLector = () => {
      requestAnimationFrame(() => lectorRef.current?.focus())
    }
    const agregarDesdeLector = (p: any) => {
      addProducto(p)
      textoLector.current = ""
      setCodigoRapido("")
      setSugerencias([])
      setIndiceLector(-1)
      setErrorLector("")
      if (navigator.vibrate) navigator.vibrate(50)
      enfocarLector()
    }
    const buscarYAgregarPorCodigoTexto = async (texto: string, desdeBoton = false) => {
      const escrito = texto.trim()
      if (!escrito) { enfocarLector(); return }
      const lista = await buscarProductosEnBase(escrito)
      const exacto = productoExacto(lista, escrito)
      const elegido = indiceLector >= 0 ? sugerencias.find((p: any) => lista.some((x) => x.codigo === p.codigo)) : null
      if (exacto) { agregarDesdeLector(exacto); return }
      if (elegido && (desdeBoton || true)) { agregarDesdeLector(elegido); return }
      if (lista.length === 1) { agregarDesdeLector(lista[0]); return }
      setSugerencias(lista.slice(0, 8))
      setErrorLector(lista.length ? "" : "No encontrado")
      enfocarLector()
    }
    buscarRef.current = (texto: string) => { void buscarYAgregarPorCodigoTexto(texto, false) }
  
  const addVacio = () => setItems([...items, {codigo:"", descripcion:"", detalle:"", detalleAdicional:"", cant:1, pUnit:0, descPorc:0, descDolar:0, codigoPorcentaje:"4", tarifa:15, iva:15, ice:0, esPlastico:false }])
  // CATÁLOGO TABLA 17 SRI - TARIFAS IVA OFFLINE
const CATALOGO_IVA_SRI: any = {
  "0":  { tarifa: 0,  label: "0% - 0% Canasta Básica / Medicina / Export",  sri: "0%" },
  "2":  { tarifa: 12, label: "12% - 12% Histórico (Compatibilidad)",        sri: "12%" },
  "3":  { tarifa: 14, label: "14% - 14% Histórico Terremoto 2016",         sri: "14%" },
  "4":  { tarifa: 15, label: "15% - 15% General Vigente - Conflicto Interno", sri: "15%" },
  "5":  { tarifa: 5,  label: "5% - 5% Materiales Construcción",             sri: "5%" },
  "6":  { tarifa: 0,  label: "6 - No Objeto de Impuesto",                   sri: "0% - No Objeto" },
  "7":  { tarifa: 0,  label: "7 - Exento de IVA",                           sri: "0% - Exento" },
  "8":  { tarifa: 8,  label: "8% - 8% Turismo Feriados Decreto Presidencia", sri: "8%" },
  "10": { tarifa: 13, label: "13% - 13% Catálogo Técnico Previo",           sri: "13%" },
}

  const bruto = items.reduce((s,i)=>s+i.cant*i.pUnit,0)
  const descuento = items.reduce((s,i)=>s+(i.cant*i.pUnit*i.descPorc/100),0)
  const subtotalSin = bruto - descuento

  const codigoIva = (i: any) => String(i.codigoPorcentaje ?? "")
  const base15 = items.filter(i=>codigoIva(i)==="4").reduce((s,i)=>s+(i.cant*i.pUnit)*(1-i.descPorc/100),0)
const base0 = items.filter(i=>codigoIva(i)==="0").reduce((s,i)=>s+(i.cant*i.pUnit)*(1-i.descPorc/100),0)
const baseNoObjeto = items.filter(i=>codigoIva(i)==="6").reduce((s,i)=>s+(i.cant*i.pUnit)*(1-i.descPorc/100),0)
const baseExento = items.filter(i=>codigoIva(i)==="7").reduce((s,i)=>s+(i.cant*i.pUnit)*(1-i.descPorc/100),0)
const baseDiferenciado = items.filter(i=>["10","5","8","2","3"].includes(codigoIva(i))).reduce((s,i)=>s+(i.cant*i.pUnit)*(1-i.descPorc/100),0)
const base5 = items.filter(i=>codigoIva(i)==="5").reduce((s,i)=>s+(i.cant*i.pUnit)*(1-i.descPorc/100),0)
const base8 = items.filter(i=>codigoIva(i)==="8").reduce((s,i)=>s+(i.cant*i.pUnit)*(1-i.descPorc/100),0)
const itemSinTarifa = items.some(i => !["0","2","3","4","5","6","7","8","10"].includes(codigoIva(i)))

const valorICE = items.reduce((s,i)=>s+i.ice,0) || 0
const valorIRBPNR = items.filter(i=>i.esPlastico).reduce((s,i)=>s+(i.cant*0.02),0) || 0
const iva15 = base15*0.15
const iva5 = base5*0.05
const iva8 = base8*0.08
const ivaDiferenciado = iva5 + iva8 // + otros si usas 12%,13%,14%
const propina = propinaCheck? subtotalSin*0.10 : 0
const total = subtotalSin + iva15 + ivaDiferenciado + valorICE + valorIRBPNR + propina
  const avisoConsumidorFinal = "Según la norma del SRI, no se permite emitir facturas a Consumidor Final por valores iguales o superiores a $50.00"
  const bloqueoConsumidorFinal = String(cliente.identificacion || "").trim() === "9999999999999" && total >= 50

  const plata = (valor: unknown) => {
    const n = Number(valor)
    if (!Number.isFinite(n)) {
      console.error("Valor NaN en factura", valor)
      return 0
    }
    return n < 0 ? 0 : n
  }
  const sumaOtrosPagos = plata(pagos.redBancaria) + plata(pagos.tarjeta) + plata(pagos.debito) + plata(pagos.compensacion) + plata(pagos.dineroElec) + plata(pagos.prepago) + plata(pagos.endoso)
  let efectivoCalculado = plata(total) - sumaOtrosPagos
  if (!Number.isFinite(efectivoCalculado)) {
    console.error("01 NaN", { total, sumaOtrosPagos })
    efectivoCalculado = 0
  }
  if (efectivoCalculado < 0) efectivoCalculado = 0
  const pagosReales = {...pagos, redBancaria: plata(pagos.redBancaria), tarjeta: plata(pagos.tarjeta), debito: plata(pagos.debito), compensacion: plata(pagos.compensacion), dineroElec: plata(pagos.dineroElec), prepago: plata(pagos.prepago), endoso: plata(pagos.endoso), efectivo: efectivoCalculado}
  const guardarMonto = (campo: string, texto: string) => {
    const n = Number(texto)
    if (!Number.isFinite(n)) console.error("Pago NaN", campo, texto)
    setPagos((prev: any) => ({ ...prev, [campo]: Number.isFinite(n) && n > 0 ? n : 0 }))
  }
  const totalPagado = pagosReales.efectivo + sumaOtrosPagos
  const vuelto = totalPagado - total
  const saldoPendiente = total - totalPagado

  const totalEfectivoEntregado = Object.entries(conteoCaja).reduce((acc:number,[billete,cant]:any)=> acc + (parseFloat(billete)*Number(cant||0)), 0)
  const vueltoReal = totalEfectivoEntregado - total

  const puedeConfirmar = () => {
    if(tipoCobro==='efectivo') return totalEfectivoEntregado >= total && total>0
    if(tipoCobro==='tarjeta') return refTarjeta.trim().length >= 3
    if(tipoCobro==='transfer') return refTransfer.trim().length >= 3
    if(tipoCobro==='pendiente') return total > 0
    if(tipoCobro==='credito') return total > 0 && plazoCredito > 0 && cuotasCredito >= 1
    return false
  }

  const fechaVencimientoCredito = () => {
    const fecha = new Date()
    if (unidadPlazo === "Meses") fecha.setMonth(fecha.getMonth() + plazoCredito)
    else fecha.setDate(fecha.getDate() + plazoCredito)
    return fecha
  }

  // === NUEVO - CLAVE 49 DIGITOS MODULO 11 ===
  const getModulo11 = (clave48:string)=>{
    let factor=2, suma=0
    for(let i=clave48.length-1;i>=0;i--){ suma+=parseInt(clave48[i])*factor; factor=factor===7?2:factor+1 }
    const mod = 11 - (suma % 11)
    if(mod===11) return 0
    if(mod===10) return 1
    return mod
  }
  const getClaveAcceso = ()=>{
    const ddmmyyyy = new Date().toLocaleDateString('es-EC').replace(/\//g,"").padStart(8,"0")
    const tipoComp = "01"
    const ruc = configEmisor.ruc || ""
    const amb = puntoEmision.ambiente
    const establecimiento = puntoEmision.serie
    const serie = establecimiento.replace("-","")+puntoEmision.secuencial.padStart(9,"0")
    const codigoNum = "12345678"
    const tipoEmision = "1"
    const clave48 = `${ddmmyyyy}${tipoComp}${ruc}${amb}${serie}${codigoNum}${tipoEmision}`
    const dv = getModulo11(clave48)
    return `${clave48}${dv}`
  }

    const guardarComoBorrador = async () => {
    if (!emisorListo) return alert("Faltan datos del emisor en Configuración")
    if (itemSinTarifa) return alert("Hay un producto sin tarifa IVA. No se puede guardar.")
    if(items.length===0){ alert("Agrega productos"); return }
    const hoy = new Date()
    const borrador = {
      id: `borr-${Date.now()}`,
      secuencial: `BORR-${Date.now().toString().slice(-6)}`,
      receptorNombre: cliente.razon,
      receptorIdentificacion: cliente.identificacion,
      items: items,
      valorTotal: total,
      total: total,
      fechaCreacion: hoy.toISOString(),
      fechaEmision: hoy.toLocaleDateString('es-EC'),
      estadoSRI: 'BORRADOR'
    }
    const actuales = JSON.parse(localStorage.getItem("meijsac_borradores_facturas")||"[]")
    const completo = { ...borrador, configEmisor, cliente, items, totales: { bruto, descuento, subtotalSin, base15, base0, baseNoObjeto, baseExento, baseDiferenciado, valorICE, valorIRBPNR, iva15, ivaDiferenciado, propina, total } }
    localStorage.setItem("meijsac_borradores_facturas", JSON.stringify([...actuales, completo]))
    try {
      await fetch("/api/facturas", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("meijsac_token") || ""}` }, body: JSON.stringify(completo) })
    } catch {}
    window.location.href = "/dashboard/comprobantes/emitidos"
  }
  
  
  const emitirComprobante = async () => {
    if (!puntoEmision.serie || !puntoEmision.secuencial) return alert("Configura el punto de emisión en Configuración. No hay un secuencial fijo.")
    if (bloqueoConsumidorFinal) return alert(avisoConsumidorFinal)
    if (!emisorListo) return alert("Faltan datos del emisor en Configuración")
    if (itemSinTarifa) return alert("Hay un producto sin tarifa IVA. No se puede emitir.")
    if(!pagoRealizado) return alert("Primero cobra en CAJA")
    if (tipoCobro === "credito" && (!(plazoCredito > 0) || !(cuotasCredito >= 1))) return alert("Para crédito debes poner plazo y cuotas")
    const venta = window.open("", "_blank")
    try {
      venta?.document.write("<p style=\"font-family:Arial,sans-serif;padding:24px\">Generando el comprobante…</p>")
      venta?.document.close()
    } catch {}
    const { emisionBloqueada, rucLocal } = await import("@/lib/plan-cliente")
    const avisoPlan = await emisionBloqueada(configEmisor?.ruc || rucLocal())
    if (avisoPlan) { venta?.close(); return alert(avisoPlan) }
    if (!Number.isFinite(total)) { venta?.close(); return alert("No se puede emitir: faltan valores de la factura que no se pueden calcular.") }
    const sinCobro = tipoCobro === "pendiente" || tipoCobro === "credito"
    const netoEmit = sinCobro ? 0 : (Number.isFinite(Number(pagosReales.efectivo)) ? Number(pagosReales.efectivo) : 0)
    const entregadoCaja = Number(abonos.efectivo || 0) + Number(abonos.transfer || 0) + Number(abonos.tarjeta || 0)
    const vueltoEmit = sinCobro ? 0 : (entregadoCaja > total + 0.009 ? Math.round((entregadoCaja - total) * 100) / 100 : 0)
    const entregadoEmit = sinCobro ? 0 : (entregadoCaja > 0 ? Math.round(entregadoCaja * 100) / 100 : total)
    const formasEmit: string[] = []
    const anotarForma = (codigo: string, nombre: string, monto: unknown) => {
      const n = Number(monto)
      if (Number.isFinite(n) && n > 0) formasEmit.push(`${codigo} - ${nombre}`)
    }
    const efectivoRecibido = sinCobro ? 0 : Number(abonos.efectivo || 0)
    const tarjetaRecibida = sinCobro ? 0 : Number(abonos.tarjeta || 0)
    const transferenciaRecibida = sinCobro ? 0 : Number(abonos.transfer || 0)
    const debitoRecibido = tarjetaData.tipoSRI === "16" ? tarjetaRecibida : plata(pagos.debito)
    const creditoRecibido = tarjetaData.tipoSRI === "16" ? plata(pagos.tarjeta) : (tarjetaRecibida || plata(pagos.tarjeta))
    const efectivoNeto = Math.max(0, Math.round((efectivoRecibido - (sinCobro ? 0 : vueltoEmit)) * 100) / 100)
    anotarForma("01", "SIN UTILIZACION DEL SISTEMA FINANCIERO", efectivoNeto)
    anotarForma("15", "COMPENSACION DE DEUDAS", pagosReales.compensacion)
    anotarForma("16", "TARJETA DE DEBITO", debitoRecibido)
    anotarForma("17", "DINERO ELECTRONICO", pagosReales.dineroElec)
    anotarForma("18", "TARJETA PREPAGO", pagosReales.prepago)
    anotarForma("19", "TARJETA DE CREDITO", creditoRecibido)
    anotarForma("20", "OTROS CON UTILIZACION DEL SISTEMA FINANCIERO", transferenciaRecibida || pagosReales.redBancaria)
    anotarForma("21", "ENDOSO DE TITULOS", pagosReales.endoso)
    const venceCredito = tipoCobro === "credito" ? fechaVencimientoCredito() : null
    const formaPagoEmit = tipoCobro === "pendiente"
      ? formaPendiente
      : tipoCobro === "credito"
        ? "20 - OTROS CON UTILIZACION DEL SISTEMA FINANCIERO"
        : (formasEmit.length ? `${formasEmit.join(" | ")}${vueltoEmit > 0 ? ` | Vuelto $${vueltoEmit.toFixed(2)}` : ""}` : "01 - SIN UTILIZACION DEL SISTEMA FINANCIERO")
    const tipoCobroGuardado = tipoCobro === "pendiente" ? "PENDIENTE_DE_PAGO" : tipoCobro === "credito" ? "CREDITO" : tipoCobro === "tarjeta" ? "TARJETA" : tipoCobro === "transfer" ? "TRANSF" : "EFECTIVO"
    const estadoPagoGuardado = tipoCobro === "pendiente" ? "PENDIENTE DE PAGO" : tipoCobro === "credito" ? "PENDIENTE DE PAGO - CRÉDITO" : "PAGADO"
    console.log('Generando XML con pagos:', pagosReales, ' refs:', refTarjeta, refTransfer)

    // --- CORRECCIÓN 1: CLAVE 49 + DV MODULO 11 - FICHA TÉCNICA SRI ---
    const clave = getClaveAcceso()

    // --- INICIO PARCHE RETORNO AUTOMATICO + SPLIT ---
    const transitoActual = JSON.parse(localStorage.getItem("meijsac_transito_factura")||"{}")
    const poolRaw = localStorage.getItem("meijsac_split_pool")

    // --- CORRECCIÓN 2: EMPAQUETA TODO PARA LOS 3 DESTINOS ---
    let modoNegocio = "GENERAL"
    try {
      const cfg = JSON.parse(localStorage.getItem("meijsac_config") || "{}")
      const rest = JSON.parse(localStorage.getItem("meijsac_config_restaurante") || "{}")
      const empresaLocal = JSON.parse(localStorage.getItem("meijsac_empresa") || "{}")
      const marca = cfg.tipoNegocio || rest.tipoNegocio || empresaLocal.modo_negocio || configEmisor?.modo_negocio
      if (marca === "restaurante" || marca === "RESTAURANTE") modoNegocio = "RESTAURANTE"
    } catch {}
    let mesaNombre = ""
    try {
      const mesas = JSON.parse(localStorage.getItem("meijsac_restaurante_mesas") || "[]")
      const mesa = mesas.find((m: any) => m.id === transitoActual?.mesaOrigenId)
      mesaNombre = mesa?.nombre || transitoActual?.mesaNombre || ""
    } catch {}
    const clienteFactura = normalizarComprador(cliente)
    if (clienteFactura !== cliente) setCliente(clienteFactura)
    const facturaPendiente: any = {
      id: Date.now(),
      claveAcceso: clave,
      fechaEmision: new Date().toISOString(),
      fechaEmisionFormato: fecha,
      establecimiento: puntoEmision.serie,
      tipoEstablecimiento: cliente.tipoEstablecimiento === "sucursal" ? "sucursal" : "matriz",
      secuencial: puntoEmision.secuencial,
      ultimoSecuencial: puntoEmision.ultimo,
      configEmisor: configEmisor,
      cliente: clienteFactura,
      items: items,
      totales: { bruto, descuento, subtotalSin, base15, base0, baseNoObjeto, baseExento, baseDiferenciado, valorICE, valorIRBPNR, iva15, ivaDiferenciado, propina, total },
      formaPago: formaPagoEmit,
      tipo_cobro: tipoCobroGuardado,
      estado_pago: estadoPagoGuardado,
      plazo: tipoCobro === "credito" ? plazoCredito : null,
      unidad_plazo: tipoCobro === "credito" ? unidadPlazo : null,
      cuotas: tipoCobro === "credito" ? cuotasCredito : null,
      fecha_vencimiento: venceCredito ? venceCredito.toISOString() : null,
      valor_credito: tipoCobro === "credito" ? (valorCredito > 0 ? valorCredito : total) : 0,
      saldo_pendiente: sinCobro ? total : 0,
      montoEntregado: entregadoEmit,
      efectivoRecibido: entregadoEmit,
      vuelto: vueltoEmit,
      caja: { efectivo: sinCobro ? 0 : Number(abonos.efectivo || 0), transfer: sinCobro ? 0 : Number(abonos.transfer || 0), tarjeta: sinCobro ? 0 : Number(abonos.tarjeta || 0), credito: 0 },
      formasPago: [
        { codigo: "01", nombre: "SIN UTILIZACION DEL SISTEMA FINANCIERO", monto: efectivoNeto },
        { codigo: "15", nombre: "COMPENSACION DE DEUDAS", monto: plata(pagosReales.compensacion) },
        { codigo: "16", nombre: "TARJETA DE DEBITO", monto: plata(debitoRecibido) },
        { codigo: "17", nombre: "DINERO ELECTRONICO", monto: plata(pagosReales.dineroElec) },
        { codigo: "18", nombre: "TARJETA PREPAGO", monto: plata(pagosReales.prepago) },
        { codigo: "19", nombre: "TARJETA DE CREDITO", monto: plata(creditoRecibido) },
        { codigo: "20", nombre: "OTROS CON UTILIZACION DEL SISTEMA FINANCIERO", monto: plata(transferenciaRecibida || pagosReales.redBancaria) },
        { codigo: "21", nombre: "ENDOSO DE TITULOS", monto: plata(pagosReales.endoso) },
      ].filter((f) => f.monto > 0),
      pagos: { ...pagosReales, efectivo: efectivoRecibido, debito: plata(debitoRecibido), tarjeta: plata(creditoRecibido), redBancaria: plata(transferenciaRecibida || pagosReales.redBancaria), cambio: vueltoEmit, vuelto: vueltoEmit, entregado: entregadoEmit, efectivoRecibido, formaPago: formaPagoEmit },
      refs: { refTarjeta, refTransfer, tipoCobro, plazoElegido },
      transito: transitoActual,
      mesaOrigenId: transitoActual?.mesaOrigenId || null,
      mesaNombre,
      modo_negocio: modoNegocio
    }

    if(poolRaw){
      const pool = JSON.parse(poolRaw)
      const actualizado = pool.map((p:any)=> p.id===transitoActual.id? {...p, estado:"FACTURADA"} : p)
      localStorage.setItem("meijsac_split_pool", JSON.stringify(actualizado))
      const quedan = actualizado.filter((p:any)=> p.estado==="PENDIENTE")

            if(quedan.length===0){
        facturaPendiente.mesaOrigenId = transitoActual.mesaOrigenId
        facturaPendiente.esUltimaParte = true
        localStorage.setItem("meijsac_ultima_factura_pendiente", JSON.stringify(facturaPendiente))

        // --- SUCIA - ULTIMA PARTE PAGADA ---
        try{
          const mesas = JSON.parse(localStorage.getItem("meijsac_restaurante_mesas")||"[]")
          const nuevas = mesas.map((m:any)=> m.id===transitoActual.mesaOrigenId? {...m, estado:"SUCIA", tiempo:0, items:[]} : m)
          localStorage.setItem("meijsac_restaurante_mesas", JSON.stringify(nuevas))
        }catch(e){}
        localStorage.removeItem("meijsac_transito_factura")
        localStorage.removeItem("meijsac_split_pool")

      } else {
        facturaPendiente.mesaOrigenId = transitoActual.mesaOrigenId
        facturaPendiente.parte = transitoActual.numero
        facturaPendiente.quedan = quedan.length
        facturaPendiente.siguienteTransito = quedan[0]
        localStorage.setItem("meijsac_ultima_factura_pendiente", JSON.stringify(facturaPendiente))
        // NO ponemos SUCIA aqui porque aun quedan cuentas por cobrar
      }
    } else {
    // Flujo normal sin split
    if(transitoActual?.mesaOrigenId){
        facturaPendiente.mesaOrigenId = transitoActual.mesaOrigenId
        facturaPendiente.totalPartes = transitoActual.totalPartes || 1
        facturaPendiente.numero = transitoActual.numero || 1
    }
    localStorage.setItem("meijsac_ultima_factura_pendiente", JSON.stringify(facturaPendiente))

    // --- SUCIA - FLUJO NORMAL ---
    try{
      if(transitoActual?.mesaOrigenId){
        const mesas = JSON.parse(localStorage.getItem("meijsac_restaurante_mesas")||"[]")
        const nuevas = mesas.map((m:any)=> m.id===transitoActual.mesaOrigenId? {...m, estado:"SUCIA", tiempo:0, items:[]} : m)
        localStorage.setItem("meijsac_restaurante_mesas", JSON.stringify(nuevas))
      }
    }catch(e){}
    localStorage.removeItem("meijsac_transito_factura")
    }

    const serieAhora = puntoEmision.serie
    const secAhora = puntoEmision.secuencial
    facturaPendiente.establecimiento = serieAhora
    facturaPendiente.secuencial = secAhora
    guardarSecuencialUsado(serieAhora, secAhora)
    cargarPunto(cliente.codSucursal)
    try {
      const guardado = await fetch("/api/facturar", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("meijsac_token") || ""}` }, body: JSON.stringify({ ...facturaPendiente, estadoSRI: "PENDIENTE", diferirSri: true }) })
      const guardada = await guardado.json().catch(() => ({}))
      if (!guardado.ok) {
        const faltan = Array.isArray(guardada.faltantes) ? `\n${guardada.faltantes.join("\n")}` : ""
        venta?.close()
        alert((guardada.error || "No se pudo guardar la factura en la base.") + faltan)
        cargarPunto()
        return
      }
      const serieUsada = guardada.establecimiento || puntoEmision.serie
      const secUsado = guardada.secuencial || puntoEmision.secuencial
      facturaPendiente.establecimiento = serieUsada
      facturaPendiente.secuencial = secUsado
      facturaPendiente.facturaId = guardada.id
      if (guardada.claveAcceso) facturaPendiente.claveAcceso = guardada.claveAcceso
      if (guardada.xml) facturaPendiente.xmlContent = guardada.xml
      const estadoVisible = guardada.fechaAutorizacion ? "AUTORIZADO" : (guardada.estado === "RECHAZADO" || String(guardada.estadoRecepcion || "").includes("DEVUELT") ? "RECHAZADO" : "PENDIENTE")
      facturaPendiente.estado = estadoVisible
      facturaPendiente.estadoSRI = estadoVisible
      facturaPendiente.firmado = Boolean(guardada.firmado)
      facturaPendiente.numeroAutorizacion = guardada.numeroAutorizacion || ""
      facturaPendiente.fechaAutorizacion = guardada.fechaAutorizacion || ""
      facturaPendiente.mensajeSri = guardada.mensaje || ""
      facturaPendiente.mensajesSri = guardada.mensajes || []
      const listaDoc = {
        id: guardada.id || facturaPendiente.id,
        facturaId: guardada.id,
        tipoComprobante: "01",
        secuencial: `${serieUsada}-${secUsado}`,
        claveAcceso: facturaPendiente.claveAcceso,
        fechaEmision: facturaPendiente.fechaEmisionFormato,
        receptorIdentificacion: facturaPendiente.cliente?.identificacion,
        receptorNombre: facturaPendiente.cliente?.razon,
        valorTotal: facturaPendiente.totales?.total,
        estadoSRI: estadoVisible,
        fechaAutorizacion: guardada.fechaAutorizacion || "",
        numeroAutorizacion: guardada.numeroAutorizacion || "",
        mensajeSri: guardada.mensaje || "",
        estadoRecepcion: guardada.estadoRecepcion || "",
        xmlContent: facturaPendiente.xmlContent || "",
        tipo_cobro: facturaPendiente.tipo_cobro,
        estado_pago: facturaPendiente.estado_pago,
        plazo: facturaPendiente.plazo,
        unidad_plazo: facturaPendiente.unidad_plazo,
        cuotas: facturaPendiente.cuotas,
        fecha_vencimiento: facturaPendiente.fecha_vencimiento,
      }
      ;["meijsac_comprobantes_emitidos", "meijsac_documentos_emitidos", "meijsac_enviados_sri"].forEach((clave) => {
        const previa = JSON.parse(localStorage.getItem(clave) || "[]")
        localStorage.setItem(clave, JSON.stringify([...previa, listaDoc]))
      })
      try {
        const cfg = JSON.parse(localStorage.getItem("meijsac_config_pro") || "{}")
        const lista = Array.isArray(cfg.secuenciales) ? cfg.secuenciales : []
        const [estab, pto] = String(serieUsada).split("-")
        const i = lista.findIndex((s: any) => String(s?.estab || "").padStart(3, "0").slice(-3) === estab && String(s?.pto || "").padStart(3, "0").slice(-3) === pto)
        if (i < 0) lista.push({ estab, pto, codigo: "01", tipo: "01 FACTURA", ultimo: secUsado, estado: "ACTIVO" })
        else lista[i] = { ...lista[i], ultimo: secUsado, estado: lista[i].estado || "ACTIVO" }
        cfg.secuenciales = lista
        localStorage.setItem("meijsac_config_pro", JSON.stringify(cfg))
      } catch {}
      cargarPunto()
      localStorage.setItem("meijsac_ultima_factura_pendiente", JSON.stringify(facturaPendiente))
      const claveRide = String(guardada.claveAcceso || facturaPendiente.claveAcceso || "").replace(/\D/g, "")
      const urlRide = `/dashboard/factura-xml/visor/${claveRide}`
      if (claveRide.length === 49) {
        if (venta) venta.location.href = urlRide
        else window.open(urlRide, "_blank")
      } else {
        venta?.close()
        alert("No se pudo obtener la clave de acceso del comprobante.")
      }
    } catch {
      venta?.close()
      alert("No se pudo guardar la factura en la base.")
      return
    }
  }
      const buscarEnClientesDB = async () => {
    if (!cliente.identificacion) return alert("Pon RUC/Cédula");
    const empresaId = localStorage.getItem("empresaId") || localStorage.getItem("empresa_id") || "meijsac-default";
    try {
      const rucLimpio = cliente.identificacion.trim().replace(/\D/g, ""); // solo números
      const ruc10 = rucLimpio.substring(0, 10); // cédula sin 001

      let res = await fetch(`/api/clientes?empresaId=${empresaId}&q=${rucLimpio}`);
      let data = await res.json();
      
      // Si no encuentra con 13 dígitos, prueba con 10
      if (!Array.isArray(data) || data.length === 0) {
        console.log("No con 13, probando con 10:", ruc10);
        res = await fetch(`/api/clientes?empresaId=${empresaId}&q=${ruc10}`);
        data = await res.json();
      }

      console.log("Clientes encontrados:", data);

      if (Array.isArray(data) && data.length > 0) {
        // Búsqueda flexible, no exacta
        const c = data.find((x:any) => 
          x.identificacion?.includes(rucLimpio) || 
          rucLimpio.includes(x.identificacion) ||
          x.identificacion?.includes(ruc10)
        ) || data[0];

        const idCliente = String(c.identificacion || "").replace(/\D/g, "")
        const tipoCliente = idCliente === "9999999999999" || /^9{13,}$/.test(idCliente) ? "07" : idCliente.length === 13 ? "04" : idCliente.length === 10 ? "05" : (c.tipoId || "06")
        setCliente((f:any) => ({
          ...f,
          tipoDoc: tipoCliente,
          identificacion: tipoCliente === "07" ? "9999999999999" : idCliente,
          razon: tipoCliente === "07" ? "CONSUMIDOR FINAL" : c.razonSocial,
          direccion: c.direccion || (String(c.identificacion) === "9999999999999" ? "QUITO" : ""),
          provincia: c.provincia || "",
          ciudad: c.ciudad || "",
          email: c.email || "",
          telefono: c.telefono || "",
          celular: c.telefono || "",
          tipoCliente: c.tipoCliente || "",
          regimen: c.regimen || "",
        }));

        // NUEVO - Carga sucursales de ese cliente
        if(c.id) {
          console.log("Cargando sucursales para:", c.id);
          await cargarSucursalesFactura(c.id);
        }
      } else {
        alert("No está en DB, buscando en SRI...");
        manejarConsultaSRIExpress();
      }
    } catch (e) {
      console.error(e);
      alert("Error DB");
    }
  };

  return (
   
  <div className={`min-h-screen p-4 ${isDark ? "bg-[#080a0f] text-white" : "bg-[#f1f5f9] text-slate-900"}`}>
    {/* PEGALO AQUÍ ARRIBA DE TODO */}
    <div className="max-w-7xl mx-auto flex gap-2 mb-4 print:hidden">
      <a href="/dashboard/restaurante" className="bg-[#1e293b] border border-white/10 px-4 py-2 rounded-full text-[11px] font-bold">← Volver a Restaurante</a>
      <a href="/dashboard" className="bg-white text-black px-4 py-2 rounded-full text-[11px] font-black">← MEIJSAC POS</a><button onClick={toggleTema} className="bg-white text-black px-3 py-2 rounded-full text-[10px] font-black ml-auto">{isDark?"☀️ CLARO":"🌙 OSCURO"}</button>
    </div>

    {/* TU CÓDIGO ORIGINAL SIGUE ABAJO */}
      
      <div className="flex justify-between bg-[#1e293b] p-3 rounded-xl mb-3 border border-white/10">
        <div className="font-black">
          <div className="flex items-center gap-2">Emisión de Facturas Electrónicas {configEmisor.logo ? <img src={configEmisor.logo} alt="" className="h-8 w-8 object-contain rounded" /> : null}</div>
          {emisorCargando ? (
            <div className="mt-2 text-sm font-bold text-white/40">Cargando datos del emisor...</div>
          ) : emisorListo ? (
            <div className="mt-1 text-[10px] font-bold text-white/80 leading-4">
              <div>{configEmisor.razon} · RUC {configEmisor.ruc}</div>
              <div>Matriz: {configEmisor.matriz || "—"} · Sucursal: {configEmisor.sucursal || "—"}</div>
              <div>Obligado a llevar contabilidad: {configEmisor.obligado || "—"} · Régimen: {configEmisor.regimen} · Ambiente: {configEmisor.ambiente || "—"}</div>
              {cliente.tipoCliente || cliente.regimen ? <div>Cliente: {cliente.razon} · {cliente.tipoCliente || ""} {cliente.regimen || ""}</div> : null}
            </div>
          ) : (
            <div className="mt-2 bg-red-500/20 border-2 border-red-500 text-red-100 text-sm font-bold p-3 rounded-xl">Faltan datos del emisor en Configuración</div>
          )}
        </div>
        <div className="flex gap-4 text-[10px] text-right">
          <div>PUNTO<br/><b>{puntoEmision.serie || "—"}</b></div>
          <div>SEC<br/><b className="text-[#00f5d4]">{puntoEmision.secuencial || "—"}</b></div>
          <div>FECHA<br/><b suppressHydrationWarning>{fecha || "---"}</b></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 bg-[#1e293b] p-3 rounded-xl border border-white/10">
          <div className="flex justify-between mb-2"><b className="text-[#00f5d4]">1. + CLIENTE (SRI)</b><button onClick={()=>setShowNuevoCliente(true)} className="bg-[#00f5d4]/20 text-[#00f5d4] px-2 py-1 rounded text-[10px]">+ Nuevo</button></div>
          <div className="grid grid-cols-3 gap-2">
            <select value={cliente.tipoDoc} onChange={e=>{
              const tipoDoc = e.target.value
              if (tipoDoc === "07") setCliente({ ...cliente, tipoDoc, identificacion: "9999999999999", razon: "CONSUMIDOR FINAL" })
              else setCliente({ ...cliente, tipoDoc, identificacion: cliente.identificacion === "9999999999999" ? "" : cliente.identificacion, razon: cliente.razon === "CONSUMIDOR FINAL" ? "" : cliente.razon })
            }} className="bg-black p-2 rounded-lg text-white text-[11px]">
              <option value="05">05 - Cédula</option>
              <option value="04">04 - RUC</option>
              <option value="07">07 - Consumidor Final</option>
            </select>
            <div className="flex gap-1">
  <input value={cliente.identificacion} onChange={e=>{
    const identificacion = e.target.value
    const digitos = identificacion.replace(/\D/g, "")
    const tipoDoc = digitos === "9999999999999" || /^9{13,}$/.test(digitos) ? "07" : digitos.length === 13 ? "04" : digitos.length === 10 ? "05" : cliente.tipoDoc
    setCliente({ ...cliente, identificacion, tipoDoc, razon: tipoDoc === "07" ? "CONSUMIDOR FINAL" : cliente.razon })
  }} className="flex-1 ..." />
  <button
    type="button"
    disabled={buscandoSRI}
    onClick={manejarConsultaSRIExpress}
    className={`px-4 py-2.5 rounded-xl text-xs font-black ${buscandoSRI ? "bg-cyan-500/20 animate-pulse" : "bg-cyan-400 text-black"}`}
  >
    {buscandoSRI ? "⌛ ..." : "🔍 SRI"}
  </button>
  <button
    type="button"
    onClick={buscarEnClientesDB}
    className="px-4 py-2.5 rounded-xl text-xs font-black bg-yellow-400 text-black hover:bg-yellow-300"
  >
    📂 DB
  </button>
</div>
            <input value={cliente.razon} onChange={e=>setCliente({...cliente,razon:e.target.value})} placeholder="Nombre / Razón Social" className="col-span-2 bg-black p-2 rounded-lg text-white text-[11px]" />
            <input value={cliente.direccion} onChange={e=>setCliente({...cliente,direccion:e.target.value})} placeholder="Dirección / Ubicación" className="col-span-3 bg-black p-2 rounded-lg text-white text-[11px]" />
            <input value={cliente.email} onChange={e=>setCliente({...cliente,email:e.target.value})} placeholder="Email" className="bg-black p-2 rounded-lg text-white text-[11px]" />
            <input value={cliente.telefono || ''} onChange={e=>setCliente({...cliente,telefono:e.target.value})} placeholder="Teléfono" className="bg-black p-2 rounded-lg text-white text-[11px]" />
            <input value={cliente.celular || ''} onChange={e=>setCliente({...cliente,celular:e.target.value})} placeholder="Celular" className="bg-black p-2 rounded-lg text-white text-[11px]" />

            <select value={cliente.tipoEstablecimiento === "sucursal" ? "sucursal" : "matriz"} onChange={(e)=>{
              const tipo = e.target.value === "sucursal" ? "sucursal" : "matriz"
              setCliente((f: any) => ({ ...f, tipoEstablecimiento: tipo, codSucursal: tipo === "matriz" ? (puntoEmision.estab || f.codSucursal || "") : f.codSucursal }))
            }} className="bg-black p-2 rounded-lg text-[10px] border border-white/10">
  <option value="matriz">MATRIZ</option>
  <option value="sucursal">SUCURSAL</option>
</select>
<input value={cliente.codSucursal || sucursalSeleccionada?.codigo || ''} onChange={(e)=>setCliente({...cliente,codSucursal:e.target.value})} placeholder="Cód. Sucursal Ej: 001" className="bg-black p-2 rounded-lg text-[10px] border border-white/10" />
<div className="col-span-3">
  <label className="text-[9px] text-[#00f5d4]">Sucursal del cliente - Elige donde facturar:</label>
  <select value={sucursalSeleccionada?.id || ""} onChange={(e)=>{
    const s = sucursalesFactura.find((x:any)=>x.id===e.target.value);
    if(!s) return;
    setSucursalSeleccionada(s);
    // ESTA ES LA CLAVE - AQUÍ CONECTAMOS LOS DOS PUNTOS
    setCliente((f:any)=>({ 
      ...f, 
      direccion: s.direccion, 
      provincia: s.provincia, 
      ciudad: s.ciudad, 
      codSucursal: s.codigo
    }));
  }} className="w-full mt-1 bg-black border border-[#00f5d4] rounded-lg px-3 py-2 text-[11px] font-bold">
    {sucursalesFactura.map((s:any)=><option key={s.id} value={s.id}>{s.codigo} - {s.nombre} - {s.provincia}/{s.ciudad} - {s.direccion}</option>)}
  </select>
</div>
           <div className="bg-black/50 p-2 rounded-lg text-[10px] text-zinc-400 flex items-center gap-2">
  Estab: {cliente.tipoEstablecimiento === "sucursal" ? "sucursal" : "matriz"} - {cliente.codSucursal || sucursalSeleccionada?.codigo || puntoEmision.estab || "—"}
</div>

            <select value={cliente.provincia} onChange={(e) => setCliente({...cliente, provincia: e.target.value, ciudad: PROVINCIAS[e.target.value as keyof typeof PROVINCIAS][0]})} className="bg-black text-white p-2 rounded-lg w-full">
              {Object.keys(PROVINCIAS).map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <select value={cliente.ciudad} onChange={(e) => setCliente({...cliente, ciudad: e.target.value})} className="bg-black text-white p-2 rounded-lg w-full">
              {PROVINCIAS[cliente.provincia as keyof typeof PROVINCIAS]?.map(c => (<option key={c} value={c}>{c}</option>))}
            </select>

            {/* INICIO NUEVO BLOQUE POLITICA CREDITO - AGREGADO SIN BORRAR LO ANTERIOR */}
            <div className="col-span-3 grid grid-cols-3 gap-2 bg-black/60 p-2 rounded-lg border border-[#00f5d4]/30 mt-1">
              <select value={cliente.politicaCredito} onChange={e=>setCliente({...cliente, politicaCredito:e.target.value as any})} className="bg-black p-2 rounded-lg text-white text-[11px] border border-white/10">
                <option value="BLOQUEADO">🔴 Bloqueado (Sin Crédito)</option>
                <option value="REQUISITO">🟡 Crédito Bajo Requisito</option>
                <option value="VIP">🟢 Crédito Libre / VIP</option>
              </select>
              <input type="number" value={cliente.limiteCredito} disabled={cliente.politicaCredito==="VIP"||cliente.politicaCredito==="BLOQUEADO"} onChange={e=>setCliente({...cliente, limiteCredito:Number(e.target.value)})} className={`p-2 rounded-lg text-white text-[11px] ${cliente.politicaCredito==="VIP"?'bg-green-900/30 text-green-300':'bg-black'}`} placeholder="Límite $ Ej:200" />
              <input type="number" value={cliente.diasCredito} onChange={e=>setCliente({...cliente, diasCredito:Number(e.target.value)})} className="bg-black p-2 rounded-lg text-white text-[11px]" placeholder="Días Ej:30" />
              <label className="col-span-3 flex items-center gap-2 text-[10px]"><input type="checkbox" checked={cliente.requisitosEntregados} onChange={e=>setCliente({...cliente, requisitosEntregados:e.target.checked})} /> Requisitos: Cédula, Planilla luz, Historial 3 meses</label>
              {cliente.politicaCredito==="VIP" && <div className="col-span-3 text-[9px] text-green-400 font-bold">✓ VIP: Cupo ILIMITADO - POS jamás bloqueará</div>}
              {cliente.politicaCredito==="BLOQUEADO" && <div className="col-span-3 text-[9px] text-red-400 font-bold">⚠️ Bloqueado: No puede usar CRÉDITO DIRECTO</div>}
            </div>
            {/* FIN BLOQUE NUEVO */}
          </div>
        </div>

        <div className="bg-[#0f172a] border border-white/10 rounded-xl p-3">
  <div className="flex justify-between items-center mb-2">
    <h3 className="text-[12px] font-bold">2. CATÁLOGO RÁPIDO</h3>
    <span className="text-[9px] text-white/40">{catalogoRapido.length}/12</span>
  </div>
  
 <div className="grid grid-cols-2 gap-2 content-start">
    {catalogoRapido.length === 0 && (
      <p className="col-span-2 text-[10px] text-white/30 text-center py-8">
        Escanea productos y aparecerán aquí automáticamente
      </p>
    )}
    {catalogoRapido.map((p:any)=>(
      <div key={p.codigo} className="relative bg-black border border-white/10 rounded-lg p-2 hover:border-[#00f5d4]/50 group cursor-pointer">
        {/* Botón X para eliminar */}
        <button onClick={(e)=>{e.stopPropagation(); setCatalogoRapido(prev=>prev.filter((x:any)=>x.codigo!==p.codigo))}} 
          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100">
          x
        </button>
        
        <div onClick={()=>addProducto(p)}>
          <p className="text-[11px] font-bold truncate">{p.nombre}</p>
          <p className="text-[10px] text-white/50">Stock: {p.stock}</p>
          <p className="text-[11px] text-[#00f5d4] font-bold">${Number(p.precioMinorista ?? p.precio ?? 0).toFixed(2)}</p>
          <p className="text-[8px] text-white/20 truncate">{p.codigo}</p>
        </div>
      </div>
    ))}
  </div>
</div>
      </div>

            <div className="bg-[#1e293b] p-3 rounded-xl mt-3 border border-white/10">
        <div className="flex justify-between">
          <b className="text-[#00f5d4]">ITEMS Y DETALLES - LECTOR POR ARTE DE MAGIA ACTIVO</b>
          <span>Bruto: ${bruto.toFixed(2)}</span>
        </div>
{/* SOLO APARECE SI HOY ES FERIADO - CÓDIGO 8 SRI */}
{esDiaFeriadoHoy && !anuncioFeriadoCerrado && (
  <div className="relative flex items-center gap-3 bg-gradient-to-r from-[#00f5d4]/20 to-black border border-[#00f5d4]/40 rounded-xl p-2.5 mt-3">
    <input 
      type="checkbox" 
      id="check-turismo" 
      checked={esTurismoFeriado} 
      onChange={(e)=> toggleTurismoFeriado(e.target.checked)}
      className="w-5 h-5 accent-[#00f5d4] cursor-pointer"
    />
    <label htmlFor="check-turismo" className="flex-1 cursor-pointer">
      <p className="text-[11px] font-black text-[#00f5d4] leading-none">🏖️ FERIADO DETECTADO HOY - APLICAR 8% TURISMO</p>
      <p className="text-[9px] text-white/70">SRI Código 8 - Solo para sector turismo</p>
    </label>

    {/* BOTON X PARA ELIMINAR ANUNCIO */}
    <button
      onClick={()=>{
        setAnuncioFeriadoCerrado(true);
        if(esTurismoFeriado) toggleTurismoFeriado(false); // si estaba activo, lo regresa a 15%
      }}
      className="w-6 h-6 rounded-full bg-white/10 hover:bg-red-500/80 text-white flex items-center justify-center text-[12px] font-black leading-none transition"
      title="Cerrar anuncio"
    >
      ✕
    </button>
  </div>
)}
        {/* INPUT MAESTRO - PISTOLA + TECLADO + NOMBRE */}
<div className="mt-3 bg-black border border-[#00f5d4] rounded-xl p-2 flex gap-2 items-center relative">
  <span className="text-[10px] bg-[#00f5d4] text-black px-2 py-1 rounded-full font-black">LECTOR</span>
  <input
    id="codigo-maestro"
    ref={lectorRef}
    value={codigoRapido}
    onChange={async (e)=>{
      const val = e.target.value
      textoLector.current = val
      setCodigoRapido(val)
      setErrorLector("")
      const escrito = val.trim()
      const id = ++busquedaId.current
      if (!escrito) { setSugerencias([]); setIndiceLector(-1); return }
      const res = await buscarProductosEnBase(escrito)
      if (id !== busquedaId.current) return
      setSugerencias(res.slice(0, 8))
      setIndiceLector(res.length ? 0 : -1)
      if (!res.length) setErrorLector("No encontrado")
    }}
    onKeyDown={(e)=>{
      if (e.key === "ArrowDown" && sugerencias.length) {
        e.preventDefault()
        setIndiceLector((n) => (n + 1) % sugerencias.length)
      }
      if (e.key === "ArrowUp" && sugerencias.length) {
        e.preventDefault()
        setIndiceLector((n) => (n <= 0 ? sugerencias.length - 1 : n - 1))
      }
      if(e.key==='Enter'){
        e.preventDefault();
        buscarYAgregarPorCodigoTexto(textoLector.current || (e.target as HTMLInputElement).value);
      }
    }}
    placeholder="ESCANEA PISTOLA, CÓDIGO O NOMBRE → Ej: CLA001 / 786... / llanta"
    className="flex-1 bg-[#0f172a] border border-[#00f5d4]/30 p-3 rounded-lg text-[#00f5d4] font-black font-mono text-sm outline-none focus:ring-2 focus:ring-[#00f5d4]"
    autoFocus
  />
  <button type="button" onMouseDown={(e)=>e.preventDefault()} onClick={()=> buscarYAgregarPorCodigoTexto(textoLector.current || codigoRapido, true)} className="bg-[#00f5d4] text-black px-4 py-3 rounded-lg font-black text-xs">+ ADD</button>

  {sugerencias.length>0 && (
    <div className="absolute top-full left-0 mt-2 w-[85%] bg-[#0f172a] border border-[#00f5d4]/40 rounded-xl z-[100] overflow-hidden shadow-2xl">
      {sugerencias.map((p:any, idx:number)=>(
        <div key={`${p.codigo}-${idx}`} onMouseDown={(e)=>e.preventDefault()} onMouseEnter={()=>setIndiceLector(idx)} onClick={()=>agregarDesdeLector(p)}
          className={`p-3 cursor-pointer flex justify-between items-center border-b border-white/5 ${idx===indiceLector ? "bg-[#00f5d4]/20" : "hover:bg-white/10"}`}>
          <div>
            <p className="text-[11px] font-bold text-white">{p.nombre}</p>
            <p className="text-[9px] text-white/40">{p.codigo}{p.codigoAuxiliar ? ` • ${p.codigoAuxiliar}` : ""} • Stock {Number(p.stock || 0)}</p>
          </div>
          <p className="text-[11px] font-black text-[#00f5d4]">${Number(p.precioMinorista ?? p.precio ?? 0).toFixed(2)}</p>
        </div>
      ))}
    </div>
  )}
</div>
{errorLector && <p className="mt-2 text-sm font-bold text-red-400">{errorLector}</p>}
{productos.length === 0 && <p className="mt-2 text-sm font-bold text-red-400">No hay productos cargados - revisar API</p>}

        {items.map((it,i)=>(
          <div key={i} className="grid grid-cols-12 gap-1 mt-1 p-2 bg-black rounded-xl border border-white/5 items-center">
            <div className="relative group col-span-1"><Chisme titulo="Código del producto" texto=" " /><input value={it.codigo} onChange={e=>{ const n=[...items]; n[i].codigo=e.target.value; setItems(n); }} className="w-full bg-black p-1 rounded text-[10px] font-mono border border-white/10" placeholder="P001" /></div>
            <div className="relative group col-span-2"><Chisme titulo="Producto" texto="Nombre del producto" /><input value={it.descripcion} onChange={e=>{ const n=[...items]; n[i].descripcion=e.target.value; setItems(n); }} className="w-full bg-black p-1 rounded text-[11px]" /></div>
            <div className="relative group col-span-2"><Chisme titulo="Detalle Adicional" texto="coloque información adicional" /><input value={it.detalleAdicional || ""} onChange={e=>{ const n=[...items]; (n[i] as any).detalleAdicional=e.target.value; setItems(n); }} placeholder="Color, garantía..." className="w-full bg-[#11131a] p-1 rounded text-[10px] border border-[#00f5d4]/20" /></div>
            <div className="relative group col-span-1"><Chisme titulo="Cantidad" texto="Cuántas unidades vendes" /><input type="number" value={it.cant} onChange={e=>{ const n=[...items]; n[i].cant=parseFloat(e.target.value)||1; setItems(n); }} className="w-full bg-black p-1 rounded text-xs text-center" /></div>
            <div className="relative group col-span-1">
              <Chisme titulo="Precio + Tarifa" texto="Minorista/Mayorista/Distribuidor en caliente" />
              <div className="flex"><input type="number" value={it.pUnit} onChange={e=>{ const n=[...items]; n[i].pUnit=parseFloat(e.target.value)||0; setItems(n); }} className="w-full bg-black p-1 rounded-l text-xs" /><select onChange={e=>{ const n=[...items]; const v=e.target.value; if(v==='may') n[i].pUnit=n[i].tarifas?.may||n[i].pUnit; if(v==='dist') n[i].pUnit=n[i].tarifas?.dist||n[i].pUnit; if(v==='min') n[i].pUnit=n[i].tarifas?.min||n[i].pUnit; setItems(n); }} className="bg-[#1e293b] text-[8px] rounded-r px-1"><option value="min">MIN</option><option value="may">MAY</option><option value="dist">DIS</option></select></div>
            </div>
            <div className="relative group col-span-1"><Chisme titulo="Descuento %" texto="Coloca numero de porcentaje de descuento" /><input type="number" value={it.descPorc || 0} onChange={e=>{ const n=[...items]; const porc=parseFloat(e.target.value)||0; n[i].descPorc=porc; const brutoFila=n[i].cant*n[i].pUnit; n[i].descDolar=(brutoFila*porc/100); setItems(n); }} className="w-full bg-black p-1 rounded text-xs" placeholder="%" /></div>
            <div className="relative group col-span-1"><Chisme titulo="Descuento $" texto="Coloca el valor total de descuento"/><input type="number" value={it.descDolar || 0} onChange={e=>{ const n=[...items]; const dol=parseFloat(e.target.value)||0; n[i].descDolar=dol; const brutoFila=n[i].cant*n[i].pUnit; n[i].descPorc=brutoFila>0?(dol/brutoFila*100):0; setItems(n); }} className="w-full bg-black p-1 rounded text-xs border border-yellow-500/20" placeholder="$" /></div>
            <div className="relative group col-span-1"><Chisme titulo="IVA" texto="Cambie el tipo de iva si no lleva inventario" /><select 
    value={it.codigoPorcentaje} 
    onChange={e=>{ 
      const n=[...items]; 
      const cod = e.target.value;
      n[i].codigoPorcentaje = cod;
      n[i].tarifa = CATALOGO_IVA_SRI[cod].tarifa;
      // Si es No Objeto (6) o Exento (7) el valor del IVA es 0
      if(cod==="6" || cod==="7"){
        n[i].valorIva = 0;
      }
      setItems(n); 
    }} 
    className="w-full bg-black border border-white/20 rounded-lg p-1 text-[10px] text-white"
  >
    <option value="0">0 - 0%</option>
    <option value="4">4 - 15% Vigente</option>
    <option value="8">8 - 8% Turismo Feriado</option>
    <option value="5">5 - 5% Construcción</option>
    <option value="2">2 - 12% Histórico</option>
    <option value="3">3 - 14% Histórico</option>
    <option value="10">10 - 13% Técnico</option>
    <option value="6">6 - No Objeto</option>
    <option value="7">7 - Exento</option>
  </select>
</div>
            <div className="relative group col-span-1"><Chisme titulo="Subtotal" texto="(Cant x Precio) - Descuento $" /><div className="bg-black p-1 rounded text-[#00f5d4] text-[11px] font-bold text-right">${(it.cant*it.pUnit - (it.descDolar||0)).toFixed(2)}</div></div>
            <div className="relative group col-span-1"><div className="absolute -top-[52px] left-1/2 -translate-x-1/2 hidden group-hover:block z-50"><div className="bg-red-950 border border-red-500 rounded-xl px-3 py-2"><p className="text-red-400 font-black text-[11px]">Borrar</p></div></div><button onClick={()=>setItems(items.filter((_,idx)=>idx!==i))} className="w-full bg-red-500/20 rounded text-red-400 text-xs font-black">X</button></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="bg-[#1e293b] p-3 rounded-xl border border-white/10">
          <div className="flex justify-between items-center mb-2">
  <b className="text-[#00f5d4] text-[11px]">PAGOS (SRI TABLA 24) - FICHA TÉCNICA</b>
</div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#00f5d4]/10 rounded-lg p-2 border border-[#00f5d4]/30">
              <div className="text-[9px] opacity-60">01 - SIN UTILIZACION DEL SISTEMA FINANCIERO</div>
              <div className="font-black text-[#00f5d4] text-xl">${plata(pagosReales.efectivo).toFixed(2)}</div>
              <div className="text-[8px] opacity-40">Auto = Total - otros</div>
            </div>
            <label className="bg-black/40 rounded-lg p-2 border border-white/5 cursor-pointer hover:border-white/20">
              <div className="text-[8px] opacity-60">20 - OTROS CON UTILIZACION DEL SISTEMA FINANCIERO</div>
              <input type="number" min="0" step="0.01" value={plata(pagos.redBancaria)} onChange={(e) => guardarMonto("redBancaria", e.target.value)} className="w-full bg-transparent font-bold outline-none text-sm" />
              <div className="text-[7px] opacity-30">Transfer / Depósito / Cheque</div>
            </label>
            <label className="bg-black/40 rounded-lg p-2 border border-white/5 cursor-pointer hover:border-white/20">
              <div className="text-[8px] opacity-60">19 - TARJETA DE CREDITO</div>
              <input type="number" min="0" step="0.01" value={plata(pagos.tarjeta)} onChange={(e) => guardarMonto("tarjeta", e.target.value)} className="w-full bg-transparent font-bold outline-none text-sm" />
              <div className="text-[7px] opacity-30">Datafast / Medianet</div>
            </label>
          </div>

          <details className="mt-3">
            <summary className="text-[10px] opacity-40 cursor-pointer hover:opacity-70 list-none">
              + Canales especiales (15, 16, 17, 18, 21) - Solo grandes contribuyentes ▼
            </summary>
            <div className="grid grid-cols-4 gap-2 mt-2">
              <label className="bg-black/30 rounded-lg p-2 border border-white/10">
                <div className="text-[7px] opacity-60">15 - COMPENSACION DE DEUDAS</div>
                <input type="number" min="0" step="0.01" value={plata(pagos.compensacion)} onChange={(e) => guardarMonto("compensacion", e.target.value)} className="w-full bg-transparent font-bold outline-none text-[11px]" />
              </label>
              <label className="bg-black/30 rounded-lg p-2 border border-white/10">
                <div className="text-[7px] opacity-60">16 - TARJETA DE DEBITO</div>
                <input type="number" min="0" step="0.01" value={plata(pagos.debito)} onChange={(e) => guardarMonto("debito", e.target.value)} className="w-full bg-transparent font-bold outline-none text-[11px]" />
              </label>
              <label className="bg-black/30 rounded-lg p-2 border border-white/10">
                <div className="text-[7px] opacity-60">17 - DINERO ELECTRONICO</div>
                <input type="number" min="0" step="0.01" value={plata(pagos.dineroElec)} onChange={(e) => guardarMonto("dineroElec", e.target.value)} className="w-full bg-transparent font-bold outline-none text-[11px]" />
              </label>
              <label className="bg-black/30 rounded-lg p-2 border border-white/10">
                <div className="text-[7px] opacity-60">18 - TARJETA PREPAGO</div>
                <input type="number" min="0" step="0.01" value={plata(pagos.prepago)} onChange={(e) => guardarMonto("prepago", e.target.value)} className="w-full bg-transparent font-bold outline-none text-[11px]" />
              </label>
              <label className="bg-black/30 rounded-lg p-2 border border-white/10 col-span-1">
                <div className="text-[7px] opacity-60">21 - ENDOSO DE TITULOS</div>
                <input type="number" min="0" step="0.01" value={plata(pagos.endoso)} onChange={(e) => guardarMonto("endoso", e.target.value)} className="w-full bg-transparent font-bold outline-none text-[11px]" />
              </label>
            </div>
          </details>

          {total >= 500 && pagosReales.efectivo === total && (
            <div className="mt-2 bg-red-500/20 border border-red-500/50 text-red-300 text-[10px] p-2 rounded">
              ⚠️ REGLA BANCARIZACIÓN: Total ${total.toFixed(2)} ≥ $500. No puede usar solo 01. Debe incluir 15 al 21.
            </div>
          )}
        </div>

        {itemSinTarifa && (
          <div className="mb-3 bg-red-500/20 border-2 border-red-500 text-red-100 text-sm font-bold p-4 rounded-xl">
            Hay un producto sin tarifa IVA. No se puede emitir hasta corregirlo en Inventario.
          </div>
        )}
        {bloqueoConsumidorFinal && (
          <div className="mb-3 bg-red-500/20 border-2 border-red-500 text-red-100 text-sm font-bold p-4 rounded-xl">
            {avisoConsumidorFinal}
          </div>
        )}
        <div className="bg-[#1e293b] p-3 rounded-xl border-t-4 border-t-[#7c3aed] border border-white/10">
          <b>RESUMEN CONTABLE FACTURA (SRI)</b>
          <div className="space-y-1 mt-2">
            <div className="flex justify-between"><span>Subtotal sin Impuestos:</span><b>${plata(subtotalSin).toFixed(2)}</b></div>
            <div className="flex justify-between"><span>Subtotal IVA 15% (o vig.):</span><b>${plata(base15).toFixed(2)}</b></div>
            <div className="flex justify-between"><span>Subtotal IVA 0%:</span><b>${plata(base0).toFixed(2)}</b></div>
            <div className="flex justify-between"><span>Subtotal No objeto de IVA:</span><b>${plata(baseNoObjeto).toFixed(2)}</b></div>
            <div className="flex justify-between"><span>Subtotal Exento de IVA:</span><b>${plata(baseExento).toFixed(2)}</b></div>
            <div className="flex justify-between"><span>Subtotal IVA Diferenciado:</span><b>${plata(baseDiferenciado).toFixed(2)}</b></div>
            <div className="flex justify-between"><span>Total Descuentos:</span><b className="text-red-400">-${plata(descuento).toFixed(2)}</b></div>
            <div className="flex justify-between"><span>Valor ICE:</span><b>${plata(valorICE).toFixed(2)}</b></div>
            <div className="flex justify-between"><span>Valor IRBPNR (Plásticos):</span><b>${plata(valorIRBPNR).toFixed(2)}</b></div>
            <div className="flex justify-between"><span>IVA Oficial:</span><b className="text-[#00f5d4]">${plata(iva15).toFixed(2)}</b></div>
            <div className="flex justify-between items-center border-t border-white/10 pt-1"><label className="flex items-center gap-2"><input type="checkbox" checked={propinaCheck} onChange={e=>setPropinaCheck(e.target.checked)} /> Propina 10%:</label><b>${plata(propina).toFixed(2)}</b></div>
            <div className="flex justify-between text-lg border-t border-white/10 pt-2 mt-2"><span className="font-black">VALOR TOTAL A PAGAR:</span><b className="text-[#00f5d4] text-xl">${plata(total).toFixed(2)}</b></div>
            {items.length === 0 || total <= 0 ? <div className="text-right text-[11px] font-black text-white/40">Sin productos</div> : null}
          </div>
<div className="grid grid-cols-3 gap-2 mt-3">
  <button type="button" onClick={() => { if (bloqueoConsumidorFinal) return; setCajaAbierta(true) }} disabled={bloqueoConsumidorFinal} className={`font-black py-3 rounded-xl text-xs ${bloqueoConsumidorFinal ? "bg-white/10 text-white/30" : "bg-[#00f5d4] text-black"}`}>
    CAJA Y COBRO
  </button>
  <button onClick={() => guardarComoBorrador()} className="bg-[#ffbe0a] text-black font-black py-3 rounded-xl text-xs">
    📝 BORRADOR
  </button>
  <button type="button" onClick={() => emitirComprobante()} disabled={!pagoRealizado || bloqueoConsumidorFinal || !emisorListo || itemSinTarifa} className={`font-black py-3 rounded-xl text-xs ${pagoRealizado && !bloqueoConsumidorFinal && emisorListo && !itemSinTarifa ? 'bg-white text-black' : 'bg-white/10 text-white/20'}`}>
    {configEmisor.ambiente === "PRODUCCIÓN" ? "ENVIAR A SRI PRODUCCIÓN" : "ENVIAR A SRI PRUEBAS"}
  </button>
</div>
          {cajaAbierta && (
  <div className="fixed inset-0 bg-black/90 z-[150] flex items-center justify-center p-4">
    <div className="bg-[#0f1b2e] w-full max-w-[500px] rounded-[20px] border border-cyan-500/30 p-5">
      <h2 className="font-black text-[#00f5d4]">CAJA ABIERTA - {cliente.identificacion==="9999999999999"?"CONSUMIDOR FINAL":cliente.razon}</h2>
      
      {/* === BLOQUE CORREGIDO: TOTAL / PAGADO / VUELTO EN VIVO === */}
      {(() => {
        const pagado = tipoCobro === "pendiente" || tipoCobro === "credito" ? 0 : (abonos.efectivo||0) + (abonos.transfer||0) + (abonos.tarjeta||0)
        const diff = pagado - total
        const falta = diff < -0.01
        const vuelto = diff > 0.01
        return (
          <div className="bg-black p-3 rounded-xl mt-3 flex justify-between items-center text-[11px] border border-white/10">
            <span>Total: <b>${total.toFixed(2)}</b></span>
            <span>Recibido: <b className="text-[#00f5d4]">${pagado.toFixed(2)}</b></span>
            {items.length === 0 || total <= 0 ? <span className="text-white/40 font-black">Sin productos</span> : falta ? <span className="text-orange-400 font-black">Falta: ${Math.abs(diff).toFixed(2)}</span> : vuelto ? <span className="bg-[#00f5d4] text-black px-3 py-1 rounded-full font-black">Vuelto: ${diff.toFixed(2)}</span> : null}
          </div>
        )
      })()}

      <div className="flex gap-1 mt-4">
        <button onClick={()=>setTipoCobro('efectivo')} className={`flex-1 py-2 rounded-xl text-[9px] font-black ${tipoCobro==='efectivo'?"bg-[#00f5d4] text-black":"bg-white/10"}`}>EFECTIVO</button>
        <button onClick={()=>setTipoCobro('tarjeta')} className={`flex-1 py-2 rounded-xl text-[9px] font-black ${tipoCobro==='tarjeta'?"bg-[#00f5d4] text-black":"bg-white/10"}`}>TARJETA</button>
        <button onClick={()=>setTipoCobro('transfer')} className={`flex-1 py-2 rounded-xl text-[9px] font-black ${tipoCobro==='transfer'?"bg-[#00f5d4] text-black":"bg-white/10"}`}>TRANSF</button>
        <button onClick={()=>{ setTipoCobro('pendiente'); setAbonos({ efectivo: 0, transfer: 0, tarjeta: 0, credito: 0 }) }} className={`flex-1 py-2 rounded-xl text-[9px] font-black ${tipoCobro==='pendiente'?"bg-amber-300 text-black":"bg-white/10"}`}>PENDIENTE DE PAGO</button>
        <button onClick={()=>{ setTipoCobro('credito'); setAbonos({ efectivo: 0, transfer: 0, tarjeta: 0, credito: 0 }); setValorCredito(total); setAvisoCredito("") }} className={`flex-1 py-2 rounded-xl text-[9px] font-black ${tipoCobro==='credito'?"bg-violet-400 text-black":"bg-white/10"}`}>CREDITO</button>
      </div>

      <div className="mt-4 bg-black/50 p-4 rounded-xl border border-white/10">
        {tipoCobro==='efectivo' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/70">Abono Efectivo</span>
              <input type="number" className="w-28 bg-[#1a2a44] p-2.5 rounded-xl text-right font-black text-cyan-400 border border-cyan-500/30"
                value={abonos.efectivo||""}
                onChange={e=>setAbonos({...abonos, efectivo:Number(e.target.value)})} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                {val:20, label:"$20"},
                {val:10, label:"$10"},
                {val:5, label:"$5"},
                {val:1, label:"$1"},
                {val:0.25, label:"$0.25"},
                {val:0.10, label:"$0.10"},
              ].map(b=>(
                <div key={b.val} className="bg-[#1e293b] p-2 rounded-xl border border-white/5">
                  <div className="text-[9px] text-white/50 text-center">{b.label}</div>
                  <input type="number" min="0" placeholder="0"
                    className="w-full bg-[#0f172a] p-1.5 rounded text-center text-xs font-black text-white mt-1"
                    value={conteoCaja[b.val.toString()]||""}
                    onChange={e=>{
                      const cant = parseInt(e.target.value)||0
                      const nuevoConteo = {...conteoCaja, [b.val.toString()]: cant}
                      setConteoCaja(nuevoConteo)
                      let totalEfectivo = 0
                      Object.keys(nuevoConteo).forEach(k=>{
                        totalEfectivo += parseFloat(k) * (nuevoConteo[k]||0)
                      })
                      setAbonos({...abonos, efectivo: parseFloat(totalEfectivo.toFixed(2))})
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        {tipoCobro==='tarjeta' && (
          <div className="space-y-3 bg-[#0f172a]/50 p-3 rounded-xl border border-cyan-500/20">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={()=>setTarjetaData({...tarjetaData, tipoSRI:"16"})}
                className={`py-2.5 rounded-xl text-[11px] font-black border ${tarjetaData.tipoSRI==="16"?"bg-[#00f5d4] text-black border-[#00f5d4]":"bg-[#1a2a44] text-white/60 border-white/10"}`}>
                TARJETA DEBITO (16)
              </button>
              <button onClick={()=>setTarjetaData({...tarjetaData, tipoSRI:"19"})}
                className={`py-2.5 rounded-xl text-[11px] font-black border ${tarjetaData.tipoSRI==="19"?"bg-[#00f5d4] text-black border-[#00f5d4]":"bg-[#1a2a44] text-white/60 border-white/10"}`}>
                TARJETA CREDITO (19)
              </button>
            </div>
            <div className="flex gap-2">
              <input type="number" autoFocus placeholder="Valor - EJ: 30"
                className="flex-1 bg-[#1a2a44] p-3 rounded-xl font-black text-cyan-400 text-lg border border-white/10"
                value={abonos.tarjeta||""}
                onChange={e=>setAbonos({...abonos, tarjeta:Number(e.target.value)})} />
              <button onClick={()=>setAbonos({...abonos, tarjeta: total - abonos.efectivo - abonos.transfer - abonos.credito})}
                className="bg-white/10 px-3 rounded-xl text-[10px] leading-none">Usar<br/>${(total-abonos.efectivo-abonos.transfer-abonos.credito-abonos.tarjeta + abonos.tarjeta).toFixed(2)}</button>
            </div>
            {tarjetaData.tipoSRI==="19" && (
              <div className="space-y-2 bg-black/40 p-3 rounded-xl border border-white/5">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={()=>setTarjetaData({...tarjetaData, forma:"CORRIENTE", plazo:0})}
                    className={`py-2 rounded-xl text-[10px] font-black ${tarjetaData.forma==="CORRIENTE"?"bg-white text-black":"bg-[#1e293b] text-white/70"}`}>CORRIENTE</button>
                  <button onClick={()=>setTarjetaData({...tarjetaData, forma:"DIFERIDO"})}
                    className={`py-2 rounded-xl text-[10px] font-black ${tarjetaData.forma==="DIFERIDO"?"bg-white text-black":"bg-[#1e293b] text-white/70"}`}>DIFERIDO</button>
                </div>
                {tarjetaData.forma==="DIFERIDO" && (
                  <select className="w-full bg-[#1a2a44] p-3 rounded-xl text-sm font-bold"
                    value={tarjetaData.plazo} onChange={e=>setTarjetaData({...tarjetaData, plazo:Number(e.target.value)})}>
                    <option value={3}>3 meses (Sin Intereses)</option>
                    <option value={6}>6 meses</option>
                    <option value={9}>9 meses</option>
                    <option value={12}>12 meses</option>
                    <option value={24}>24 meses</option>
                  </select>
                )}
              </div>
            )}
            <select className="w-full bg-[#1a2a44] p-3 rounded-xl text-sm font-bold border border-white/10"
              value={tarjetaData.franquicia} onChange={e=>setTarjetaData({...tarjetaData, franquicia:e.target.value})}>
              <option>Datafast - Visa / Mastercard</option>
              <option>Datafast - Diners / Discover</option>
              <option>Medianet - Banco Pichincha</option>
              <option>Banco Guayaquil - American Express</option>
              <option>Banco Austro</option>
            </select>
            <input type="text" placeholder="N° Lote / Voucher (Ej: 000142) - OBLIGATORIO"
              className="w-full bg-[#1e293b] p-3 rounded-xl text-sm border border-white/10"
              value={refTarjeta} onChange={e=>setRefTarjeta(e.target.value)} />
          </div>
        )}
        {tipoCobro==='transfer' && (
          <div className="space-y-2">
            <input type="number" placeholder="Valor Transfer" autoFocus className="w-full bg-[#1a2a44] p-3 rounded-xl font-black text-cyan-400 text-lg" value={abonos.transfer||""} onChange={e=>setAbonos({...abonos, transfer:Number(e.target.value)})} />
            <input type="text" placeholder="Comprobante" className="w-full bg-[#1e293b] p-3 rounded-xl text-sm" value={refTransfer} onChange={e=>setRefTransfer(e.target.value)} />
            <button type="button" onClick={()=>setAbonos({...abonos, transfer: total - abonos.efectivo - abonos.tarjeta - abonos.credito})} className="text-[10px] bg-white/10 px-3 py-1 rounded-full">Usar saldo restante</button>
          </div>
        )}
        {tipoCobro==='pendiente' && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Total</span><b>${total.toFixed(2)}</b></div>
            <div className="flex justify-between"><span>Recibido</span><b>$0.00</b></div>
            <div className="flex justify-between text-amber-300 font-black"><span>Saldo Pendiente</span><b>${total.toFixed(2)}</b></div>
            <select value={formaPendiente} onChange={(e) => setFormaPendiente(e.target.value)} className="w-full bg-[#1a2a44] p-3 rounded-xl text-xs">
              <option value="01 - SIN UTILIZACION DEL SISTEMA FINANCIERO">01 - Sin utilización del sistema financiero</option>
              <option value="20 - OTROS CON UTILIZACION DEL SISTEMA FINANCIERO">20 - Otros con utilización del sistema financiero</option>
            </select>
          </div>
        )}
        {tipoCobro==='credito' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px]">Plazo<input type="number" min="1" value={plazoCredito || ""} onChange={(e) => setPlazoCredito(Number(e.target.value))} className="w-full bg-[#1a2a44] p-3 rounded-xl font-black" /></label>
              <label className="text-[10px]">Unidad<select value={unidadPlazo} onChange={(e) => setUnidadPlazo(e.target.value as "Días" | "Meses")} className="w-full bg-[#1a2a44] p-3 rounded-xl"><option>Días</option><option>Meses</option></select></label>
            </div>
            <label className="text-[10px] block">Número de cuotas<input type="number" min="1" value={cuotasCredito || ""} onChange={(e) => setCuotasCredito(Number(e.target.value))} className="w-full bg-[#1a2a44] p-3 rounded-xl font-black" /></label>
            <div className="text-xs">Fecha de vencimiento: <b>{plazoCredito > 0 ? fechaVencimientoCredito().toLocaleDateString("es-EC") : "—"}</b></div>
            <label className="text-[10px] block">Valor Crédito<input type="number" value={valorCredito || total} onChange={(e) => setValorCredito(Number(e.target.value))} className="w-full bg-[#1a2a44] p-3 rounded-xl font-black" /></label>
            {avisoCredito && <div className="text-red-400 text-xs font-black">{avisoCredito}</div>}
          </div>
        )}
      </div>

      {/* === BOTONES CORREGIDOS: PERMITEN VUELTO === */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <button onClick={()=>setCajaAbierta(false)} className="bg-white/10 p-4 rounded-xl">Cancelar</button>
        {(() => {
          if (tipoCobro === "pendiente") {
            return <button type="button" disabled={bloqueoConsumidorFinal} onClick={() => {
              setPagoRealizado(true); setCajaAbierta(false)
            }} className="bg-amber-300 text-black p-4 rounded-xl font-black text-[11px] disabled:opacity-40">CONFIRMAR PENDIENTE DE PAGO</button>
          }
          if (tipoCobro === "credito") {
            return <button type="button" disabled={bloqueoConsumidorFinal} onClick={() => {
              if (!(plazoCredito > 0) || !(cuotasCredito >= 1)) {
                setAvisoCredito("Para crédito debes poner plazo y cuotas")
                return
              }
              setAvisoCredito("")
              setPagoRealizado(true); setCajaAbierta(false)
            }} className="bg-violet-400 text-black p-4 rounded-xl font-black text-[11px] disabled:opacity-40">CONFIRMAR CRÉDITO</button>
          }
          const pagado = (abonos.efectivo||0) + (abonos.transfer||0) + (abonos.tarjeta||0)
          const diff = pagado - total
          const falta = total - pagado

          if (falta > 0.01) {
            return <button disabled className="bg-white/10 text-white/30 p-4 rounded-xl font-black text-[11px]">Falta ${falta.toFixed(2)}</button>
          }
          if (diff > 0.01) {
            return (
              <button type="button" disabled={bloqueoConsumidorFinal} onClick={()=>{
                if (bloqueoConsumidorFinal) return
                const cambio = diff
                setPagoRealizado(true); setCajaAbierta(false)
              }} className="bg-[#00f5d4] text-black p-4 rounded-xl font-black text-[11px] shadow-[0_0_20px_rgba(0,245,212,0.6)] disabled:opacity-40">
                ✓ ENTREGAR VUELTO ${diff.toFixed(2)}
              </button>
            )
          }
          return (
            <button type="button" disabled={bloqueoConsumidorFinal} onClick={()=>{
              if (bloqueoConsumidorFinal) return
              setPagoRealizado(true); setCajaAbierta(false)
            }} className="bg-[#00f5d4] text-black p-4 rounded-xl font-black disabled:opacity-40">
              ✓ CONFIRMAR PAGO MIXTO
            </button>
          )
        })()}
      </div>
    </div>
          {showNuevoCliente && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4">
          <div className="bg-[#1e293b] w-full max-w-[400px] rounded-[20px] p-5 border border-white/10">
            <div className="flex justify-between mb-3"><b>➕ NUEVO CLIENTE</b><button onClick={()=>setShowNuevoCliente(false)}>✕</button></div>
            <input value={nuevoCliForm.identificacion} onChange={e=>setNuevoCliForm({...nuevoCliForm, identificacion:e.target.value})} placeholder="Cédula / RUC *" className="w-full bg-black p-3 rounded-xl text-[12px] mb-2" />
            <input value={nuevoCliForm.razon} onChange={e=>setNuevoCliForm({...nuevoCliForm, razon:e.target.value})} placeholder="Razón Social *" className="w-full bg-black p-3 rounded-xl text-[12px] mb-2" />
            <input value={nuevoCliForm.direccion} onChange={e=>setNuevoCliForm({...nuevoCliForm, direccion:e.target.value})} placeholder="Dirección" className="w-full bg-black p-3 rounded-xl text-[12px] mb-2" />
            <input value={nuevoCliForm.email} onChange={e=>setNuevoCliForm({...nuevoCliForm, email:e.target.value})} placeholder="Email" className="w-full bg-black p-3 rounded-xl text-[12px] mb-2" />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={()=>setShowNuevoCliente(false)} className="bg-white/10 py-3 rounded-xl">Cancelar</button>
              <button onClick={guardarNuevoCliente} className="bg-[#00f5d4] text-black py-3 rounded-xl font-black">Guardar</button>
            </div>
          </div>
        </div>
      )}
  </div>
)}
         
        </div>
      </div>
    </div>
  )
}