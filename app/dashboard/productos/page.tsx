"use client";
import { useState, useEffect, useMemo } from "react";
import * as XLSX from 'xlsx';

type TipoItem = "FISICO" | "SERVICIO" | "COMBO" | "FABRICADO";

type Producto = {
  id: string;
  empresa_id: string;
  nombre: string;
  codigo: string;
  codigoAuxiliar: string;
  descripcion: string;
  detalle: string;
  tipoItem: TipoItem;
  tipoIvaSRI: "15%" | "0%" | "EXENTO" | "NO_OBJETO" | "DIFERENCIADO";
  precioSinIVA: number;
  precioMinorista: number;
  precioMayorista: number;
  precioDistribuidor: number;
  costoInicial: number;
  stock: number;
  stockMin: number;
  stockMax: number;
  bodega: string;
  categoria: string;
  unidad: string;
  ubicacion: string;
  fechaVence: string;
  porcIce: number;
  irbpnr: number;
  subsidio: number;
  gravaICE: boolean;
  manejaStock: boolean;
  cuentaContable: string;
  visibleWeb: boolean;
  esCombo: boolean;
  esFabricado: boolean;
  lote: string;
}

interface KardexMov {
  id: string;
  productoId: string;
  fecha: string;
  tipo: "INGRESO" | "EGRESO";
  doc: string;
  motivo: string;
  cant: number;
  saldoAnterior: number;
  saldoNuevo: number;
  usuario: string;
}

const formInicial: Producto = {
  id: "", empresa_id: "EMPRESA_001", nombre: "",
  codigo: "", codigoAuxiliar: "", descripcion: "", detalle: "",
  tipoItem: "FISICO", tipoIvaSRI: "15%",
  precioSinIVA: 0, precioMinorista: 0, precioMayorista: 0, precioDistribuidor: 0,
  costoInicial: 0, stock: 0, stockMin: 5, stockMax: 100,
  bodega: "PRINCIPAL", categoria: "PRINCIPAL", unidad: "UND",
  ubicacion: "", fechaVence: "",
  porcIce: 0, irbpnr: 0, subsidio: 0,
  gravaICE: false, manejaStock: true, cuentaContable: "4.1.01",
  visibleWeb: true, esCombo: false, esFabricado: false, lote: ""
};

