"use client"
import { useState, useMemo } from "react"
import Link from "next/link"

const CORPORATE = "#23AAB3"

interface LogSeguridad {
  id: string;
  fecha: string;
  usuario: string;
  modulo: string;
  accion: string;
  detalle: string;
  ip: string;
  nivel: string;
}

// MOCK DATA - Historial de incidentes y auditoría en tiempo real
const initialLogs: LogSeguridad[] = [
  { id: "1", fecha: "2026-10-21 14:32:10", usuario: "cajero_tena", modulo: "RESTAURANTE", accion: "Mesa 4 liberada manualmente", detalle: "Se eliminó comanda activa de Lomo Fino ($18.50) sin emitir comprobante.", ip: "192.168.1.45", nivel: "CRITICO" },
  { id: "2", fecha: "2026-10-21 14:15:02", usuario: "admin_meijsac", modulo: "SEGURIDAD", accion: "Firma electrónica actualizada", detalle: "Archivo .p12 inyectado y cifrado exitosamente bajo hash AES-256.", ip: "192.168.1.10", nivel: "INFO" },
  { id: "3", fecha: "2026-10-21 13:58:44", usuario: "cajero_tena", modulo: "FACTURACIÓN", accion: "Descuento forzado en fila", detalle: "Se aplicó 25% de descuento manual a 'ARTÍCULO COMERCIAL' (Base: $25.50).", ip: "192.168.1.45", nivel: "ADVERTENCIA" },
  { id: "4", fecha: "2026-10-21 12:20:11", usuario: "mesero_juan", modulo: "RESTAURANTE", accion: "Comanda enviada en lote", detalle: "Mesa 2 despachó 3 ítems en conjunto hacia la pantalla digital de cocina (KDS).", ip: "192.168.1.88", nivel: "INFO" },
  { id: "5", fecha: "2026-10-21 11:05:30", usuario: "cajero_tena", modulo: "CLIENTES", accion: "Límite de crédito alterado", detalle: "Se autorizó venta a crédito a 'Importadora Andina' superando cupo por $17.25.", ip: "192.168.1.45", nivel: "ADVERTENCIA" },
  { id: "6", fecha: "2026-10-21 09:12:00", usuario: "admin_meijsac", modulo: "CAJA CHICA", accion: "Apertura de turno forzada", detalle: "Se abrió gaveta física de efectivo con saldo inicial de contingencia de $50.00.", ip: "192.168.1.10", nivel: "INFO" },
  { id: "7", fecha: "2026-10-21 08:30:15", usuario: "desconocido_bot", modulo: "SISTEMA", accion: "Intento de acceso fallido", detalle: "Bloqueo de IP temporal tras 3 intentos fallidos de contraseña en el login.", ip: "186.42.155.201", nivel: "CRITICO" },
]

