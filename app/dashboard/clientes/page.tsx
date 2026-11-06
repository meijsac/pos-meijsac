"use client";
import { useState, useMemo, useEffect } from "react";

type TipoId = "04" | "05" | "06" | "07" | "08";
interface Sucursal { id: string; clienteId: string; codigo: string; nombre: string; direccion: string; provincia: string; ciudad: string; telefono?: string; esMatriz: boolean; }
interface Cliente {
  id: string;
  tipoId: TipoId;
  identificacion: string;
  razonSocial: string;
  nombreComercial?: string;
  tipoCliente: "NATURAL" | "JURIDICA";
  email: string;
  telefono: string;
  direccion: string;
  provincia: string;
  ciudad: string;
  diasCredito: number;
  limiteCredito: number;
  categoria: "DETALLISTA" | "DISTRIBUIDOR" | "VIP" | "NINGUNO";
  descuento: number;
  empresaId?: string;
  sucursales?: Sucursal[];
}

const TIPOS_ID = [
  { code: "04", label: "RUC - 13 dígitos", desc: "RUC" },
  { code: "05", label: "Cédula - 10 dígitos", desc: "CÉDULA" },
  { code: "06", label: "Pasaporte", desc: "PASAPORTE" },
  { code: "07", label: "Consumidor Final", desc: "C.F." },
  { code: "08", label: "ID Exterior", desc: "EXTERIOR" },
];

const PROVINCIAS_MAP: Record<string, string[]> = {
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
};
const PROVINCIAS = Object.keys(PROVINCIAS_MAP);

function validarCedulaEC(ced: string) {
  if (ced.length!== 10) return false;
  const dig = ced.split("").map(Number);
  if (dig[2] > 5) return false;
  let tot = 0;
  for (let i = 0; i < 9; i++) {
    let m = dig[i] * (i % 2 === 0? 2 : 1);
    if (m > 9) m -= 9;
    tot += m;
  }
  const ver = tot % 10 === 0? 0 : 10 - (tot % 10);
  return ver === dig[9];
}