export default function ProductosModule() {
  const [empresaId, setEmpresaId] = useState("EMPRESA_001");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargado, setCargado] = useState(false);
  const [productoSel, setProductoSel] = useState<Producto | null>(null);

  const [form, setForm] = useState<Producto>(formInicial);

  const [tab, setTab] = useState<"FICHA" | "KARDEX">("FICHA");
  const [tarifaActiva, setTarifaActiva] = useState<"MINORISTA" | "MAYORISTA" | "DISTRIBUIDOR">("MINORISTA");
  const [busqueda, setBusqueda] = useState("");
  
  const [filtroStock, setFiltroStock] = useState<"TODOS"|"CON"|"SIN"|"BAJO">("TODOS");
  const [filtroIva, setFiltroIva] = useState<"TODOS"|"IVA15"|"IVA0"|"EXENTO">("TODOS");

  const [movimientos, setMovimientos] = useState<KardexMov[]>([]);
  const [bodegas, setBodegas] = useState<string[]>(["PRINCIPAL", "EXHIBICION"]);
  const [fechasKardex, setFechasKardex] = useState({ desde: "", hasta: "" });
  const [ajusteForm, setAjusteForm] = useState({ tipo: "EGRESO", cant: 1, motivo: "Mermas / Daños" });

  // LÓGICA DE UPSERT: Importación inteligente validando duplicados
  const importarDesdeExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target!.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[] = XLSX.utils.sheet_to_json(ws);
      
      const mapeados = data.map((fila:any, i:number) => ({
        id: fila["ID"] && String(fila["ID"]).trim() !== "" ? String(fila["ID"]) : `IMP_${Date.now()}_${i}`,
        empresa_id: empresaId,
        nombre: (fila["Nombre"] || fila["Descripcion"] || "").toString().toUpperCase(),
        codigo: (fila["Codigo_Principal"] || `00${i+1}`).toString(),
        codigoAuxiliar: (fila["Codigo_Auxiliar"] || "").toString(),
        descripcion: (fila["Descripcion"] || "").toString(),
        detalle: (fila["Detalle_Factura"] || "").toString(),
        tipoItem: (fila["Tipo_Item"] || "FISICO") as TipoItem,
        tipoIvaSRI: (fila["Tarifa_IVA_SRI"] || "15%") as any,
        precioSinIVA: Number(fila["Precio_Minorista"] || 0),
        precioMinorista: Number(fila["Precio_Minorista"] || 0),
        precioMayorista: Number(fila["Precio_Mayorista"] || 0),
        precioDistribuidor: Number(fila["Precio_Distribuidor"] || 0),
        costoInicial: Number(fila["Costo_Inicial"] || 0),
        stock: Number(fila["Stock_Actual"] || 0),
        stockMin: Number(fila["Stock_Minimo"] || 5),
        stockMax: Number(fila["Stock_Maximo"] || 100),
        bodega: (fila["Bodega"] || "PRINCIPAL").toString(),
        categoria: "PRINCIPAL",
        unidad: (fila["Unidad_Medida"] || "UND").toString(),
        ubicacion: "",
        fechaVence: "",
        porcIce: Number(fila["Porcentaje_ICE"] || 0),
        irbpnr: 0,
        subsidio: 0,
        gravaICE: fila["Aplica_ICE"] === "SI",
        manejaStock: fila["Maneja_Stock"] !== "NO",
        cuentaContable: "4.1.01",
        visibleWeb: fila["Estado"] !== "INACTIVO",
        esCombo: false,
        esFabricado: false,
        lote: (fila["Lote"] || "").toString()
      })).filter(p => p.nombre !== "");
      
      setProductos(prevProductos => {
        let nuevosProductos = [...prevProductos];
        let actualizados = 0;
        let creados = 0;

        mapeados.forEach(prodEntrante => {
          const indexExistente = nuevosProductos.findIndex(p => p.codigo === prodEntrante.codigo);
          if (indexExistente >= 0) {
            // Actualiza manteniendo el ID original
            nuevosProductos[indexExistente] = { ...prodEntrante, id: nuevosProductos[indexExistente].id };
            actualizados++;
          } else {
            // Es un código nuevo
            nuevosProductos.push(prodEntrante);
            creados++;
          }
        });

        alert(`✅ Proceso Exitoso:\n- ${creados} Productos creados nuevos.\n- ${actualizados} Productos actualizados.`);
        return nuevosProductos;
      });
      
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const exportarAExcel = () => {
    if(productos.length === 0) return alert("No hay nada que exportar");
    const filas = productos.map(p => ({
      ID: p.id, Codigo_Principal: p.codigo, Codigo_Auxiliar: p.codigoAuxiliar,
      Nombre: p.nombre, Descripcion: p.descripcion, Detalle_Factura: p.detalle,
      Tipo_Item: p.tipoItem, Tarifa_IVA_SRI: p.tipoIvaSRI,
      Precio_Minorista: p.precioMinorista, Precio_Mayorista: p.precioMayorista,
      Precio_Distribuidor: p.precioDistribuidor, Costo_Inicial: p.costoInicial,
      Stock_Actual: p.stock, Stock_Minimo: p.stockMin, Stock_Maximo: p.stockMax,
      Maneja_Stock: p.manejaStock ? "SI" : "NO", Aplica_ICE: p.gravaICE ? "SI" : "NO",
      Porcentaje_ICE: p.porcIce, Bodega: p.bodega, Unidad_Medida: p.unidad,
      Lote: p.lote, Estado: p.visibleWeb ? "ACTIVO" : "INACTIVO"
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario_Completo");
    XLSX.writeFile(wb, `Inventario_Maestro_${empresaId}.xlsx`);
  };

  const descargarPlantilla = () => {
    const ws = XLSX.utils.json_to_sheet([{
      ID: "", Codigo_Principal: "PROD-001", Codigo_Auxiliar: "7501031311",
      Nombre: "COCA COLA 500ML", Descripcion: "Gaseosa personal", Detalle_Factura: "Bebida azucarada 500ml",
      Tipo_Item: "FISICO", Tarifa_IVA_SRI: "15%", Precio_Minorista: 1.20, Precio_Mayorista: 1.10,
      Precio_Distribuidor: 1.00, Costo_Inicial: 0.85, Stock_Actual: 100, Stock_Minimo: 10,
      Stock_Maximo: 200, Maneja_Stock: "SI", Aplica_ICE: "NO", Porcentaje_ICE: 0,
      Bodega: "PRINCIPAL", Unidad_Medida: "UND", Lote: "LOTE-2024", Estado: "ACTIVO"
    }]);
    ws['!cols'] = [ {wch:15}, {wch:15}, {wch:15}, {wch:30}, {wch:20}, {wch:25}, {wch:12}, {wch:15}, {wch:15}, {wch:15}, {wch:15}, {wch:12}, {wch:12}, {wch:12}, {wch:12}, {wch:12}, {wch:12}, {wch:15}, {wch:15}, {wch:15}, {wch:15}, {wch:10} ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Migracion");
    XLSX.writeFile(wb, "Plantilla_Migracion_Productos.xlsx");
  };

  useEffect(() => {
    const eid = localStorage.getItem("empresa_id") || "EMPRESA_001";
    setEmpresaId(eid);
    
    const savedBodegas = localStorage.getItem(`bodegas_${eid}`);
    if (savedBodegas) setBodegas(JSON.parse(savedBodegas));
    const savedMovs = localStorage.getItem(`movimientos_${eid}`);
    if (savedMovs) setMovimientos(JSON.parse(savedMovs));

    const saved = localStorage.getItem(`productos_${eid}`);
    if(saved){
      const parsed = JSON.parse(saved);
      const migrados = parsed.map((p:any)=>({
       ...p,
        codigo: p.codigo || "001", codigoAuxiliar: p.codigoAuxiliar || "",
        descripcion: p.descripcion || p.nombre, detalle: p.detalle || "",
        tipoIvaSRI: p.tipoIvaSRI || "15%", stockMax: p.stockMax || 100,
        bodega: p.bodega || "PRINCIPAL", categoria: p.categoria || "PRINCIPAL",
        unidad: p.unidad || "UND", ubicacion: p.ubicacion || "",
        fechaVence: p.fechaVence || "", porcIce: p.porcIce || 0,
        irbpnr: p.irbpnr || 0, subsidio: p.subsidio || 0,
        manejaStock: p.manejaStock ?? true, visibleWeb: p.visibleWeb ?? true,
        esCombo: p.esCombo || false, esFabricado: p.esFabricado || false,
        lote: p.lote || "", precioSinIVA: p.precioMinorista ?? p.precioSinIVA ?? 0,
        precioMayorista: p.precioMayorista ?? 0, precioDistribuidor: p.precioDistribuidor ?? 0,
      }));
      setProductos(migrados);
    } else {
      setProductos([
        { id: "1", empresa_id: eid, nombre: "COCA COLA 500ML", codigo:"001", codigoAuxiliar:"", descripcion:"COCA COLA 500ML", detalle: "", tipoItem: "FISICO", tipoIvaSRI:"15%", precioSinIVA: 1.20, precioMinorista: 1.20, precioMayorista: 1.10, precioDistribuidor: 1.00, costoInicial: 0.85, stock: 100, stockMin: 10, stockMax: 200, bodega:"PRINCIPAL", categoria:"PRINCIPAL", unidad:"UND", ubicacion:"", fechaVence:"", porcIce:0, irbpnr:0, subsidio:0, gravaICE:false, manejaStock:true, cuentaContable:"4.1.01", visibleWeb:true, esCombo:false, esFabricado:false, lote: "" }
      ]);
    }
    
    const hoy = new Date();
    setFechasKardex({ 
      desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0], 
      hasta: new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0] 
    });
    
    setCargado(true);
  }, []);

  useEffect(() => {
    if (!cargado) return;
    localStorage.setItem(`productos_${empresaId}`, JSON.stringify(productos));
    localStorage.setItem(`bodegas_${empresaId}`, JSON.stringify(bodegas));
    localStorage.setItem(`movimientos_${empresaId}`, JSON.stringify(movimientos));
  }, [productos, bodegas, movimientos, empresaId, cargado]);

  const productoSeleccionado = form.id ? form : (productos[0] || formInicial);
  const costo = Number(productoSeleccionado?.costoInicial || 0);
  const precioMinorista = Number(productoSeleccionado?.precioMinorista || 0);
  const precioMayorista = Number(productoSeleccionado?.precioMayorista || 0);
  const precioDistribuidor = Number(productoSeleccionado?.precioDistribuidor || 0);
  const precioActivo = tarifaActiva === "MINORISTA"? precioMinorista : tarifaActiva === "MAYORISTA"? precioMayorista : precioDistribuidor;
  const utilidadReal = precioActivo - costo;
  const margen = precioActivo > 0? (utilidadReal / precioActivo) * 100 : 0;

  const filtrados = useMemo(() => productos.filter(p => {
    const porTexto = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.codigo.toLowerCase().includes(busqueda.toLowerCase());
    const porStock = filtroStock==="TODOS"? true : filtroStock==="CON"? p.stock>0 : filtroStock==="SIN"? p.stock===0 : p.stock <= p.stockMin;
    const porIva = filtroIva==="TODOS"? true : filtroIva==="IVA15"? p.tipoIvaSRI==="15%" : filtroIva==="IVA0"? p.tipoIvaSRI==="0%" : p.tipoIvaSRI==="EXENTO";
    return porTexto && porStock && porIva;
  }), [productos, busqueda, filtroStock, filtroIva]);

  // VALORACIÓN DE INVENTARIO
  const valoracionInventario = useMemo(() => {
    return filtrados.reduce((totales, prod) => {
      if (prod.tipoItem === 'SERVICIO') return totales; // Los servicios no tienen valor de bodega
      return {
        costoTotal: totales.costoTotal + (prod.costoInicial * prod.stock),
        pvpEstimado: totales.pvpEstimado + (prod.precioMinorista * prod.stock)
      };
    }, { costoTotal: 0, pvpEstimado: 0 });
  }, [filtrados]);

  const movimientosFiltrados = useMemo(() => {
    if (!productoSel) return [];
    return movimientos
      .filter(m => m.productoId === productoSel.id)
      .filter(m => {
        if (!fechasKardex.desde && !fechasKardex.hasta) return true;
        if (fechasKardex.desde && m.fecha < fechasKardex.desde) return false;
        if (fechasKardex.hasta && m.fecha > fechasKardex.hasta) return false;
        return true;
      })
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [movimientos, productoSel, fechasKardex]);

  const crearMovimientoKardex = (prodId: string, tipo: "INGRESO"|"EGRESO", cant: number, saldoAnt: number, motivo: string, doc: string) => {
    const mov: KardexMov = {
      id: `MOV_${Date.now()}`, productoId: prodId, fecha: new Date().toISOString().split('T')[0],
      tipo, cant, saldoAnterior: saldoAnt, saldoNuevo: tipo === "INGRESO" ? saldoAnt + cant : saldoAnt - cant,
      motivo, doc, usuario: "Admin"
    };
    setMovimientos(prev => [mov, ...prev]);
  };

  const handleGuardar = () => {
    if (!form.nombre || !form.codigo) return alert("Nombre y Código obligatorios");
    const esNuevo = !form.id;
    const nuevo = {...form, id: form.id || `PROD_${Date.now()}`, empresa_id: empresaId, precioSinIVA: form.precioMinorista, stock: form.tipoItem === "SERVICIO" ? 0 : form.stock };
    
    if (esNuevo) {
      setProductos(ps => [nuevo, ...ps]);
      if (nuevo.stock > 0 && nuevo.tipoItem === "FISICO") {
        crearMovimientoKardex(nuevo.id, "INGRESO", nuevo.stock, 0, "Inventario Inicial", "Apertura de sistema");
      }
    } else {
      setProductos(ps => ps.map(p => p.id === form.id ? nuevo : p));
    }
    setForm(formInicial);
    setProductoSel(null);
  };

  const handleAjusteInventario = () => {
    if (!productoSel) return;
    if (ajusteForm.cant <= 0) return alert("La cantidad debe ser mayor a 0");
    const saldoAnt = productoSel.stock;
    if (ajusteForm.tipo === "EGRESO" && saldoAnt < ajusteForm.cant) return alert("No hay suficiente stock físico disponible para realizar este egreso.");

    const nuevoSaldo = ajusteForm.tipo === "INGRESO" ? saldoAnt + ajusteForm.cant : saldoAnt - ajusteForm.cant;
    setProductos(ps => ps.map(p => p.id === productoSel.id ? { ...p, stock: nuevoSaldo } : p));
    crearMovimientoKardex(productoSel.id, ajusteForm.tipo as any, ajusteForm.cant, saldoAnt, ajusteForm.motivo, "Ajuste Físico");
    setProductoSel({ ...productoSel, stock: nuevoSaldo });
    setAjusteForm({ tipo: "EGRESO", cant: 1, motivo: "Mermas / Daños" });
  };

  const handleCrearBodega = () => {
    const nombre = prompt("Nombre de la nueva bodega (Ej: SUCURSAL NORTE):");
    if (nombre && nombre.trim() !== "") {
      const upper = nombre.trim().toUpperCase();
      if (!bodegas.includes(upper)) setBodegas([...bodegas, upper]);
      setForm({...form, bodega: upper});
    }
  };

  const handleEditar = (prod: Producto) => { setProductoSel(prod); setForm(prod); };
  const handleToggleEstado = (id: string) => { setProductos(ps => ps.map(p => p.id === id ? { ...p, visibleWeb: !p.visibleWeb } : p)); };
  const handleEliminar = (id: string, nombre: string) => {
    if(!confirm(`⚠️ ¿Eliminar "${nombre}" definitivamente?`)) return;
    setProductos(ps => ps.filter(p => p.id !== id));
    if(form.id === id) setForm(formInicial);
  };

  if (!cargado) return <div className="min-h-screen bg-black text-white p-10 text-[11px]">Cargando inventario del sistema...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-4 flex gap-4">
      {/* PANEL IZQUIERDO - FORMULARIO */}
      <div className="w-[35%] bg-[#0f172a]/50 border border-white/10 rounded-xl p-3 space-y-2 overflow-auto shadow-2xl">
        <div className="flex justify-between items-center mb-2">
            <h2 className="text-[#00f5d4] font-black text-[11px] tracking-widest">{form.id ? '✏️ EDITAR PRODUCTO' : '✨ NUEVO PRODUCTO - SRI'}</h2>
            {form.id && (
                <button onClick={() => {setForm(formInicial); setProductoSel(null);}} className="text-[9px] bg-white/10 px-2 py-1 rounded-full hover:bg-red-500/20 hover:text-red-400">✖ Cancelar Edición</button>
            )}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setForm({...form, tipoItem:'FISICO'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black ${form.tipoItem==='FISICO'? 'bg-[#00f5d4] text-black shadow-[0_0_15px_rgba(0,245,212,0.3)]':'bg-black border border-white/10 text-white/50 hover:bg-white/5'}`}>📦 FÍSICO (Inventariable)</button>
          <button onClick={() => setForm({...form, tipoItem:'SERVICIO', stock: 0, stockMin: 0, lote: '', fechaVence: '', bodega: 'SIN BODEGA'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black ${form.tipoItem==='SERVICIO'? 'bg-[#00f5d4] text-black shadow-[0_0_15px_rgba(0,245,212,0.3)]':'bg-black border border-white/10 text-white/50 hover:bg-white/5'}`}>⚙️ SERVICIO (No stock)</button>
        </div>

        <div className="space-y-2">
          <div><label className="text-[9px] text-white/60 font-bold mb-1 block" title="El código interno que usarás para buscar rápido.">Código Principal / SKU *</label><input value={form.codigo} onChange={e=>setForm({...form, codigo:e.target.value})} placeholder="Ej: 001" className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-2 text-[11px] font-bold focus:border-[#00f5d4] outline-none transition-colors" /></div>
          <div><label className="text-[9px] text-white/60 font-bold mb-1 block">Nombre Producto *</label><input value={form.nombre} onChange={e=>setForm({...form, nombre:e.target.value})} placeholder="Ej: COCA COLA 500ML" className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-2 text-[11px] focus:border-[#00f5d4] outline-none transition-colors" /></div>
          <div><label className="text-[9px] text-[#00f5d4]/70 font-bold mb-1 block" title="Este texto extra saldrá impreso en la factura electrónica.">Detalle Adicional (Para impresión/factura)</label><textarea value={form.detalle} onChange={e=>setForm({...form, detalle:e.target.value})} placeholder="Ej: Bebida gaseosa 500ml retornable..." rows={2} className="w-full bg-black border border-[#00f5d4]/30 rounded-lg px-2.5 py-2 text-[11px] resize-none focus:border-[#00f5d4] outline-none transition-colors" /></div>
        </div>

        <div className="pt-3 mt-2 border-t border-white/10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px]">💰</span>
            <label className="text-[9px] text-[#00f5d4] font-black tracking-widest">LISTA MULTI-TARIFA (Precio SIN IVA)</label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-[8px] text-white/50 block mb-1">Precio 1: Minorista</label><input type="number" step="0.01" value={form.precioMinorista} onChange={e=>setForm({...form, precioMinorista:Number(e.target.value)})} className="w-full bg-black border border-[#00f5d4]/50 rounded-lg px-2.5 py-1.5 text-[11px] font-bold focus:border-[#00f5d4] outline-none" /></div>
            <div><label className="text-[8px] text-white/50 block mb-1">Precio 2: Mayorista</label><input type="number" step="0.01" value={form.precioMayorista} onChange={e=>setForm({...form, precioMayorista:Number(e.target.value)})} className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] focus:border-[#00f5d4] outline-none" /></div>
            <div><label className="text-[8px] text-white/50 block mb-1">Precio 3: Distribuidor</label><input type="number" step="0.01" value={form.precioDistribuidor} onChange={e=>setForm({...form, precioDistribuidor:Number(e.target.value)})} className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] focus:border-[#00f5d4] outline-none" /></div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2">
          <div><label className="text-[9px] text-white/60 block mb-1">Costo Inicial ($)</label><input type="number" step="0.01" value={form.costoInicial} onChange={e=>setForm({...form, costoInicial:Number(e.target.value)})} className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-yellow-400 focus:border-[#00f5d4] outline-none" /></div>
          <div className={form.tipoItem==='SERVICIO'? 'opacity-30 pointer-events-none':''}><label className="text-[9px] text-white/60 block mb-1">Stock Actual</label><input type="number" value={form.stock} onChange={e=>setForm({...form, stock:Number(e.target.value)})} disabled={form.id !== "" || form.tipoItem==='SERVICIO'} title={form.id ? "Edite el stock desde el Kárdex" : ""} className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] font-bold focus:border-[#00f5d4] outline-none disabled:opacity-50" /></div>
          <div className={form.tipoItem==='SERVICIO'? 'opacity-30 pointer-events-none':''}><label className="text-[9px] text-white/60 block mb-1" title="El sistema te avisará cuando el stock baje de este número.">Stock Mínimo</label><input type="number" value={form.stockMin} onChange={e=>setForm({...form, stockMin:Number(e.target.value)})} disabled={form.tipoItem==='SERVICIO'} className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] focus:border-[#00f5d4] outline-none" /></div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
          <div><label className="text-[9px] text-white/60 block mb-1" title="Usa tu lector de código de barras aquí.">Cód. Barras / Auxiliar</label><input value={form.codigoAuxiliar} onChange={e=>setForm({...form, codigoAuxiliar:e.target.value})} placeholder="Ej: 75010..." className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] focus:border-[#00f5d4] outline-none" /></div>
          <div><label className="text-[9px] text-white/60 font-bold block mb-1" title="Parámetro estricto para enviar comprobantes electrónicos al SRI.">Tarifa IVA SRI *</label><select value={form.tipoIvaSRI} onChange={e=>setForm({...form, tipoIvaSRI:e.target.value as any})} className="w-full bg-black border border-[#00f5d4]/50 text-[#00f5d4] rounded-lg px-2.5 py-1.5 text-[10px] font-bold outline-none"><option value="15%">IVA 15%</option><option value="0%">IVA 0%</option><option value="EXENTO">EXENTO</option><option value="NO_OBJETO">NO OBJETO</option></select></div>
          
          <div className="flex items-center gap-2 mt-1 bg-white/5 p-1.5 rounded-lg border border-white/5">
            <input type="checkbox" checked={form.gravaICE} onChange={e=>setForm({...form, gravaICE: e.target.checked})} id="chkIce" className="accent-[#00f5d4]" />
            <label htmlFor="chkIce" className="text-[9px] text-white/80 cursor-pointer" title="Marca esto si el producto paga Impuesto a los Consumos Especiales.">Aplica ICE</label>
          </div>
          <div className={!form.gravaICE ? 'opacity-30 pointer-events-none' : ''}>
            <label className="text-[9px] text-white/60 block mb-1">% Porcentaje ICE</label>
            <input type="number" step="0.01" value={form.porcIce} onChange={e=>setForm({...form, porcIce:Number(e.target.value)})} disabled={!form.gravaICE} className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] focus:border-[#00f5d4] outline-none" />
          </div>

          <div><label className="text-[9px] text-white/60 block mb-1">Unidad Medida</label><select value={form.unidad} onChange={e=>setForm({...form, unidad:e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] outline-none"><option value="UND">UND (Unidades)</option><option value="KG">KG (Kilos)</option><option value="LT">LT (Litros)</option><option value="CAJA">CAJA</option></select></div>
          
          <div className={form.tipoItem==='SERVICIO'? 'opacity-30 pointer-events-none':''}>
            <label className="text-[9px] text-white/60 block mb-1">Bodega Asignada</label>
            <div className="flex gap-1">
              <select value={form.bodega} onChange={e=>setForm({...form, bodega:e.target.value})} disabled={form.tipoItem==='SERVICIO'} className="flex-1 bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] outline-none">
                {bodegas.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <button onClick={handleCrearBodega} disabled={form.tipoItem==='SERVICIO'} className="bg-white/10 hover:bg-[#00f5d4] hover:text-black rounded-lg px-2.5 text-[12px] font-bold transition-colors">+</button>
            </div>
          </div>
          
          <div className={form.tipoItem==='SERVICIO'? 'opacity-30 pointer-events-none':''}><label className="text-[9px] text-white/60 block mb-1">Número de Lote</label><input value={form.lote} onChange={e=>setForm({...form, lote:e.target.value})} placeholder="Ej: LOTE-1024" disabled={form.tipoItem==='SERVICIO'} className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] outline-none" /></div>
          <div className={form.tipoItem==='SERVICIO'? 'opacity-30 pointer-events-none':''}><label className="text-[9px] text-white/60 block mb-1">Fecha Caducidad</label><input type="date" value={form.fechaVence} onChange={e=>setForm({...form, fechaVence:e.target.value})} disabled={form.tipoItem==='SERVICIO'} className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] outline-none" /></div>
        </div>
        
        <button onClick={handleGuardar} className="w-full bg-[#00f5d4] text-black font-black text-[12px] py-3 rounded-xl mt-4 hover:shadow-[0_0_20px_rgba(0,245,212,0.4)] transition-all flex justify-center items-center gap-2">
            <span>{form.id ? '💾 GUARDAR CAMBIOS' : '✓ CREAR EN DISCO LOCAL'}</span>
        </button>
      </div>

      {/* PANEL DERECHO - LISTADO / KARDEX */}
      <div className="w-[65%] flex flex-col gap-3">
        <div className="flex gap-2 bg-[#0f172a]/50 p-1.5 rounded-full w-max border border-white/5">
          <button onClick={()=>{setTab("FICHA"); setProductoSel(null);}} className={`px-5 py-2 rounded-full text-[10px] font-bold transition-all ${tab==="FICHA"? "bg-white text-black shadow-lg" : "bg-transparent text-white/50 hover:text-white"}`}>📊 INVENTARIO Y FICHA</button>
          <button onClick={()=>{if(!productoSel) alert("Primero selecciona un producto en la tabla (icono ⚙️) para ver su Kárdex"); else setTab("KARDEX");}} className={`px-5 py-2 rounded-full text-[10px] font-bold transition-all ${tab==="KARDEX"? "bg-[#00f5d4] text-black shadow-[0_0_15px_rgba(0,245,212,0.3)]" : "bg-transparent text-white/50 hover:text-white"}`}>📋 KÁRDEX: {productoSel ? productoSel.nombre : "Seleccione ítem"}</button>
        </div>

       {tab==="FICHA" && (
        <div className="flex flex-col gap-3 h-full">
          {/* FICHA RESUMEN FINANCIERA */}
          <div className="bg-[#0f172a]/50 border border-white/10 rounded-xl p-4 shadow-lg">
            <div className="grid grid-cols-3 gap-3">
              <div onClick={()=>setTarifaActiva("MINORISTA")} className={`bg-black border rounded-xl p-3 cursor-pointer transition-all ${tarifaActiva==="MINORISTA"? "border-[#00f5d4] shadow-[0_0_15px_rgba(0,245,212,0.15)] scale-[1.02]" : "border-white/5 hover:border-white/20"}`}>
                <p className="text-[9px] text-white/40 font-bold mb-1">MINORISTA (Sin IVA)</p>
                <p className="text-[24px] font-black text-white">${(productoSeleccionado.precioMinorista||0).toFixed(2)}</p>
                <div className="flex justify-between mt-2 pt-2 border-t border-white/5">
                  <p className="text-[9px] text-[#00f5d4] font-bold" title="Precio final cobrado en caja">PVP IVA: ${((productoSeleccionado.precioMinorista||0)*1.15).toFixed(2)}</p>
                  <p className="text-[9px] text-white/50">Ganas: ${((productoSeleccionado.precioMinorista||0) - costo).toFixed(2)}</p>
                </div>
              </div>
              
              <div onClick={()=>setTarifaActiva("MAYORISTA")} className={`bg-black border rounded-xl p-3 cursor-pointer transition-all ${tarifaActiva==="MAYORISTA"? "border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.15)] scale-[1.02]" : "border-white/5 hover:border-white/20"}`}>
                <p className="text-[9px] text-yellow-400/60 font-bold mb-1">MAYORISTA (Sin IVA)</p>
                <p className="text-[24px] font-black text-yellow-400">${(productoSeleccionado.precioMayorista||0).toFixed(2)}</p>
                <div className="flex justify-between mt-2 pt-2 border-t border-white/5">
                  <p className="text-[9px] text-white/70">PVP IVA: ${((productoSeleccionado.precioMayorista||0)*1.15).toFixed(2)}</p>
                  <p className="text-[9px] text-white/50">Ganas: ${((productoSeleccionado.precioMayorista||0) - costo).toFixed(2)}</p>
                </div>
              </div>
              
              <div onClick={()=>setTarifaActiva("DISTRIBUIDOR")} className={`bg-black border rounded-xl p-3 cursor-pointer transition-all ${tarifaActiva==="DISTRIBUIDOR"? "border-white shadow-[0_0_15px_rgba(255,255,255,0.15)] scale-[1.02]" : "border-white/5 hover:border-white/20"}`}>
                <p className="text-[9px] text-white/40 font-bold mb-1">DISTRIBUIDOR (Sin IVA)</p>
                <p className="text-[24px] font-black text-white">${(productoSeleccionado.precioDistribuidor||0).toFixed(2)}</p>
                <div className="flex justify-between mt-2 pt-2 border-t border-white/5">
                  <p className="text-[9px] text-white/70">PVP IVA: ${((productoSeleccionado.precioDistribuidor||0)*1.15).toFixed(2)}</p>
                  <p className="text-[9px] text-white/50">Ganas: ${((productoSeleccionado.precioDistribuidor||0) - costo).toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-black to-[#00f5d4]/5 border border-[#00f5d4]/20 rounded-xl p-3 mt-3 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-[#00f5d4]">UTILIDAD REAL Y MARGEN (Tarifa: {tarifaActiva})</p>
                <p className="text-[11px] text-white/50 mt-1">Precio ${precioActivo.toFixed(2)} - Costo${costo.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-[20px] font-black">${utilidadReal.toFixed(2)}</p>
                <div className="w-full bg-black/50 h-1.5 rounded-full mt-1.5 w-[100px] overflow-hidden flex justify-end">
                  <div className="h-full bg-yellow-400 transition-all" style={{ width: `${Math.min(margen,100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#0f172a]/50 border border-white/10 rounded-xl p-3 flex-1 flex flex-col min-h-0">
            <div className="flex gap-2 items-center mb-3">
              <div className="relative flex-1">
                <input value={busqueda} onChange={(e)=>setBusqueda(e.target.value)} placeholder="Buscar artículo por nombre o código..." className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 pl-8 text-[11px] text-white focus:border-[#00f5d4] outline-none" />
                <span className="absolute left-3 top-2.5 text-[10px] opacity-50">🔍</span>
              </div>
              
              <select value={filtroStock} onChange={(e)=>setFiltroStock(e.target.value as any)} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-[10px] outline-none focus:border-[#00f5d4]">
                <option value="TODOS">Todo el Stock</option>
                <option value="CON">Con Stock (+)</option>
                <option value="SIN">Sin Stock (0)</option>
                <option value="BAJO">Stock Crítico</option>
              </select>
              
              <select value={filtroIva} onChange={(e)=>setFiltroIva(e.target.value as any)} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-[10px] outline-none focus:border-[#00f5d4]">
                <option value="TODOS">Todos los IVA</option>
                <option value="IVA15">Solo IVA 15%</option>
                <option value="IVA0">Solo IVA 0%</option>
                <option value="EXENTO">Solo Exentos</option>
              </select>

              <div className="flex gap-1 bg-black p-1 rounded-lg border border-white/5">
                <button title="📥 Descargar plantilla Excel vacía para migrar productos desde otro sistema" onClick={descargarPlantilla} className="bg-white/10 hover:bg-[#00f5d4] hover:text-black text-white rounded-md p-1.5 text-[12px] transition-colors">📥</button>
                <div className="relative overflow-hidden cursor-pointer bg-white/10 hover:bg-blue-500 hover:text-white rounded-md p-1.5 transition-colors" title="📂 Importar productos masivamente desde el Excel de migración llenado">
                   <span className="text-[12px]">📂</span>
                   <input type="file" accept=".xlsx, .xls" onChange={importarDesdeExcel} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                <button title="📤 Exportar todo el listado actual a Excel con todos los parámetros completos" onClick={exportarAExcel} className="bg-white/10 hover:bg-yellow-400 hover:text-black text-white rounded-md p-1.5 text-[12px] transition-colors">📤</button>
              <button 
  title="🚨 Eliminar TODO el inventario" 
  onClick={() => {
    if(confirm("🚨 PELIGRO EXTREMO: ¿Estás seguro de eliminar TODO el inventario y el Kárdex de forma permanente?")) {
      setProductos([]);
      setMovimientos([]);
      localStorage.removeItem(`productos_${empresaId}`);
      localStorage.removeItem(`movimientos_${empresaId}`);
    }
  }} 
  className="bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 rounded-md p-1.5 text-[12px] transition-colors"
>
  🚨
</button>
              </div>
            </div>

            <div className="bg-[#00f5d4]/10 border border-[#00f5d4]/20 rounded-lg p-2 mb-3 flex items-start gap-2">
              <span className="text-[12px]">💡</span>
              <p className="text-[9px] text-[#00f5d4]/90 leading-tight">
                <strong>Modo Chismoso Activo:</strong> Pasa el mouse sobre los encabezados de la tabla (como <em>IVA, ICE, %ICE, #Stock, Estado, Acciones</em>) o sobre los botones para ver explicaciones detalladas.
              </p>
            </div>

            <div className="bg-black border border-white/10 rounded-lg overflow-hidden flex-1 flex flex-col">
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <table className="w-full text-[9px] text-left border-collapse whitespace-nowrap">
                  <thead className="bg-[#11131a] sticky top-0 z-10 shadow-md">
                    <tr className="text-white/40 uppercase tracking-wider text-[8px]">
                      <th className="p-2.5 font-bold cursor-help" title="Identificador único">Id</th>
                      <th className="p-2.5 font-bold cursor-help" title="Código Principal">Codigo</th>
                      <th className="p-2.5 font-bold min-w-[140px] cursor-help" title="Nombre comercial">Nombre</th>
                      <th className="p-2.5 font-bold text-right cursor-help" title="Precio Minorista SIN IVA">Precio</th>
                      <th className="p-2.5 font-bold text-right cursor-help" title="Precio Mayorista SIN IVA">Precio2</th>
                      <th className="p-2.5 font-bold text-right cursor-help" title="Precio Distribuidor SIN IVA">Precio3</th>
                      <th className="p-2.5 font-bold text-center cursor-help border-l border-white/5" title="Tarifa impositiva SRI">Iva</th>
                      <th className="p-2.5 font-bold text-center cursor-help" title="¿Aplica ICE?">Ice</th>
                      <th className="p-2.5 font-bold text-center cursor-help" title="Porcentaje de ICE">%Ice</th>
                      <th className="p-2.5 font-bold text-center cursor-help border-l border-white/5" title="Stock actual">Stock</th>
                      <th className="p-2.5 font-bold text-center cursor-help" title="Stock Mínimo">#Stock</th>
                      <th className="p-2.5 font-bold text-center cursor-help border-l border-white/5" title="Activar/Ocultar">Estado</th>
                      <th className="p-2.5 font-bold text-center cursor-help" title="Herramientas">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtrados.length === 0 ? (
                      <tr><td colSpan={13} className="text-center p-8 text-white/30 text-[11px]">No hay productos que coincidan con la búsqueda.</td></tr>
                    ) : (
                      filtrados.map((prod) => (
                        <tr key={prod.id} className="hover:bg-white/5 group transition-colors cursor-pointer" onClick={() => setProductoSel(prod)}>
                          <td className="p-2.5 text-white/30 font-mono text-[8px]">{prod.id.length > 8 ? prod.id.slice(-6) : prod.id}</td>
                          <td className="p-2.5 font-bold text-white">{prod.codigo}</td>
                          <td className="p-2.5 truncate max-w-[150px] text-white/90" title={prod.nombre}>{prod.nombre}</td>
                          <td className="p-2.5 text-right text-[#00f5d4] font-bold">${prod.precioMinorista.toFixed(2)}</td>
                          <td className="p-2.5 text-right text-yellow-400 font-bold">${prod.precioMayorista.toFixed(2)}</td>
                          <td className="p-2.5 text-right text-white/80">${prod.precioDistribuidor.toFixed(2)}</td>
                          
                          <td className="p-2.5 text-center border-l border-white/5">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${prod.tipoIvaSRI === '15%' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                              {prod.tipoIvaSRI}
                            </span>
                          </td>
                          <td className="p-2.5 text-center text-white/50">{prod.gravaICE ? "✅" : "—"}</td>
                          <td className="p-2.5 text-center text-white/50">{prod.porcIce > 0 ? `${prod.porcIce}%` : "—"}</td>
                          
                          <td className="p-2.5 text-center font-bold border-l border-white/5">
                            {(() => {
                              if (prod.tipoItem === 'SERVICIO') {
                                return <span className="text-white/30" title="Servicio sin stock">—</span>;
                              }
                              if (prod.stock === 0) {
                                return <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-[9px] shadow-[0_0_8px_rgba(239,68,68,0.3)] animate-pulse" title="Sin Stock (Agotado)">0</span>;
                              }
                              if (prod.stock <= prod.stockMin) {
                                return <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded text-[9px]" title="Reponer pronto (Stock Crítico)">{prod.stock}</span>;
                              }
                              return <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-[9px]" title="Stock Óptimo">{prod.stock}</span>;
                            })()}
                          </td>
                          <td className="p-2.5 text-center text-white/30">{prod.tipoItem === 'SERVICIO' ? '—' : prod.stockMin}</td>
                          
                          <td className="p-2.5 text-center border-l border-white/5">
                            <button 
                              title={`Clic para ${prod.visibleWeb ? 'Ocultar' : 'Activar'}`}
                              onClick={(e) => { e.stopPropagation(); handleToggleEstado(prod.id); }}
                              className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all border ${prod.visibleWeb ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"}`}
                            >
                              {prod.visibleWeb ? "ACTIVO" : "INACTIVO"}
                            </button>
                          </td>
                          
                          <td className="p-2.5">
                            <div className="flex gap-1.5 justify-center opacity-40 group-hover:opacity-100 transition-opacity">
                              <button title="✏️ Editar" onClick={(e) => { e.stopPropagation(); handleEditar(prod); }} className="bg-white/10 hover:bg-[#00f5d4] hover:text-black rounded p-1 text-[11px] transition-colors">✏️</button>
                              <button title="⚙️ Kárdex / Movimientos" onClick={(e) => { e.stopPropagation(); setProductoSel(prod); setTab("KARDEX"); }} className="bg-white/10 hover:bg-white hover:text-black rounded p-1 text-[11px] transition-colors">⚙️</button>
                              <button title="🗑️ Eliminar" onClick={(e) => { e.stopPropagation(); handleEliminar(prod.id, prod.nombre); }} className="bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded p-1 text-[11px] transition-colors">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* REPORTE DE VALORACIÓN VISUAL */}
              <div className="bg-[#11131a] border-t border-white/5 p-2.5 text-[9px] text-white/40 flex justify-between items-center">
                <span>Total ítems listados: {filtrados.length}</span>
                <div className="flex gap-4">
                  <span title="Dinero invertido en bodega" className="cursor-help flex items-center gap-1">
                    Capital Invertido: <span className="text-yellow-400 font-bold text-[10px]">${valoracionInventario.costoTotal.toFixed(2)}</span>
                  </span>
                  <span title="Venta proyectada si vendes todo al Precio 1" className="cursor-help flex items-center gap-1">
                    Venta Proyectada: <span className="text-[#00f5d4] font-bold text-[10px]">${valoracionInventario.pvpEstimado.toFixed(2)}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
        
        {tab==="KARDEX" && productoSel && (
          <div className="flex flex-col gap-3 h-full">
            <div className="bg-gradient-to-r from-[#0f172a] to-[#11131a] border border-white/10 rounded-xl p-4 shadow-lg flex gap-4 items-center">
              <div className="w-1/3 border-r border-white/10 pr-4">
                <p className="text-[10px] text-[#00f5d4] font-bold mb-1">STOCK ACTUAL (BODEGA {productoSel.bodega})</p>
                <p className="text-[32px] font-black leading-none">{productoSel.tipoItem === 'SERVICIO' ? '—' : productoSel.stock} <span className="text-[12px] text-white/40 font-normal">{productoSel.tipoItem === 'SERVICIO' ? 'ILIMITADO' : productoSel.unidad}</span></p>
              </div>
              <div className={`flex-1 grid grid-cols-4 gap-2 items-end ${productoSel.tipoItem === 'SERVICIO' ? 'opacity-30 pointer-events-none' : ''}`}>
                <div className="col-span-4 mb-[-4px]"><p className="text-[9px] text-yellow-400 font-bold uppercase tracking-wider">Auditoría: Ajuste Manual de Inventario</p></div>
                <div>
                  <label className="text-[8px] text-white/50 block mb-1">Tipo de Ajuste</label>
                  <select value={ajusteForm.tipo} onChange={e=>setAjusteForm({...ajusteForm, tipo: e.target.value})} className={`w-full bg-black border rounded px-2 py-1.5 text-[10px] font-bold outline-none ${ajusteForm.tipo === 'INGRESO' ? 'border-green-500/50 text-green-400' : 'border-red-500/50 text-red-400'}`}>
                    <option value="INGRESO">▲ INGRESO (+)</option>
                    <option value="EGRESO">▼ EGRESO (-)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] text-white/50 block mb-1">Cantidad</label>
                  <input type="number" min="1" value={ajusteForm.cant} onChange={e=>setAjusteForm({...ajusteForm, cant: Number(e.target.value)})} className="w-full bg-black border border-white/10 rounded px-2 py-1.5 text-[11px] font-bold outline-none" />
                </div>
                <div>
                  <label className="text-[8px] text-white/50 block mb-1">Motivo Obligatorio</label>
                  <select value={ajusteForm.motivo} onChange={e=>setAjusteForm({...ajusteForm, motivo: e.target.value})} className="w-full bg-black border border-white/10 rounded px-2 py-1.5 text-[10px] outline-none">
                    {ajusteForm.tipo === 'INGRESO' ? (
                      <><option>Sobrante de Inventario</option><option>Devolución sin factura</option><option>Ajuste Inicial</option><option>Traspaso Bodega</option></>
                    ) : (
                      <><option>Mermas / Daños</option><option>Caducidad / Vencimiento</option><option>Robo / Pérdida</option><option>Consumo Interno</option><option>Traspaso Bodega</option></>
                    )}
                  </select>
                </div>
                <button onClick={handleAjusteInventario} className="bg-white/10 hover:bg-yellow-400 hover:text-black text-white font-bold text-[10px] py-1.5 rounded transition-colors h-[28px]">
                  Procesar Ajuste
                </button>
              </div>
            </div>

            <div className="bg-[#0f172a]/50 border border-white/10 rounded-xl p-3 flex-1 flex flex-col min-h-0 shadow-lg">
              <div className="flex justify-between items-end mb-3 pb-3 border-b border-white/10">
                <h3 className="text-[12px] font-bold text-[#00f5d4] flex items-center gap-2"><span>📋</span> Libro Mayor de Movimientos</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-white/50">Filtrar Rango:</span>
                  <input type="date" value={fechasKardex.desde} onChange={e=>setFechasKardex({...fechasKardex, desde: e.target.value})} className="bg-black border border-white/10 rounded px-2 py-1 text-[10px] outline-none text-white/70" />
                  <span className="text-[9px] text-white/30">hasta</span>
                  <input type="date" value={fechasKardex.hasta} onChange={e=>setFechasKardex({...fechasKardex, hasta: e.target.value})} className="bg-black border border-white/10 rounded px-2 py-1 text-[10px] outline-none text-white/70" />
                  <button onClick={() => setFechasKardex({desde: "", hasta: ""})} className="text-[9px] text-[#00f5d4] hover:underline ml-1">Quitar filtro</button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 bg-black rounded-lg border border-white/5">
                <table className="w-full text-[9px] text-left">
                  <thead className="bg-[#11131a] sticky top-0 z-10">
                    <tr className="text-white/40 uppercase tracking-wider text-[8px]">
                      <th className="p-2.5">Fecha</th>
                      <th className="p-2.5">Documento / Sustento</th>
                      <th className="p-2.5">Motivo</th>
                      <th className="p-2.5 text-center border-l border-white/5">Entrada</th>
                      <th className="p-2.5 text-center border-l border-white/5">Salida</th>
                      <th className="p-2.5 text-center border-l border-white/5 bg-[#00f5d4]/5 text-[#00f5d4] font-bold">Saldo Físico</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {movimientosFiltrados.length === 0 ? (
                      <tr><td colSpan={6} className="text-center p-6 text-white/30">No hay movimientos registrados en este rango de fechas.</td></tr>
                    ) : (
                      movimientosFiltrados.map((mov) => (
                        <tr key={mov.id} className="hover:bg-white/5">
                          <td className="p-2.5 text-white/70">{mov.fecha}</td>
                          <td className="p-2.5 font-mono text-white/50">{mov.doc}</td>
                          <td className="p-2.5 text-white/90">{mov.motivo}</td>
                          <td className="p-2.5 text-center text-green-400 font-bold border-l border-white/5">{mov.tipo === 'INGRESO' ? `+${mov.cant}` : ''}</td>
                          <td className="p-2.5 text-center text-red-400 font-bold border-l border-white/5">{mov.tipo === 'EGRESO' ? `-${mov.cant}` : ''}</td>
                          <td className="p-2.5 text-center font-bold border-l border-white/5 bg-[#00f5d4]/5">{mov.saldoNuevo}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}