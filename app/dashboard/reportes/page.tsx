"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

export default function ReporteVendedoresPage() {
  const router = useRouter();
  const [vendedorSel, setVendedorSel] = useState("carlos");
  const [fechaDesde, setFechaDesde] = useState("2026-10-01");
  const [fechaHasta, setFechaHasta] = useState("2026-10-31");
  
  // === NUEVOS FILTROS QUE PEDISTE ===
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroProducto, setFiltroProducto] = useState("");

  // --- DATA MAESTRA CON PRODUCTOS ---
  const facturasBase = [
    { fecha: "2026-10-05", secuencial: "001-002-000000147", cliente: "Importadora Andina", ruc: "1792134567001", monto: 3283.33, vendedor: "carlos", productos: "ARROZ 50KG, ACEITE LA FAVORITA" },
    { fecha: "2026-10-12", secuencial: "001-002-000000152", cliente: "Comercial Tena", ruc: "1500345678001", monto: 1250.50, vendedor: "carlos", productos: "AZUCAR, FIDEO DON VITTORIO" },
    { fecha: "2026-10-15", secuencial: "001-002-000000160", cliente: "Distribuidora Orellana", ruc: "2200123456001", monto: 4500.00, vendedor: "yolanda", productos: "ARROZ 50KG, COLA 3L" },
    { fecha: "2026-10-20", secuencial: "001-002-000000165", cliente: "Supermercado Napo", ruc: "1500234567001", monto: 890.00, vendedor: "yolanda", productos: "ACEITE LA FAVORITA" },
  ];

  // === MOTOR EN CALIENTE CON 5 CONDICIONES ===
  const facturas = useMemo(() => {
    return facturasBase.filter((f) => {
      const cumpleVendedor = f.vendedor === vendedorSel;
      const cumpleDesde = f.fecha >= fechaDesde;
      const cumpleHasta = f.fecha <= fechaHasta;
      const cumpleCliente = filtroCliente === "" ? true : 
        f.cliente.toLowerCase().includes(filtroCliente.toLowerCase()) || 
        f.ruc.includes(filtroCliente);
      const cumpleProducto = filtroProducto === "" ? true : 
        f.productos.toLowerCase().includes(filtroProducto.toLowerCase());
      
      return cumpleVendedor && cumpleDesde && cumpleHasta && cumpleCliente && cumpleProducto;
    });
  }, [vendedorSel, fechaDesde, fechaHasta, filtroCliente, filtroProducto]);

  const carteraClientes = useMemo(() => {
    const agrupado: any = {};
    facturas.forEach((f) => {
      if (!agrupado[f.ruc]) agrupado[f.ruc] = { ruc: f.ruc, nombre: f.cliente, comprasRealizadas: 0, totalAcumulado: 0 };
      agrupado[f.ruc].comprasRealizadas += 1;
      agrupado[f.ruc].totalAcumulado += f.monto;
    });
    const total = facturas.reduce((s, f) => s + f.monto, 0);
    return Object.values(agrupado).map((c: any) => ({
      ...c,
      participacion: total > 0 ? `${((c.totalAcumulado / total) * 100).toFixed(0)}%` : "0%",
    })).sort((a:any,b:any)=> b.totalAcumulado - a.totalAcumulado);
  }, [facturas]);

  const totalFacturado = facturas.reduce((s, f) => s + f.monto, 0);
  const comisionPorcentaje = vendedorSel === "carlos" ? 2 : 3;
  const totalComision = totalFacturado * (comisionPorcentaje / 100);

  const exportar = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(facturas), "Facturas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(carteraClientes as any), "Cartera");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte_${vendedorSel}_${fechaDesde}_al_${fechaHasta}.xlsx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="min-h-screen bg-[#060608] text-white p-4 font-sans select-none">
      <div className="mb-4">
        <button onClick={()=>router.back()} className="bg-white/10 text-white border border-white/5 px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/20 transition-all">
          ← Volver al Dashboard
        </button>
      </div>

      {/* FILTROS SUPERIORES - ORIGINAL */}
      <div className="bg-[#11131a] rounded-[20px] p-4 border border-white/5 flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 flex-1">
          <select value={vendedorSel} onChange={(e) => setVendedorSel(e.target.value)} className="bg-black border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-[#00f5d4] font-bold min-w-[280px]">
            <option value="carlos">Carlos (Preventa Sierra)</option>
            <option value="yolanda">Yolanda Velarde (Ruta Centro)</option>
          </select>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#00f5d4] font-mono" />
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#00f5d4] font-mono" />
        </div>
        <button onClick={exportar} className="bg-[#00f5d4] text-black font-black px-5 py-3 rounded-xl text-xs hover:bg-[#00d4b8] transition-all tracking-wider uppercase">
          EXPORTAR EXCEL
        </button>
      </div>

      {/* === BARRA NUEVA QUE PEDISTE - BUSQUEDA POR CLIENTE Y PRODUCTO === */}
      <div className="bg-[#11131a] rounded-[20px] p-3 border border-[#00f5d4]/20 flex items-center gap-3 mb-4">
        <span className="text-[9px] bg-[#00f5d4]/20 text-[#00f5d4] px-2 py-1 rounded font-black">FILTRO FINO</span>
        <div className="relative flex-1">
          <input value={filtroCliente} onChange={e=> setFiltroCliente(e.target.value)} placeholder="🔍 Buscar por CLIENTE o RUC... Ej: Andina / 1792..." className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#00f5d4]"/>
        </div>
        <div className="relative flex-1">
          <input value={filtroProducto} onChange={e=> setFiltroProducto(e.target.value)} placeholder="📦 Buscar por PRODUCTO... Ej: Arroz / Aceite" className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-yellow-400"/>
        </div>
        {(filtroCliente || filtroProducto) && (
          <button onClick={()=>{setFiltroCliente(""); setFiltroProducto("")}} className="text-[10px] bg-red-500/20 text-red-400 px-3 py-2 rounded-xl border border-red-500/20">LIMPIAR</button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-[#11131a] border border-white/5 rounded-2xl p-4">
          <p className="text-[9px] text-white/40 font-bold tracking-widest uppercase">TOTAL FACTURADO</p>
          <p className="text-2xl font-black mt-1 font-mono">${totalFacturado.toFixed(2)}</p>
        </div>
        <div className="bg-[#11131a] border border-white/5 rounded-2xl p-4 bg-gradient-to-br from-[#11131a] to-[#00f5d4]/5">
          <p className="text-[9px] text-[#00f5d4] font-bold tracking-widest uppercase">COMISIÓN {comisionPorcentaje}%</p>
          <p className="text-2xl font-black mt-1 font-mono text-[#00f5d4]">${totalComision.toFixed(2)}</p>
        </div>
        <div className="bg-[#11131a] border border-white/5 rounded-2xl p-4">
          <p className="text-[9px] text-white/40 font-bold tracking-widest uppercase">DOCUMENTOS</p>
          <p className="text-2xl font-black mt-1 font-mono">{facturas.length}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-7 bg-[#11131a] rounded-[20px] p-4 border border-white/5 space-y-3">
          <p className="text-[10px] font-bold text-white/50 tracking-wider uppercase border-b border-white/5 pb-2">
            Histórico Detallado de Comprobantes {filtroCliente || filtroProducto ? `(${facturas.length} filtrados)` : ""}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-left font-mono">
                  <th className="p-2">FECHA</th>
                  <th className="p-2">SECUENCIAL</th>
                  <th className="p-2">CLIENTE</th>
                  <th className="p-2">PRODUCTO</th>
                  <th className="p-2 text-right">MONTO</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f, i) => (
                  <tr key={i} className="border-b border-white/5 text-white/80 hover:bg-white/5 transition-colors">
                    <td className="p-2 font-mono text-white/40">{f.fecha.replace(/-/g, ' ')}</td>
                    <td className="p-2 font-mono text-[#00f5d4] font-bold">{f.secuencial}</td>
                    <td className="p-2 font-bold">{f.cliente}</td>
                    <td className="p-2 text-[9px] text-white/50 max-w-[120px] truncate">{f.productos}</td>
                    <td className="p-2 text-right font-mono font-bold text-white">${f.monto.toFixed(2)}</td>
                  </tr>
                ))}
                {facturas.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-white/30">🔍 Sin resultados - prueba con otro cliente o producto</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:col-span-5 bg-[#11131a] rounded-[20px] p-4 border border-white/5 space-y-3">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <p className="text-[10px] font-bold text-[#ffbe0a] tracking-wider uppercase">Ranking de Cartera y Clientes Estrella</p>
            <span className="text-[8px] bg-[#ffbe0a]/10 text-[#ffbe0a] px-2 py-0.5 rounded font-bold border border-[#ffbe0a]/20">ACUMULADO</span>
          </div>
          <div className="space-y-2 overflow-y-auto max-h-[300px]">
            {carteraClientes.map((c, i) => (
              <div key={i} className="flex justify-between items-center bg-black/30 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-white/5 text-white/70 font-black text-[9px] grid place-items-center border border-white/10">{c.nombre.charAt(0)}</span>
                    <h5 className="text-xs font-black tracking-tight">{c.nombre}</h5>
                  </div>
                  <p className="text-[9px] text-white/40 font-mono pl-7">RUC: {c.ruc} | Frecuencia: {c.comprasRealizadas} vta</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black font-mono text-white">${c.totalAcumulado.toFixed(2)}</span>
                  <p className="text-[9px] text-[#ffbe0a] font-bold mt-0.5">{c.participacion} Participación</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}