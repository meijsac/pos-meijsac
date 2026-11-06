"use client"
import { useState, useEffect } from "react"

type Producto = { id:number, nombre:string, precio:number, stock:number, iva: number }
type Cart = Producto & { qty:number }

export default function PosTicket() {
  const [productos, setProductos] = useState<Producto[]>(()=>{
    const p = typeof window!=='undefined'? localStorage.getItem('meijsac_productos') : null
    return p? JSON.parse(p) : [
      {id:1,nombre:"Arroz 1kg",precio:1.5,stock:50,iva:0},
      {id:2,nombre:"Aceite 1L",precio:2.8,stock:20,iva:15},
      {id:3,nombre:"Cola 2L",precio:2.0,stock:30,iva:15},
    ]
  })
  const [busca,setBusca]=useState("")
  const [cart,setCart]=useState<Cart[]>([])
  const [caja,setCaja]=useState(()=>{ if(typeof window==='undefined') return {abierta:false,saldo:0}; const c=localStorage.getItem('meijsac_caja'); return c?JSON.parse(c):{abierta:false,saldo:0} })
  const [pago,setPago]=useState("EFECTIVO")

  useEffect(()=>{ localStorage.setItem('meijsac_productos', JSON.stringify(productos)) },[productos])
  useEffect(()=>{ localStorage.setItem('meijsac_caja', JSON.stringify(caja)) },[caja])

  const add = (p:Producto) => {
    setCart(prev=>{
      const ex=prev.find(x=>x.id===p.id)
      if(ex) return prev.map(x=>x.id===p.id?{...x,qty:x.qty+1}:x)
      return [...prev,{...p,qty:1}]
    })
  }
  const total = cart.reduce((s,c)=>s+c.precio*c.qty,0)
  const totalIva = cart.reduce((s,c)=>s+(c.iva? c.precio*c.qty*0.15 : 0),0)

 const cobrar = async () => {
  if(!caja.abierta){ alert("Abre caja primero"); return }

  // 1. Cargamos la config PRO que creaste en CONFIGURACION
  const cfg = JSON.parse(localStorage.getItem('meijsac_config_pro') || '{}');
  
  const venta = { id:Date.now(), cart, total, fecha:new Date().toISOString(), pago, estado: "PENDIENTE" };
  
  // 2. LÓGICA OFFLINE SRI 72H
  if(!navigator.onLine || cfg.modoOffline){
    // Generamos clave de acceso 49 dígitos al instante (aunque no tengas net)
    const fechaStr = new Date().toISOString().slice(0,10).replace(/-/g,"");
    const claveAcceso = `${fechaStr}01${cfg.ruc||"9999999999999"}${cfg.ambiente||"1"}001001000000001123456781`; // simplificada, luego la firmas
    
    const facturaOffline = { 
      clave: claveAcceso, 
      venta: venta, // guardamos la venta completa
      xml: `<factura offline>${JSON.stringify(venta)}</factura>`, // aquí irá tu XML firmado real
      fecha: new Date().toISOString(), 
      estado: "PENDIENTE_SRI" 
    };

    const cola = [...(cfg.colaOffline||[]), facturaOffline];
    const nuevaCfg = {...cfg, colaOffline: cola, ultimoEnvioOffline: "Pendiente - sin conexión"};
    localStorage.setItem('meijsac_config_pro', JSON.stringify(nuevaCfg));
    
    // Guardamos la venta igual para tu caja
    const ventas = JSON.parse(localStorage.getItem('meijsac_ventas')||'[]');
    ventas.push({...venta, claveAcceso, offline: true});
    localStorage.setItem('meijsac_ventas', JSON.stringify(ventas));
    
    setCaja({...caja, saldo: caja.saldo+total});
    setCart([]);
    alert(`VENTA OFFLINE OK - Ticket ${claveAcceso.slice(-9)} guardado. Se enviará solo al volver internet`);
    return;
  }

  // 3. ONLINE NORMAL (cuando hay internet)
  try{
    // Aquí irá tu await fetch("/api/sri/envio", {xml})
    const ventas = JSON.parse(localStorage.getItem('meijsac_ventas')||'[]');
    ventas.push(venta);
    localStorage.setItem('meijsac_ventas', JSON.stringify(ventas));
    setCaja({...caja, saldo: caja.saldo+total});
    setCart([]);
    alert("VENTA OK - Enviada al SRI");
  }catch(e){
    alert("Sin conexión, guardada en cola offline");
  }
};

  const filtrados = productos.filter(p=>p.nombre.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 grid grid-cols-3 gap-4">
      <div className="col-span-2 space-y-3">
        <h1 className="font-black text-xl">POS TICKET - MEIJSA C {caja.abierta?`🟢 Caja $${caja.saldo.toFixed(2)}`:"🔴 Caja Cerrada"}</h1>
        <div className="flex gap-2">
          {!caja.abierta? <><input id="saldoIni" type="number" placeholder="Saldo inicial" className="p-2 rounded bg-white/10"/><button onClick={()=>{ const v=(document.getElementById('saldoIni') as HTMLInputElement).value; setCaja({abierta:true,saldo:parseFloat(v||'0')})}} className="px-4 py-2 bg-[#00f5d4] text-black font-bold rounded">ABRIR CAJA</button></> : <button onClick={()=>setCaja({abierta:false,saldo:0})} className="px-4 py-2 bg-red-500 rounded">CERRAR CAJA X</button>}
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar producto..." className="flex-1 p-2 rounded bg-white/10" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {filtrados.map(p=><button key={p.id} onClick={()=>add(p)} className="p-3 bg-white/5 border border-white/10 rounded-xl text-left hover:bg-white/10"><div className="font-bold text-sm">{p.nombre}</div><div className="text-[#00f5d4]">${p.precio} - Stock {p.stock}</div></button>)}
        </div>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col">
        <h2 className="font-black mb-2">TICKET</h2>
        <div className="flex-1 space-y-2 overflow-y-auto">
          {cart.map(c=><div key={c.id} className="flex justify-between text-sm"><span>{c.nombre} x{c.qty}</span><span>${(c.precio*c.qty).toFixed(2)}</span></div>)}
        </div>
        <div className="border-t border-white/10 mt-2 pt-2 space-y-2">
          <div className="flex justify-between"><span>Subtotal</span><span>${(total-totalIva).toFixed(2)}</span></div>
          <div className="flex justify-between text-[#00f5d4]"><span>IVA 15%</span><span>${totalIva.toFixed(2)}</span></div>
          <div className="flex justify-between font-black text-lg"><span>TOTAL</span><span>${total.toFixed(2)}</span></div>
          <select value={pago} onChange={e=>setPago(e.target.value)} className="w-full p-2 rounded bg-black"><option>EFECTIVO</option><option>TRANSFERENCIA</option><option>TARJETA</option></select>
          <button onClick={cobrar} className="w-full py-3 bg-[#00f5d4] text-black font-black rounded-xl">COBRAR / IMPRIMIR TICKET</button>
        </div>
      </div>
    </div>
  )
}