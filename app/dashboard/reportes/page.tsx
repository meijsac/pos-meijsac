"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

type Factura = { id: string; fecha: string; secuencial: string; cliente: string; ruc: string; monto: number; usuarioId: string; vendedor: string; caja: string; productos: string; efectivo: number; tarjeta: number; transferencia: number }
type Persona = { usuarioId: string; nombre: string; total?: number; documentos?: number; nuevos?: number; comprado?: number }
type Caja = { caja: string; efectivo: number; tarjeta: number; transferencia: number; total: number }

function hoy() {
  const fecha = new Date()
  const mes = String(fecha.getMonth() + 1).padStart(2, "0")
  const dia = String(fecha.getDate()).padStart(2, "0")
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

export default function ReporteVendedoresPage() {
  const router = useRouter();
  const [vendedorSel, setVendedorSel] = useState("");
  const [fechaDesde, setFechaDesde] = useState(`${hoy().slice(0, 8)}01`);
  const [fechaHasta, setFechaHasta] = useState(hoy());
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroProducto, setFiltroProducto] = useState("");
  const [tipoDoc, setTipoDoc] = useState("01");
  const [facturasBase, setFacturasBase] = useState<Factura[]>([]);
  const [notasBase, setNotasBase] = useState<Factura[]>([]);
  const [proformasBase, setProformasBase] = useState<Factura[]>([]);
  const [trabajadores, setTrabajadores] = useState<{ id: string; nombre: string }[]>([]);
  const [porCaja, setPorCaja] = useState<Caja[]>([]);
  const [captacion, setCaptacion] = useState<Persona[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true
    setCargando(true)
    const params = new URLSearchParams({ desde: fechaDesde, hasta: fechaHasta })
    if (vendedorSel) params.set("usuarioId", vendedorSel)
    fetch(`/api/reportes/pos?${params}`, { credentials: "same-origin" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!vivo || !data) return
        setFacturasBase(Array.isArray(data.facturas) ? data.facturas : [])
        setNotasBase(Array.isArray(data.notas) ? data.notas : [])
        setTrabajadores(Array.isArray(data.trabajadores) ? data.trabajadores : [])
        setPorCaja(Array.isArray(data.porCaja) ? data.porCaja : [])
        setCaptacion(Array.isArray(data.captacion) ? data.captacion : [])
      })
      .catch(() => {})
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [vendedorSel, fechaDesde, fechaHasta]);

  useEffect(() => {
    if (tipoDoc !== "PROFORMA") return
    let vivo = true
    fetch("/api/proformas", { credentials: "same-origin" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (!vivo || !Array.isArray(data)) return
        setProformasBase(data.map((fila) => ({
          id: String(fila.id),
          fecha: String(fila.creada || "").slice(0, 10),
          secuencial: String(fila.numero || ""),
          cliente: String(fila.cliente || ""),
          ruc: "",
          monto: Number(fila.total) || 0,
          usuarioId: "",
          vendedor: String(fila.vendedor || ""),
          caja: "",
          productos: "",
          efectivo: 0,
          tarjeta: 0,
          transferencia: 0,
        })))
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [tipoDoc]);

  const coincide = (f: Factura) => {
    const cumpleCliente = filtroCliente === "" ? true : f.cliente.toLowerCase().includes(filtroCliente.toLowerCase()) || f.ruc.includes(filtroCliente);
    const cumpleProducto = filtroProducto === "" ? true : f.productos.toLowerCase().includes(filtroProducto.toLowerCase());
    return cumpleCliente && cumpleProducto;
  }
  const facturas = useMemo(() => facturasBase.filter(coincide), [facturasBase, filtroCliente, filtroProducto]);
  const notas = useMemo(() => notasBase.filter(coincide), [notasBase, filtroCliente, filtroProducto]);
  const proformas = useMemo(() => {
    const nombre = trabajadores.find((t) => t.id === vendedorSel)?.nombre || ""
    return proformasBase.filter((f) => {
      if (f.fecha && (f.fecha < fechaDesde || f.fecha > fechaHasta)) return false
      if (nombre && f.vendedor !== nombre) return false
      return coincide(f)
    })
  }, [proformasBase, fechaDesde, fechaHasta, vendedorSel, trabajadores, filtroCliente, filtroProducto]);
  const documentos = tipoDoc === "04" ? notas : tipoDoc === "PROFORMA" ? proformas : facturas
  const tituloTotal = tipoDoc === "04" ? "TOTAL NOTAS DE CRÉDITO" : tipoDoc === "PROFORMA" ? "TOTAL PROFORMAS" : "TOTAL FACTURADO"
  const vacio = tipoDoc === "04" ? "Sin notas de crédito en este rango" : tipoDoc === "PROFORMA" ? "Sin proformas en este rango" : "Sin facturas autorizadas en este rango"

  const carteraClientes = useMemo(() => {
    const agrupado: Record<string, { ruc: string; nombre: string; comprasRealizadas: number; totalAcumulado: number }> = {};
    facturas.forEach((f) => {
      const clave = f.ruc || f.cliente
      if (!agrupado[clave]) agrupado[clave] = { ruc: f.ruc, nombre: f.cliente, comprasRealizadas: 0, totalAcumulado: 0 };
      agrupado[clave].comprasRealizadas += 1;
      agrupado[clave].totalAcumulado += f.monto;
    });
    const total = facturas.reduce((s, f) => s + f.monto, 0);
    return Object.values(agrupado).map((c) => ({
      ...c,
      participacion: total > 0 ? `${((c.totalAcumulado / total) * 100).toFixed(0)}%` : "0%",
    })).sort((a, b) => b.totalAcumulado - a.totalAcumulado);
  }, [facturas]);

  const totalFacturado = documentos.reduce((s, f) => s + f.monto, 0);
  const clientesNuevos = captacion.reduce((s, c) => s + Number(c.nuevos || 0), 0);

  const exportar = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(documentos), tipoDoc === "04" ? "Notas" : tipoDoc === "PROFORMA" ? "Proformas" : "Facturas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porCaja), "Cajas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(captacion), "Captacion");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte_${fechaDesde}_al_${fechaHasta}.xlsx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="min-h-screen bg-[#060608] text-white p-4 font-sans select-none">
      <div className="mb-4 flex gap-2">
        <button onClick={()=>router.back()} className="bg-white/10 text-white border border-white/5 px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/20 transition-all">
          ← Volver al Dashboard
        </button>
        <button onClick={()=>router.push("/dashboard/factura-xml")} className="bg-[#00f5d4] text-black px-4 py-2 rounded-xl text-xs font-bold">Facturador</button>
      </div>

      <div className="bg-[#11131a] rounded-[20px] p-4 border border-white/5 flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 flex-1">
          <select value={vendedorSel} onChange={(e) => setVendedorSel(e.target.value)} className="bg-black border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-[#00f5d4] font-bold min-w-[280px]">
            <option value="">Todos los trabajadores</option>
            {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#00f5d4] font-mono" />
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#00f5d4] font-mono" />
        </div>
        <button onClick={exportar} className="bg-[#00f5d4] text-black font-black px-5 py-3 rounded-xl text-xs hover:bg-[#00d4b8] transition-all tracking-wider uppercase">
          EXPORTAR EXCEL
        </button>
      </div>

      <div className="bg-[#11131a] rounded-[20px] p-3 border border-[#00f5d4]/20 flex items-center gap-3 mb-4">
        <span className="text-[9px] bg-[#00f5d4]/20 text-[#00f5d4] px-2 py-1 rounded font-black">FILTRO FINO</span>
        <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)} className="bg-black border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-[#00f5d4] font-bold">
          <option value="01">Factura</option>
          <option value="04">Nota de crédito</option>
          <option value="PROFORMA">Proforma</option>
        </select>
        <div className="relative flex-1">
          <input value={filtroCliente} onChange={e=> setFiltroCliente(e.target.value)} placeholder="Buscar por cliente o RUC" className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#00f5d4]"/>
        </div>
        <div className="relative flex-1">
          <input value={filtroProducto} onChange={e=> setFiltroProducto(e.target.value)} placeholder="Buscar por producto" className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-yellow-400"/>
        </div>
        {(filtroCliente || filtroProducto) && (
          <button onClick={()=>{setFiltroCliente(""); setFiltroProducto("")}} className="text-[10px] bg-red-500/20 text-red-400 px-3 py-2 rounded-xl border border-red-500/20">LIMPIAR</button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-[#11131a] border border-white/5 rounded-2xl p-4">
          <p className="text-[9px] text-white/40 font-bold tracking-widest uppercase">{tituloTotal}</p>
          <p className="text-2xl font-black mt-1 font-mono">${totalFacturado.toFixed(2)}</p>
        </div>
        <div className="bg-[#11131a] border border-white/5 rounded-2xl p-4">
          <p className="text-[9px] text-[#00f5d4] font-bold tracking-widest uppercase">CLIENTES NUEVOS</p>
          <p className="text-2xl font-black mt-1 font-mono text-[#00f5d4]">{clientesNuevos}</p>
        </div>
        <div className="bg-[#11131a] border border-white/5 rounded-2xl p-4">
          <p className="text-[9px] text-white/40 font-bold tracking-widest uppercase">DOCUMENTOS</p>
          <p className="text-2xl font-black mt-1 font-mono">{cargando ? "…" : documentos.length}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="bg-[#11131a] rounded-[20px] p-4 border border-white/5">
          <p className="text-[10px] font-bold text-white/50 tracking-wider uppercase border-b border-white/5 pb-2 mb-3">Ventas por punto de venta</p>
          {porCaja.map((c) => (
            <div key={c.caja} className="flex justify-between gap-3 py-2 border-b border-white/5 text-[11px]">
              <span className="font-bold text-[#00f5d4]">{c.caja || "—"}</span>
              <span>Efectivo ${c.efectivo.toFixed(2)}</span>
              <span>Tarjeta ${c.tarjeta.toFixed(2)}</span>
              <span>Transferencia ${c.transferencia.toFixed(2)}</span>
              <span className="font-black">${c.total.toFixed(2)}</span>
            </div>
          ))}
          {porCaja.length === 0 && <p className="text-[11px] text-white/30">Sin ventas autorizadas en este rango.</p>}
        </div>
        <div className="bg-[#11131a] rounded-[20px] p-4 border border-white/5">
          <p className="text-[10px] font-bold text-[#ffbe0a] tracking-wider uppercase border-b border-white/5 pb-2 mb-3">Clientes captados</p>
          {captacion.map((c) => (
            <div key={c.usuarioId} className="flex justify-between py-2 border-b border-white/5 text-[11px]">
              <span>{c.nombre}</span>
              <span>{c.nuevos} nuevos</span>
              <span className="font-black">${Number(c.comprado || 0).toFixed(2)}</span>
            </div>
          ))}
          {captacion.length === 0 && <p className="text-[11px] text-white/30">Nadie registró clientes nuevos en este rango.</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-7 bg-[#11131a] rounded-[20px] p-4 border border-white/5 space-y-3">
          <p className="text-[10px] font-bold text-white/50 tracking-wider uppercase border-b border-white/5 pb-2">
            Histórico de comprobantes autorizados
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-left font-mono">
                  <th className="p-2">FECHA</th>
                  <th className="p-2">SECUENCIAL</th>
                  <th className="p-2">CLIENTE</th>
                  <th className="p-2">TRABAJADOR</th>
                  <th className="p-2 text-right">MONTO</th>
                </tr>
              </thead>
              <tbody>
                {documentos.map((f) => (
                  <tr key={f.id} className="border-b border-white/5 text-white/80 hover:bg-white/5 transition-colors">
                    <td className="p-2 font-mono text-white/40">{f.fecha}</td>
                    <td className="p-2 font-mono text-[#00f5d4] font-bold">{f.secuencial}</td>
                    <td className="p-2 font-bold">{f.cliente}</td>
                    <td className="p-2 text-[9px] text-white/50">{f.vendedor}</td>
                    <td className="p-2 text-right font-mono font-bold text-white">${f.monto.toFixed(2)}</td>
                  </tr>
                ))}
                {documentos.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-white/30">{cargando ? "Leyendo ventas de esta empresa…" : vacio}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:col-span-5 bg-[#11131a] rounded-[20px] p-4 border border-white/5 space-y-3">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <p className="text-[10px] font-bold text-[#ffbe0a] tracking-wider uppercase">Clientes del rango</p>
          </div>
          <div className="space-y-2 overflow-y-auto max-h-[300px]">
            {carteraClientes.map((c) => (
              <div key={c.ruc || c.nombre} className="flex justify-between items-center bg-black/30 p-3 rounded-xl border border-white/5">
                <div>
                  <h5 className="text-xs font-black tracking-tight">{c.nombre}</h5>
                  <p className="text-[9px] text-white/40 font-mono">RUC: {c.ruc} | {c.comprasRealizadas} vta</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black font-mono text-white">${c.totalAcumulado.toFixed(2)}</span>
                  <p className="text-[9px] text-[#ffbe0a] font-bold mt-0.5">{c.participacion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
