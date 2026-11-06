"use client";
import { useState, useEffect } from "react";

type ItemPedido = {
  id: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  unidad: string;
  costoUnitario: number;
};

type Pedido = {
  id: string;
  tipo: "MATERIA_PRIMA" | "PRODUCTO_TERMINADO";
  numero: string;
  proveedor: { nombre: string; ruc: string };
  fechaPedido: string;
  fechaEntrega: string;
  items: ItemPedido[];
  estado: "PENDIENTE" | "RECIBIDO" | "PARCIAL" | "ANULADO";
  total: number;
  observaciones: string;
};

const UNIDADES = ["UND", "KG", "LT", "CAJA", "SACO", "METRO", "ROLLO"];
const CATEGORIAS_MP = ["Materia Prima", "Insumo", "Envase", "Repuesto", "Otro"];
const CATEGORIAS_PT = ["Producto para Venta", "Mercadería", "Suministro"];

export default function HojaPedidosUniversal() {
  const [tab, setTab] = useState<"MATERIA_PRIMA" | "PRODUCTO_TERMINADO">("MATERIA_PRIMA");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [proveedor, setProveedor] = useState({ nombre: "", ruc: "" });
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [items, setItems] = useState<ItemPedido[]>([
    { id: "1", nombre: "", categoria: "Materia Prima", cantidad: 1, unidad: "UND", costoUnitario: 0 }
  ]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("meijsac_pedidos") || "[]");
    setPedidos(saved);
  }, []);

  const totalPedido = items.reduce((acc, it) => acc + (it.cantidad * it.costoUnitario), 0);

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), nombre: "", categoria: tab === "MATERIA_PRIMA" ? "Materia Prima" : "Producto para Venta", cantidad: 1, unidad: "UND", costoUnitario: 0 }]);
  };

  const updateItem = (id: string, field: keyof ItemPedido, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const guardarPedido = () => {
    if (!proveedor.nombre || items.some(i => !i.nombre)) return alert("Completa proveedor y productos");
    
    const nuevo: Pedido = {
      id: Date.now().toString(),
      tipo: tab,
      numero: `PED-${Date.now().toString().slice(-6)}`,
      proveedor,
      fechaPedido: new Date().toISOString(),
      fechaEntrega,
      items,
      estado: "PENDIENTE",
      total: totalPedido,
      observaciones
    };

    const nuevosPedidos = [nuevo, ...pedidos];
    setPedidos(nuevosPedidos);
    localStorage.setItem("meijsac_pedidos", JSON.stringify(nuevosPedidos));
    
    // Limpia form
    setProveedor({ nombre: "", ruc: "" });
    setFechaEntrega("");
    setObservaciones("");
    setItems([{ id: "1", nombre: "", categoria: tab === "MATERIA_PRIMA" ? "Materia Prima" : "Producto para Venta", cantidad: 1, unidad: "UND", costoUnitario: 0 }]);
    alert(`✅ Pedido ${nuevo.numero} guardado`);
  };

  const recibirPedido = (pedido: Pedido) => {
    // 1. Actualiza pedido a RECIBIDO
    const actualizados = pedidos.map(p => p.id === pedido.id ? { ...p, estado: "RECIBIDO" as const } : p);
    setPedidos(actualizados);
    localStorage.setItem("meijsac_pedidos", JSON.stringify(actualizados));

    // 2. Crea movimiento REAL para tu sección de Movimientos
    const movimientos = JSON.parse(localStorage.getItem("meijsac_movimientos") || "[]");
    const movimientoReal = {
      id: Date.now(),
      tipo: "INGRESO_BODEGA",
      origen: `PEDIDO ${pedido.numero}`,
      proveedor: pedido.proveedor.nombre,
      fecha: new Date().toISOString(),
      total: pedido.total,
      items: pedido.items.length,
      detalle: pedido.items,
      afectaInventario: true
    };
    localStorage.setItem("meijsac_movimientos", JSON.stringify([movimientoReal, ...movimientos]));

    // 3. Actualiza inventario real
    const inventario = JSON.parse(localStorage.getItem("meijsac_inventario") || "[]");
    pedido.items.forEach(it => {
      const idx = inventario.findIndex((x: any) => x.nombre === it.nombre);
      if (idx >= 0) inventario[idx].stock += it.cantidad;
      else inventario.push({ nombre: it.nombre, categoria: it.categoria, stock: it.cantidad, costo: it.costoUnitario, unidad: it.unidad });
    });
    localStorage.setItem("meijsac_inventario", JSON.stringify(inventario));

    alert(`📦 Pedido ${pedido.numero} recibido. Inventario y Movimientos actualizados con valores REALES`);
  };

  const pedidosFiltrados = pedidos.filter(p => p.tipo === tab);

  return (
    <div className="min-h-screen bg-[#060608] text-white p-4">
      <h1 className="font-black text-[16px] tracking-widest mb-4">PEDIDOS - {tab.replace("_", " ")}</h1>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab("MATERIA_PRIMA")} className={`px-4 py-2 text-xs font-bold rounded ${tab === "MATERIA_PRIMA" ? "bg-[#00f5d4] text-black" : "bg-[#1a1a1a]"}`}>MATERIA PRIMA / INSUMOS</button>
        <button onClick={() => setTab("PRODUCTO_TERMINADO")} className={`px-4 py-2 text-xs font-bold rounded ${tab === "PRODUCTO_TERMINADO" ? "bg-[#ffbe0a] text-black" : "bg-[#1a1a1a]"}`}>PRODUCTO TERMINADO</button>
      </div>

      <div className="bg-[#121212] p-4 rounded-xl border border-[#222] mb-8">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <input value={proveedor.nombre} onChange={e => setProveedor({...proveedor, nombre: e.target.value})} placeholder="Proveedor *" className="bg-black p-2 rounded text-xs" />
          <input value={proveedor.ruc} onChange={e => setProveedor({...proveedor, ruc: e.target.value})} placeholder="RUC Proveedor" className="bg-black p-2 rounded text-xs" />
          <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} className="bg-black p-2 rounded text-xs" />
        </div>

        {items.map(it => (
          <div key={it.id} className="grid grid-cols-6 gap-2 mb-2">
            <input value={it.nombre} onChange={e => updateItem(it.id, "nombre", e.target.value)} placeholder="Producto / Materia Prima *" className="col-span-2 bg-black p-2 rounded text-xs" />
            <select value={it.categoria} onChange={e => updateItem(it.id, "categoria", e.target.value)} className="bg-black p-2 rounded text-xs">
              {(tab === "MATERIA_PRIMA" ? CATEGORIAS_MP : CATEGORIAS_PT).map(c => <option key={c}>{c}</option>)}
            </select>
            <div className="flex gap-1">
              <input type="number" value={it.cantidad} onChange={e => updateItem(it.id, "cantidad", Number(e.target.value))} className="w-16 bg-black p-2 rounded text-xs" />
              <select value={it.unidad} onChange={e => updateItem(it.id, "unidad", e.target.value)} className="bg-black p-2 rounded text-xs">
                {UNIDADES.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <input type="number" value={it.costoUnitario} onChange={e => updateItem(it.id, "costoUnitario", Number(e.target.value))} placeholder="Costo" className="bg-black p-2 rounded text-xs" />
          </div>
        ))}
        <div className="flex justify-between mt-4">
          <button onClick={addItem} className="text-xs bg-[#222] px-3 py-1 rounded">+ Agregar Item</button>
          <div className="flex gap-3 items-center">
            <span className="text-xs font-bold">TOTAL: ${totalPedido.toFixed(2)}</span>
            <button onClick={guardarPedido} className="bg-white text-black px-6 py-2 rounded font-black text-xs">GUARDAR PEDIDO</button>
          </div>
        </div>
      </div>

      <div className="bg-[#121212] rounded-xl border border-[#222]">
        <div className="p-3 text-[11px] font-bold tracking-widest border-b border-[#222]">HISTORIAL PEDIDOS REALES - {pedidosFiltrados.length}</div>
        {pedidosFiltrados.map(p => (
          <div key={p.id} className="flex justify-between items-center p-3 border-b border-[#1a1a1a] text-xs">
            <div>
              <div className="font-bold">{p.numero} - {p.proveedor.nombre} <span className={`ml-2 px-2 py-0.5 rounded text-[10px] ${p.estado === "RECIBIDO" ? "bg-green-600" : "bg-yellow-600"}`}>{p.estado}</span></div>
              <div className="text-[#888]">{p.items.length} items - ${p.total.toFixed(2)} - Entrega: {p.fechaEntrega || "Sin fecha"}</div>
            </div>
            {p.estado === "PENDIENTE" && <button onClick={() => recibirPedido(p)} className="bg-[#00f5d4] text-black px-3 py-1 rounded font-bold">RECIBIR Y ACTUALIZAR MOVIMIENTOS</button>}
          </div>
        ))}
      </div>
    </div>
  );
}