export default function CentroSeguridadAuditoria() {
  const [logs, setLogs] = useState<LogSeguridad[]>(initialLogs)
  const [filtroNivel, setFiltrNivel] = useState("TODOS")
  const [busqueda, setBusqueda] = useState("")

  // --- FILTRADO DINÁMICO EN MEMORIA EN CALIENTE ---
  const logsFiltrados = useMemo(() => {
    return logs.filter(log => {
      const cumpleNivel = filtroNivel === "TODOS" || log.nivel === filtroNivel
      const cumpleBusqueda = 
        log.usuario.toLowerCase().includes(busqueda.toLowerCase()) ||
        log.accion.toLowerCase().includes(busqueda.toLowerCase()) ||
        log.modulo.toLowerCase().includes(busqueda.toLowerCase())
      return cumpleNivel && cumpleBusqueda
    })
  }, [logs, filtroNivel, busqueda])

  // --- CONTADORES ESTADÍSTICOS DE ALERTAS (KPIs) ---
  const estadisticas = useMemo(() => {
    const criticos = logs.filter(l => l.nivel === "CRITICO").length
    const advertencias = logs.filter(l => l.nivel === "ADVERTENCIA").length
    return { criticos, advertencias, total: logs.length }
  }, [logs])

  // --- FUNCIÓN DE LIMPIEZA DE EVENTOS ---
  const limpiarLogAuditoria = () => {
    if(confirm("⚠️ ¿Está seguro de vaciar el Log de Seguridad? Esta acción requiere privilegios máximos y quedará registrada.")) {
      const logCierre: LogSeguridad = {
        id: Date.now().toString(),
        fecha: new Date().toISOString().replace('T', ' ').substring(0, 19),
        usuario: "admin_meijsac",
        modulo: "SEGURIDAD",
        accion: "♻️ PURGA DE BITÁCORA DE AUDITORÍA",
        detalle: "El usuario administrador ejecutó un vaciado completo del registro histórico de logs.",
        ip: "127.0.0.1",
        nivel: "CRITICO"
      }
      setLogs([logCierre])
    }
  }

  // --- ASIGNACIÓN DE ESTILOS POR SEMÁFORO DE CRITICIDAD ---
  const getNivelEstilo = (nivel: string) => {
    switch (nivel) {
      case "CRITICO":
        return { bg: "bg-red-500/10 border-red-500/20 text-red-400", label: "⚠️ CRÍTICO" }
      case "ADVERTENCIA":
        return { bg: "bg-orange-400/10 border-orange-400/20 text-orange-300", label: "⚡ ADVERTENCIA" }
      default:
        return { bg: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400", label: "⚙️ INFO" }
    }
  }

  return (
    <div className="min-h-screen bg-[#090b11] text-white p-4 md:p-6 selection:bg-white selection:text-black font-sans">
      
      {/* CABECERA MAESTRA DEL CENTRO DE MONITOREO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 max-w-[1600px] mx-auto gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-[10px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all font-bold">
              ← REGRESAR
            </Link>
            <span className="text-[8px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-[#23AAB3] font-black border border-cyan-500/20 uppercase tracking-widest">
              ESCUDO ACTIVO (AES-256)
            </span>
          </div>
          <h1 className="text-base font-black tracking-wide mt-1 uppercase">Centro de Ciberseguridad & Auditoría en Vivo</h1>
        </div>
        <button 
          onClick={limpiarLogAuditoria}
          className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 font-black px-4 py-2.5 rounded-xl hover:bg-red-500/20 transition-all uppercase tracking-wider shadow-sm"
        >
          Purgar Bitácora Fiscal
        </button>
      </div>

      {/* TARGETAS DE KPIs DE RIESGO - MODELO FLOTANTE #12141d */}
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-[#12141d] rounded-2xl border border-white/[0.05] p-3.5 flex justify-between items-center shadow-sm">
          <div><p className="text-[9px] text-white/40 font-bold tracking-widest">TOTAL ACCIONES MONITOREADAS</p><p className="text-lg font-black mt-0.5 font-mono">{estadisticas.total}</p></div>
          <span className="text-xl bg-white/5 p-2 rounded-xl border border-white/5">🛡️</span>
        </div>
        <div className="bg-[#12141d] rounded-2xl border border-white/[0.05] p-3.5 flex justify-between items-center shadow-sm border-orange-500/10">
          <div><p className="text-[9px] text-orange-400 font-bold tracking-widest">ALERTAS DE RIESGO MODERADO</p><p className="text-lg font-black mt-0.5 font-mono text-orange-400">{estadisticas.advertencias}</p></div>
          <span className="text-xl bg-orange-500/5 p-2 rounded-xl border border-orange-500/10">⚡</span>
        </div>
        <div className="bg-[#12141d] rounded-2xl border border-white/[0.05] p-3.5 flex justify-between items-center shadow-sm border-red-500/10">
          <div><p className="text-[9px] text-red-400 font-bold tracking-widest">ALERTAS CRÍTICAS BLOQUEADAS</p><p className="text-lg font-black mt-0.5 font-mono text-red-400">{estadisticas.criticos}</p></div>
          <span className="text-xl bg-red-500/5 p-2 rounded-xl border border-red-500/10">⚠️</span>
        </div>
        
        {/* GRÁFICO DE BARRAS DE ACTIVIDAD AGREGADO */}
        <div className="bg-[#12141d] rounded-2xl border border-white/[0.05] p-3.5 shadow-sm transition-all duration-300 hover:border-cyan-500/10">
          <p className="text-[9px] text-white/40 font-bold tracking-widest uppercase">ACTIVIDAD RECIENTE</p>
          <div className="flex items-end gap-1.5 h-[35px] mt-2 border-b border-white/[0.04] pb-1">
            {[4, 8, 3, 9, 6, 12, 7].map((v, i) => (
              <div 
                key={i} 
                className="flex-1 rounded-t-md transition-all duration-300 hover:opacity-100" 
                style={{ height: `${v * 2.5}px`, background: i === 5 ? CORPORATE : 'rgba(255,255,255,0.08)' }} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* BARRA DE FILTRADO INTERACTIVO MAESTRO */}
      <div className="max-w-[1600px] mx-auto bg-[#12141d] rounded-2xl border border-white/[0.05] p-3.5 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center shadow-sm">
        <input 
          type="text" 
          placeholder="Buscar por usuario, IP, módulo o palabra clave..." 
          value={busqueda} 
          onChange={(e) => setBusqueda(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#23AAB3] transition-all placeholder:text-white/20"
        />
        <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/10 justify-between">
          {(["TODOS", "INFO", "ADVERTENCIA", "CRITICO"] as const).map((nivel) => (
            <button
              key={nivel}
              onClick={() => setFiltrNivel(nivel)}
              className={`flex-1 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all uppercase ${
                filtroNivel === nivel 
                  ? "bg-[#23AAB3] text-black shadow-md font-extrabold" 
                  : "text-white/40 hover:text-white"
              }`}
            >
              {nivel === "INFO" ? "INFO" : nivel === "CRITICO" ? "CRÍTICOS" : nivel === "ADVERTENCIA" ? "ALERTAS" : "TODOS"}
            </button>
          ))}
        </div>
      </div>

      {/* TABLA PRINCIPAL DEL LOG DE AUDITORÍA TOTALMENTE HOMOGÉNEA */}
      <div className="max-w-[1600px] mx-auto bg-[#12141d] rounded-2xl border border-white/[0.05] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-black/40 text-[9px] font-black tracking-widest text-white/40 uppercase border-b border-white/5">
                <th className="py-3.5 px-4">FECHA / HORA</th>
                <th className="py-3.5 px-4">CRITICIDAD</th>
                <th className="py-3.5 px-4">MÓDULO</th>
                <th className="py-3.5 px-4">OPERARIO</th>
                <th className="py-3.5 px-4">ACCIÓN DETECTADA</th>
                <th className="py-3.5 px-4">DETALLE DEL LOG</th>
                <th className="py-3.5 px-4 font-mono">DIRECCIÓN IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03] text-xs">
              {logsFiltrados.length > 0 ? (
                logsFiltrados.map((log) => {
                  const badge = getNivelEstilo(log.nivel);
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.01] transition-all duration-150">
                      <td className="py-4 px-4 font-mono text-[10px] text-white/50 whitespace-nowrap">{log.fecha}</td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap font-bold text-[#23AAB3] text-[10px] tracking-wider">{log.modulo}</td>
                      <td className="py-4 px-4 font-semibold text-white/80 whitespace-nowrap">@{log.usuario}</td>
                      <td className="py-4 px-4 font-black text-white whitespace-nowrap tracking-wide">{log.accion}</td>
                      <td className="py-4 px-4 text-white/60 font-medium leading-relaxed max-w-[340px] truncate hover:whitespace-normal hover:overflow-visible transition-all">
                        {log.detalle}
                      </td>
                      <td className="py-4 px-4 font-mono text-[10px] text-white/40 whitespace-nowrap">{log.ip}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-white/20 font-medium tracking-wide">
                    🕵️ No se registraron eventos de seguridad bajo los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER MAESTRO INMUTABLE DEL ESCRITORIO */}
      <p className="text-center text-[8px] opacity-20 tracking-[0.25em] mt-8 font-mono uppercase">
        MEIJSAC • SEGURIDAD INMUTABLE • AUDITORÍA DE PROCESOS EN CALIENTE
      </p>
    </div>
  )
}