export default function ClientesModule() {
  const [clientes, setClientes] = useState<Cliente[]>([
    { id: "1", tipoId: "07", identificacion: "9999999999999", razonSocial: "CONSUMIDOR FINAL", tipoCliente: "NATURAL", email: "", telefono: "", direccion: "Pichincha", provincia: "PICHINCHA", ciudad: "QUITO", diasCredito: 0, limiteCredito: 0, categoria: "NINGUNO", descuento: 0 }
  ]);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<Cliente>({
    id: "", tipoId: "05", identificacion: "", razonSocial: "", nombreComercial: "", tipoCliente: "NATURAL", email: "", telefono: "", direccion: "", provincia: "PICHINCHA", ciudad: "QUITO", diasCredito: 0, limiteCredito: 0, categoria: "DETALLISTA", descuento: 0
  });

  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucForm, setSucForm] = useState({ codigo: "", nombre: "", direccion: "", provincia: "PICHINCHA", ciudad: "QUITO", telefono: "" });

  // --- CONEXION A NEON ---
  const getEmpresaId = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("empresaId") || localStorage.getItem("empresa_id") || localStorage.getItem("empresa") || "meijsac-default";
  };

  const cargarClientes = async () => {
    try {
      const empresaId = getEmpresaId();
      const res = await fetch(`/api/clientes?empresaId=${empresaId}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const mapeados: Cliente[] = data.map((d: any) => ({
          id: d.id,
          tipoId: d.tipoId || "05",
          identificacion: d.identificacion,
          razonSocial: d.razonSocial,
          nombreComercial: d.nombreComercial || "",
          tipoCliente: d.tipoCliente || "NATURAL",
          email: d.email || "",
          telefono: d.telefono || "",
          direccion: d.direccion || "",
          provincia: d.provincia || "PICHINCHA",
          ciudad: d.ciudad || "QUITO",
          diasCredito: d.diasCredito || 0,
          limiteCredito: d.limiteCredito || 0,
          categoria: d.categoria || "DETALLISTA",
          descuento: d.descuento || 0,
          empresaId: d.empresaId,
          sucursales: d.sucursales || [],
        }));
        setClientes([{ id: "1", tipoId: "07", identificacion: "9999999999999", razonSocial: "CONSUMIDOR FINAL", tipoCliente: "NATURAL", email: "", telefono: "", direccion: "Pichincha", provincia: "PICHINCHA", ciudad: "QUITO", diasCredito: 0, limiteCredito: 0, categoria: "NINGUNO", descuento: 0 }, ...mapeados.filter(c=>c.identificacion!=="9999999999999")]);
      }
    } catch (e) { console.log("Error cargando", e); }
  };

  useEffect(() => { cargarClientes(); }, []);

  const cargarSucursales = async (clienteId: string) => {
    try {
      const res = await fetch(`/api/sucursales?clienteId=${clienteId}`);
      const data = await res.json();
      setSucursales(Array.isArray(data) ? data : []);
    } catch { setSucursales([]); }
  };

  useEffect(() => {
    if(form.id && form.id!=="1" && form.id!=="") cargarSucursales(form.id);
    else setSucursales(form.sucursales || []);
  }, [form.id]);

  const getMaxLength = (tipoId: TipoId) => {
    if (tipoId === "05") return 10;
    if (tipoId === "04") return 13;
    if (tipoId === "07") return 13;
    return 20;
  };

  const manejarConsultaSRI = async () => {
    if(!form.identificacion) return alert("Pon cédula/RUC");
    const res = await fetch(`/api/sri/buscar-ruc?id=${form.identificacion}`);
    const json = await res.json();
    if (json.success) {
      setForm((f: any) => ({ ...f, razonSocial: json.data.razonSocial, direccion: json.data.direccion }));
    } else {
      alert("No encontró en SRI");
    }
  };

  const aplicarConsumidorFinal = () => {
    setForm((f: any) => ({
      ...f,
      tipoId: "07",
      identificacion: "9999999999999",
      razonSocial: "CONSUMIDOR FINAL",
      tipoCliente: "NATURAL",
      email: "",
      provincia: "PICHINCHA",
      ciudad: "QUITO",
      diasCredito: 0,
      limiteCredito: 0,
      categoria: "NINGUNO",
      descuento: 0
    }));
  };

  const esEdicion = form.identificacion !== "" && clientes.some(c => c.identificacion === form.identificacion && c.identificacion !== "9999999999999");

  const handleEliminar = async () => {
    if (!esEdicion) return;
    if (!confirm(`¿Eliminar cliente ${form.razonSocial} - ${form.identificacion}?`)) return;
    try {
      const empresaId = getEmpresaId();
      const clienteOriginal = clientes.find(c => c.identificacion === form.identificacion);
      const res = await fetch(`/api/clientes?id=${clienteOriginal?.id}&identificacion=${form.identificacion}&empresaId=${empresaId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) return alert("Error: " + json.error);
      alert("🗑️ Cliente eliminado");
      setClientes(cs => cs.filter(c => c.identificacion !== form.identificacion));
      setForm({ id: "", tipoId: "05", identificacion: "", razonSocial: "", nombreComercial: "", tipoCliente: "NATURAL", email: "", telefono: "", direccion: "", provincia: "PICHINCHA", ciudad: "QUITO", diasCredito: 0, limiteCredito: 0, categoria: "DETALLISTA", descuento: 0 });
      cargarClientes();
    } catch (e) { alert("Error al eliminar"); }
  };

  const filtrados = useMemo(() => clientes.filter(c =>
    c.razonSocial.toLowerCase().includes(busca.toLowerCase()) || c.identificacion.includes(busca)
  ), [clientes, busca]);

  const handleGuardar = async () => {
  if(!form.identificacion || !form.razonSocial || !form.direccion){
    alert("Falta RUC, Razón Social y Dirección");
    return;
  }

  try {
    const esNuevo = !form.id || form.id === "";
    // Si es nuevo, NO mandes el id
    const payload: any = { ...form };
    if(esNuevo) delete payload.id;
    payload.empresaId = "meijsac-default"; // o tu empresaId real

    const method = esNuevo ? "POST" : "PUT";
    
    const res = await fetch("/api/clientes", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    
    if(!data.success){
      throw new Error(data.error);
    }

    alert(esNuevo ? "Cliente creado con MATRIZ 001" : "Cliente actualizado");
    // Recarga la lista
    window.location.reload();

  } catch (e:any) {
    alert("Error al guardar en DB: " + e.message);
  }
};

  const handleGuardarSucursal = async () => {
    if(!form.id || form.id==="1") return alert("Primero guarda el cliente");
    if(!sucForm.codigo || !sucForm.direccion) return alert("Código y dirección obligatorios");
    const res = await fetch("/api/sucursales", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ clienteId: form.id, codigo: sucForm.codigo, nombre: sucForm.nombre || `SUCURSAL ${sucForm.codigo}`, direccion: sucForm.direccion, provincia: sucForm.provincia, ciudad: sucForm.ciudad, telefono: sucForm.telefono, esMatriz: sucForm.codigo==="001" }) });
    const json = await res.json();
    if(!json.success) return alert("Error sucursal: " + json.error);
    setSucForm({ codigo: "", nombre: "", direccion: "", provincia: "PICHINCHA", ciudad: "QUITO", telefono: "" });
    cargarSucursales(form.id);
  };

  const handleEliminarSucursal = async (id: string) => {
    if(!confirm("¿Borrar sucursal?")) return;
    await fetch(`/api/sucursales?id=${id}`, { method: "DELETE" });
    cargarSucursales(form.id);
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 flex gap-4">
      <div className="w-[40%] bg-[#0f172a]/50 border border-white/10 rounded-xl p-3 flex flex-col">
        <button onClick={() => setForm({ id: "", tipoId: "05", identificacion: "", razonSocial: "", nombreComercial: "", tipoCliente: "NATURAL", email: "", telefono: "", direccion: "", provincia: "PICHINCHA", ciudad: "QUITO", diasCredito: 0, limiteCredito: 0, categoria: "DETALLISTA", descuento: 0 })}
          className="w-full bg-[#00f5d4] text-black font-black text-[11px] py-2 rounded-full mb-3">+ NUEVO CLIENTE</button>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar RUC / Nombre..." className="bg-black border border-white/10 rounded-lg px-3 py-2 text-[11px] mb-3 outline-none focus:border-[#00f5d4]" />
        <div className="space-y-2 overflow-auto">
          {filtrados.map((c, idx) => (
            <div key={`${c.identificacion}-${idx}`} onClick={() => setForm(c)} className={`p-3 rounded-xl border cursor-pointer flex gap-3 ${form.identificacion === c.identificacion ? 'bg-[#0f172a] border-[#00f5d4]' : 'bg-black border-white/5'}`}>
              <div className="w-9 h-9 rounded-full bg-[#00f5d4]/20 text-[#00f5d4] flex items-center justify-center font-black text-[11px]">{c.razonSocial[0]}</div>
              <div className="flex-1">
                <p className="text-[11px] font-bold truncate">{c.razonSocial}</p>
                <p className="text-[9px] text-white/50">{c.identificacion} • {TIPOS_ID.find(t => t.code === c.tipoId)?.desc} • {c.provincia || "PICHINCHA"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-[60%] bg-[#0f172a]/30 border border-white/10 rounded-xl p-5 space-y-6 overflow-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-[#00f5d4] font-bold text-[11px] tracking-widest">FICHA DEL CLIENTE</h2>
          <button onClick={aplicarConsumidorFinal} className="text-[9px] bg-[#00ff5d]/20 border border-[#00ff5d]/50 text-[#00ff5d] px-3 py-1 rounded-full">⚡ CONSUMIDOR FINAL (999...)</button>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-white/70 border-l-2 border-[#00f5d4] pl-2">1. IDENTIFICACIÓN LEGAL - OBLIGATORIO SRI</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] text-white/50">Tipo Identificación</label>
              <select value={form.tipoId} onChange={e => setForm({...form, tipoId: e.target.value as TipoId })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-[11px]">
                {TIPOS_ID.map(t => <option key={t.code} value={t.code}>{t.code} - {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-white/50">N° Identificación ({TIPOS_ID.find(t => t.code === form.tipoId)?.desc}) - Máx {getMaxLength(form.tipoId)}</label>
              <input
                value={form.identificacion}
                maxLength={getMaxLength(form.tipoId)}
                onChange={e => {
                  let val = e.target.value;
                  if (["04", "05", "07"].includes(form.tipoId)) val = val.replace(/[^0-9]/g, "");
                  setForm({...form, identificacion: val });
                }}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-[#00f5d4]"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[9px] text-white/50">Razón Social *</label>
              <input value={form.razonSocial} onChange={e => setForm({...form, razonSocial: e.target.value.toUpperCase() })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-[11px]" placeholder="Como sale en el SRI" />
            </div>
            <div>
              <label className="text-[9px] text-white/50">Nombre Comercial</label>
              <input value={form.nombreComercial} onChange={e => setForm({...form, nombreComercial: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-[11px]" placeholder="Ej: Tienda El Rosadito" />
            </div>
            <div>
              <label className="text-[9px] text-white/50">Tipo Cliente</label>
              <select value={form.tipoCliente} onChange={e => setForm({...form, tipoCliente: e.target.value as any })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-[11px]">
                <option value="NATURAL">Natural</option><option value="JURIDICA">Jurídico / Empresa</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-white/70 border-l-2 border-[#00ff5d] pl-2">2. DATOS DE ENVÍO Y CONTACTO - POR DEFECTO PICHINCHA / QUITO</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[9px] text-white/50">Email (varios separados por coma)</label>
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-[11px]" placeholder="cliente@gmail.com, contador@empresa.com" />
            </div>
            <div>
              <label className="text-[9px] text-white/50">Teléfono / Celular</label>
              <input value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-[11px]" />
            </div>
            <div>
              <label className="text-[9px] text-white/50">Dirección Física Matriz</label>
              <input value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-[11px]" placeholder="Para RIDE y Guía de Remisión" />
            </div>
            <div>
  <label className="text-[9px] text-white/50">Provincia *</label>
  <select value={form.provincia} onChange={e => {
    const nuevaProv = e.target.value;
    const primeraCiudad = PROVINCIAS_MAP[nuevaProv]?.[0] || "QUITO";
    setForm({...form, provincia: nuevaProv, ciudad: primeraCiudad });
  }} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-[11px]">
    {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
  </select>
</div>
<div>
  <label className="text-[9px] text-white/50">Ciudad / Cantón *</label>
  <select value={form.ciudad} onChange={e => setForm({...form, ciudad: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-[11px]">
    {(PROVINCIAS_MAP[form.provincia] || ["QUITO"]).map(c => <option key={c} value={c}>{c}</option>)}
  </select>
</div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-white/70 border-l-2 border-yellow-400 pl-2">3. CONFIGURACIÓN DE CRÉDITO - NIVEL ERP</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[9px] text-white/50">Días Crédito</label>
              <input type="number" value={form.diasCredito} onChange={e => setForm({...form, diasCredito: Number(e.target.value) })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-[11px]" />
            </div>
            <div>
              <label className="text-[9px] text-white/50">Límite Crédito ($)</label>
              <input type="number" value={form.limiteCredito} onChange={e => setForm({...form, limiteCredito: Number(e.target.value) })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-[11px]" />
            </div>
            <div>
              <label className="text-[9px] text-white/50">Categoría / Descuento</label>
              <div className="flex gap-1">
                <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value as any })} className="flex-1 bg-black border border-white/10 rounded-lg px-2 py-2 text-[10px]">
                  <option value="NINGUNO">Ninguno</option><option value="DETALLISTA">Detallista</option><option value="DISTRIBUIDOR">Distribuidor</option><option value="VIP">VIP</option>
                </select>
                <input type="number" value={form.descuento} onChange={e => setForm({...form, descuento: Number(e.target.value) })} placeholder="%" className="w-14 bg-black border border-white/10 rounded-lg px-2 py-2 text-[10px]" />
              </div>
            </div>
          </div>
        </div>

        {/* NUEVO - 4. SUCURSALES */}
        <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="text-[10px] font-bold text-[#00f5d4] border-l-2 border-[#00f5d4] pl-2">4. MATRIZ Y SUCURSALES - SRI (001, 002, 003...)</p>
          <div className="bg-black rounded-xl p-3 border border-white/5 space-y-2">
            {sucursales.length===0 && <p className="text-[10px] text-white/30">Guarda el cliente primero. Se crea automático la 001 MATRIZ PICHINCHA-QUITO.</p>}
            {sucursales.map(s => (
              <div key={s.id} className="flex justify-between items-center bg-[#0f172a] p-2 rounded-lg border border-white/5">
                <div><p className="text-[11px] font-bold">{s.codigo} - {s.nombre} {s.esMatriz && "⭐ MATRIZ"}</p><p className="text-[9px] text-white/50">{s.provincia} - {s.ciudad} - {s.direccion}</p></div>
                <button onClick={()=>handleEliminarSucursal(s.id)} className="text-[10px] text-red-400 border border-red-400/20 px-2 py-1 rounded">Borrar</button>
              </div>
            ))}
            <div className="grid grid-cols-6 gap-2 pt-2">
              <input value={sucForm.codigo} onChange={e=>setSucForm({...sucForm, codigo: e.target.value})} placeholder="002" className="bg-[#0f172a] border border-white/10 rounded px-2 py-2 text-[10px]" />
              <input value={sucForm.nombre} onChange={e=>setSucForm({...sucForm, nombre: e.target.value.toUpperCase()})} placeholder="Nombre" className="col-span-2 bg-[#0f172a] border border-white/10 rounded px-2 py-2 text-[10px]" />
              <input value={sucForm.direccion} onChange={e=>setSucForm({...sucForm, direccion: e.target.value})} placeholder="Dirección sucursal" className="col-span-3 bg-[#0f172a] border border-white/10 rounded px-2 py-2 text-[10px]" />
              
              {/* CAMBIO - PROVINCIA Y CIUDAD CONECTADOS */}
              <select value={sucForm.provincia} onChange={e=>{
                const nuevaProv = e.target.value;
                const primeraCiudad = PROVINCIAS_MAP[nuevaProv]?.[0] || "QUITO";
                setSucForm({...sucForm, provincia: nuevaProv, ciudad: primeraCiudad });
              }} className="bg-[#0f172a] border border-white/10 rounded px-2 py-2 text-[10px]">{PROVINCIAS.map(p=><option key={p} value={p}>{p}</option>)}</select>

              <select value={sucForm.ciudad} onChange={e=>setSucForm({...sucForm, ciudad: e.target.value})} className="bg-[#0f172a] border border-white/10 rounded px-2 py-2 text-[10px]">
                {(PROVINCIAS_MAP[sucForm.provincia] || ["QUITO"]).map(c=><option key={c} value={c}>{c}</option>)}
              </select>

              <input value={sucForm.telefono} onChange={e=>setSucForm({...sucForm, telefono: e.target.value})} placeholder="Tel" className="bg-[#0f172a] border border-white/10 rounded px-2 py-2 text-[10px]" />
              <button onClick={handleGuardarSucursal} className="col-span-6 bg-white/10 border border-[#00f5d4] text-[#00f5d4] text-[10px] py-2 rounded-full font-bold">+ AGREGAR SUCURSAL</button>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleGuardar} className={`flex-1 font-black text-[11px] py-3 rounded-full shadow-[0_0_20px_rgba(0,245,212,0.3)] ${esEdicion ? 'bg-yellow-400 text-black' : 'bg-[#00f5d4] text-black'}`}>
            {esEdicion ? "✓ ACTUALIZAR CLIENTE" : "✓ GUARDAR CLIENTE"}
          </button>
          {esEdicion && (
            <button onClick={handleEliminar} className="px-4 bg-red-500/20 border border-red-500/50 text-red-400 text-[10px] rounded-full font-bold">
              🗑️ ELIMINAR
            </button>
          )}
          <button onClick={() => setForm({ id: "", tipoId: "05", identificacion: "", razonSocial: "", nombreComercial: "", tipoCliente: "NATURAL", email: "", telefono: "", direccion: "", provincia: "PICHINCHA", ciudad: "QUITO", diasCredito: 0, limiteCredito: 0, categoria: "DETALLISTA", descuento: 0 })} className="px-4 bg-white/10 border border-white/20 text-white text-[10px] rounded-full font-bold">
            LIMPIAR
          </button>
        </div>
      </div>
    </div>
  );
}