"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ItemGuia = { id: string; codigo: string; descripcion: string; cantidadFactura: number; cantidadPendiente: number; cantidadTransportada: number };
type Destinatario = {
  id: string; ruc: string; razonSocial: string; dirDestino: string;
  motivoTraslado: string; codDocSustento: string; numDocSustento: string;
  numAutDocSustento: string; fechaEmisionDocSustento: string;
  items: ItemGuia[]; buscando: boolean;
};
type Emisor = { razon: string; comercial: string; ruc: string; matriz: string };

const MOTIVOS_SRI = [
  { code: "01", label: "Venta" },
  { code: "02", label: "Compra" },
  { code: "03", label: "Traslado entre locales" },
  { code: "04", label: "Consignación" },
  { code: "05", label: "Devolución" },
  { code: "06", label: "Traslado entre bodegas" },
  { code: "07", label: "Importación" },
  { code: "08", label: "Transformación" },
];
const TIPOS_ID = [
  { code: "04", label: "RUC" },
  { code: "05", label: "Cédula" },
  { code: "06", label: "Pasaporte" },
];
const DOCS_SUSTENTO = [
  { code: "01", label: "Factura" },
  { code: "04", label: "Nota de crédito" },
  { code: "03", label: "Liquidación de compra" },
];

function vacio(): Destinatario {
  return {
    id: `dest-${Date.now()}`, ruc: "", razonSocial: "", dirDestino: "", motivoTraslado: "01",
    codDocSustento: "01", numDocSustento: "", numAutDocSustento: "", fechaEmisionDocSustento: "",
    items: [], buscando: false,
  };
}

function fechaSri(iso: string) {
  const partes = iso.split("-");
  if (partes.length !== 3) return "";
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export default function GuiaRemisionPage() {
  const [razonSocialTransp, setRazonTransp] = useState("");
  const [tipoIdTransp, setTipoId] = useState("04");
  const [numIdTransp, setNumId] = useState("");
  const [placa, setPlaca] = useState("");
  const [dirPartida, setDirPartida] = useState("");
  const [fechaIni, setFechaIni] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [destinatarios, setDests] = useState<Destinatario[]>([vacio()]);
  const [emisor, setEmisor] = useState<Emisor>({ razon: "", comercial: "", ruc: "", matriz: "" });
  const [cargando, setCargando] = useState(false);
  const totalBultos = useMemo(() => destinatarios.reduce((s, d) => s + d.items.reduce((a, i) => a + Number(i.cantidadTransportada || 0), 0), 0), [destinatarios]);

  useEffect(() => {
    fetch("/api/empresa/mia").then((r) => r.json()).then((data) => {
      const empresa = data?.empresa || {};
      setEmisor({
        razon: empresa.razonSocial || "",
        comercial: empresa.nombreComercial || "",
        ruc: empresa.ruc || "",
        matriz: empresa.dirMatriz || empresa.direccion || "",
      });
      setDirPartida((actual) => actual || empresa.dirEstablecimiento || empresa.dirMatriz || empresa.direccion || "");
    }).catch(() => {});
  }, []);

  const patch = (id: string, cambio: Partial<Destinatario>) => setDests((prev) => prev.map((d) => d.id === id ? { ...d, ...cambio } : d));

  const cargarFactura = async (dest: Destinatario) => {
    patch(dest.id, { buscando: true });
    try {
      const res = await fetch(`/api/sri/guia-remision?numero=${encodeURIComponent(dest.numDocSustento)}&tipo=${dest.codDocSustento}`);
      const data = await res.json();
      if (!res.ok) { alert(data.mensaje || "No encontré el comprobante."); return; }
      const items = (data.productos || []).map((prod: { codigo: string; descripcion: string; cantidadFacturada: number; cantidadPendiente: number }, i: number) => ({
        id: `${dest.id}-${prod.codigo}-${i}`,
        codigo: prod.codigo,
        descripcion: prod.descripcion,
        cantidadFactura: Number(prod.cantidadFacturada),
        cantidadPendiente: Number(prod.cantidadPendiente),
        cantidadTransportada: Number(prod.cantidadPendiente),
      }));
      if (!items.length) { alert("Esa factura ya no tiene mercadería pendiente de enviar."); return; }
      patch(dest.id, {
        ruc: data.identificacion || "",
        razonSocial: data.cliente || "",
        dirDestino: data.direccion || "",
        numDocSustento: data.numero || dest.numDocSustento,
        numAutDocSustento: data.autorizacion || "",
        fechaEmisionDocSustento: String(data.fecha || "").split("/").reverse().join("-"),
        items,
      });
    } catch {
      alert("No pude consultar la factura.");
    } finally {
      patch(dest.id, { buscando: false });
    }
  };

  const emitir = async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/sri/guia-remision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razonSocialTransportista: razonSocialTransp,
          tipoIdentificacionTransportista: tipoIdTransp,
          rucTransportista: numIdTransp,
          placa,
          dirPartida,
          fechaIniTransporte: fechaSri(fechaIni),
          fechaFinTransporte: fechaSri(fechaFin),
          destinatarios: destinatarios.map((dest) => ({
            identificacionDestinatario: dest.ruc,
            razonSocialDestinatario: dest.razonSocial,
            dirDestinatario: dest.dirDestino,
            motivoTraslado: dest.motivoTraslado,
            codDocSustento: dest.codDocSustento,
            numDocSustento: dest.numDocSustento,
            numAutDocSustento: dest.numAutDocSustento,
            fechaEmisionDocSustento: fechaSri(dest.fechaEmisionDocSustento),
            productos: dest.items.filter((item) => item.cantidadTransportada > 0).map((item) => ({
              codigoInterno: item.codigo,
              descripcion: item.descripcion,
              cantidadEnviar: Math.min(item.cantidadTransportada, item.cantidadPendiente || item.cantidadTransportada),
            })),
          })),
        }),
      });
      const data = await res.json();
      if (data.autorizado && data.fechaAutorizacion && data.claveAcceso) {
        window.location.href = `/dashboard/factura-xml/visor/${data.claveAcceso}`;
        return;
      }
      alert(data.mensaje || "El SRI no autorizó la guía.");
    } catch {
      alert("No pude conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 p-6 font-sans">
      <div className="max-w-7xl mx-auto flex justify-between items-center mb-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
          <h1 className="text-lg font-semibold text-white">Nueva Guía de Remisión</h1>
          <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-md border border-slate-700">Comprobante 06 · Traslado</span>
        </div>
        <Link href="/dashboard/comprobantes" className="text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg">← Volver</Link>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-6 space-y-4">
            <h2 className="text-xs font-semibold text-teal-400 uppercase tracking-wider">1. Datos del transportista y ruta</h2>
            <div className="grid md:grid-cols-12 gap-3 text-xs">
              <div className="md:col-span-5"><label className="text-slate-400">Empresa de transporte / chofer</label><input value={razonSocialTransp} onChange={(e) => setRazonTransp(e.target.value.toUpperCase())} className="w-full mt-1 bg-[#0B0F19] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-400" /></div>
              <div className="md:col-span-2"><label className="text-slate-400">Tipo</label><select value={tipoIdTransp} onChange={(e) => setTipoId(e.target.value)} className="w-full mt-1 bg-[#0B0F19] border border-slate-700 rounded-xl px-3 py-2 text-white">{TIPOS_ID.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}</select></div>
              <div className="md:col-span-3"><label className="text-slate-400">Identificación</label><input value={numIdTransp} onChange={(e) => setNumId(e.target.value)} className="w-full mt-1 bg-[#0B0F19] border border-slate-700 rounded-xl px-3 py-2 font-mono text-white" /></div>
              <div className="md:col-span-2"><label className="text-slate-400">Placa</label><input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8))} placeholder="PBA-1234" className="w-full mt-1 bg-[#0B0F19] border border-slate-700 rounded-xl px-3 py-2 font-mono text-white" /></div>
              <div className="md:col-span-6"><label className="text-slate-400">Punto de partida</label><input value={dirPartida} onChange={(e) => setDirPartida(e.target.value.toUpperCase())} className="w-full mt-1 bg-[#0B0F19] border border-slate-700 rounded-xl px-3 py-2 text-white" /></div>
              <div className="md:col-span-3"><label className="text-slate-400">Inicio del traslado</label><input type="date" value={fechaIni} onChange={(e) => setFechaIni(e.target.value)} className="w-full mt-1 bg-[#0B0F19] border border-slate-700 rounded-xl px-3 py-2 text-white" /></div>
              <div className="md:col-span-3"><label className="text-slate-400">Fin del traslado</label><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full mt-1 bg-[#0B0F19] border border-slate-700 rounded-xl px-3 py-2 text-white" /></div>
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-semibold text-teal-400 uppercase tracking-wider">2. Ruta y entregas</h2>
              <button onClick={() => setDests([...destinatarios, vacio()])} className="text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 px-3.5 py-1.5 rounded-xl">+ Añadir destino</button>
            </div>
            <div className="space-y-4">
              {destinatarios.map((dest, idx) => (
                <div key={dest.id} className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-4">
                  <div className="flex justify-between mb-3"><span className="text-[10px] font-bold text-teal-300">Entrega {idx + 1}</span>{destinatarios.length > 1 && <button onClick={() => setDests(destinatarios.filter((d) => d.id !== dest.id))} className="text-xs text-slate-500">Quitar</button>}</div>
                  <div className="grid md:grid-cols-12 gap-3 text-xs">
                    <div className="md:col-span-4"><label className="text-slate-500">Número de factura / documento</label><div className="flex gap-2 mt-1"><input value={dest.numDocSustento} onChange={(e) => patch(dest.id, { numDocSustento: e.target.value })} placeholder="001-002-000000147" className="flex-1 bg-[#111827] border border-slate-700 rounded-xl px-3 py-2 font-mono text-white" /><button onClick={() => cargarFactura(dest)} disabled={dest.buscando} className="px-3 rounded-xl bg-teal-400 text-slate-950 font-semibold disabled:opacity-50">{dest.buscando ? "..." : "Buscar"}</button></div></div>
                    <div className="md:col-span-2"><label className="text-slate-500">Documento</label><select value={dest.codDocSustento} onChange={(e) => patch(dest.id, { codDocSustento: e.target.value })} className="w-full mt-1 bg-[#111827] border border-slate-700 rounded-xl px-3 py-2 text-white">{DOCS_SUSTENTO.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}</select></div>
                    <div className="md:col-span-3"><label className="text-slate-500">Identificación</label><input value={dest.ruc} onChange={(e) => patch(dest.id, { ruc: e.target.value })} className="w-full mt-1 bg-[#111827] border border-slate-700 rounded-xl px-3 py-2 font-mono text-white" /></div>
                    <div className="md:col-span-3"><label className="text-slate-500">Cliente</label><input value={dest.razonSocial} onChange={(e) => patch(dest.id, { razonSocial: e.target.value.toUpperCase() })} className="w-full mt-1 bg-[#111827] border border-slate-700 rounded-xl px-3 py-2 text-white" /></div>
                    <div className="md:col-span-5"><label className="text-slate-500">Dirección de entrega</label><input value={dest.dirDestino} onChange={(e) => patch(dest.id, { dirDestino: e.target.value.toUpperCase() })} className="w-full mt-1 bg-[#111827] border border-slate-700 rounded-xl px-3 py-2 text-white" /></div>
                    <div className="md:col-span-3"><label className="text-slate-500">Motivo</label><select value={dest.motivoTraslado} onChange={(e) => patch(dest.id, { motivoTraslado: e.target.value })} className="w-full mt-1 bg-[#111827] border border-slate-700 rounded-xl px-3 py-2 text-white">{MOTIVOS_SRI.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}</select></div>
                    <div className="md:col-span-2"><label className="text-slate-500">Fecha del documento</label><input type="date" value={dest.fechaEmisionDocSustento} onChange={(e) => patch(dest.id, { fechaEmisionDocSustento: e.target.value })} className="w-full mt-1 bg-[#111827] border border-slate-700 rounded-xl px-3 py-2 text-white" /></div>
                    <div className="md:col-span-2"><label className="text-slate-500">Autorización (49 dígitos)</label><input value={dest.numAutDocSustento} onChange={(e) => patch(dest.id, { numAutDocSustento: e.target.value.replace(/\D/g, "").slice(0, 49) })} className="w-full mt-1 bg-[#111827] border border-slate-700 rounded-xl px-3 py-2 font-mono text-[10px] text-white" /></div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {dest.items.map((item) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 items-end bg-[#111827] rounded-xl p-2">
                        <div className="col-span-2 text-[11px] font-mono text-slate-400">{item.codigo}</div>
                        <div className="col-span-5 text-xs text-white">{item.descripcion}</div>
                        <div className="col-span-2 text-[11px] text-slate-500">Pendiente {item.cantidadPendiente}</div>
                        <div className="col-span-3"><input type="number" min={0} max={item.cantidadPendiente} value={item.cantidadTransportada} onChange={(e) => {
                          const pedida = Number(e.target.value);
                          const cantidad = Math.max(0, Math.min(pedida, item.cantidadPendiente));
                          setDests((prev) => prev.map((d) => d.id === dest.id ? { ...d, items: d.items.map((x) => x.id === item.id ? { ...x, cantidadTransportada: cantidad } : x) } : d));
                        }} className="w-full bg-[#0B0F19] border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-teal-300" /></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={emitir} disabled={cargando} className="w-full mt-5 py-3 rounded-xl text-sm font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 disabled:opacity-50">{cargando ? "Autorizando en el SRI..." : "Generar guía de remisión"}</button>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white text-slate-800 rounded-2xl p-6 text-xs shadow-2xl">
          <div className="flex justify-between border-b border-slate-200 pb-3 mb-3">
            <div><p className="font-bold text-slate-900">{emisor.razon || "Tu empresa"}</p><p className="text-slate-500">{emisor.comercial}</p><p className="text-slate-500">RUC {emisor.ruc}</p><p className="text-slate-500">{emisor.matriz}</p></div>
            <div className="text-right"><p className="font-bold">GUÍA DE REMISIÓN</p><p className="text-slate-500">El número se asigna al emitir</p></div>
          </div>
          <p><b>Transportista:</b> {razonSocialTransp || "—"} · {numIdTransp || "—"}</p>
          <p className="mt-1"><b>Placa:</b> {placa || "—"}</p>
          <p className="mt-1"><b>Partida:</b> {dirPartida || "—"}</p>
          <p className="mt-1"><b>Traslado:</b> {fechaSri(fechaIni) || "—"} al {fechaSri(fechaFin) || "—"}</p>
          <p className="mt-3 font-semibold text-slate-900">{destinatarios.length} entregas · {totalBultos} unidades</p>
          {destinatarios.map((dest, idx) => (
            <div key={dest.id} className="mt-3 border border-slate-200 rounded-xl p-3">
              <p className="font-semibold">Entrega {idx + 1}: {dest.razonSocial || "Sin cliente"}</p>
              <p className="text-slate-500">{dest.numDocSustento || "Sin factura"} · {dest.numAutDocSustento ? `${dest.numAutDocSustento.length} dígitos` : "sin autorización"}</p>
              {dest.items.filter((item) => item.cantidadTransportada > 0).map((item) => <p key={item.id} className="mt-1">{item.descripcion} · {item.cantidadTransportada}</p>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
