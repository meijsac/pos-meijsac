"use client"
import { useEffect, useState, useRef } from "react"
import { usePathname } from "next/navigation"

type Msg = { role: "user" | "esisa", text: string }

function textoHumano(valor: unknown) {
  const texto = String(valor || "").replace(/\s+/g, " ").trim()
  const digitos = texto.replace(/\D/g, "")
  if (!texto || digitos.length >= 10) return ""
  return texto
}

function saludoEsisa() {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/login")) {
    return "Hola, ¿en qué te puedo ayudar?"
  }
  let usuario = ""
  let empresa = ""
  try {
    const user = JSON.parse(localStorage.getItem("meijsac_user") || "null")
    usuario = textoHumano(user?.nombre) || textoHumano(localStorage.getItem("esisa_usuario_actual"))
  } catch {}
  try {
    const casa = JSON.parse(localStorage.getItem("meijsac_empresa") || "null")
    empresa = textoHumano(casa?.razonSocial) || textoHumano(casa?.razon) || textoHumano(casa?.nombreComercial) || textoHumano(casa?.empresa)
  } catch {}
  if (usuario && empresa) return `Hola ${usuario} de ${empresa}, qué bueno verte de nuevo, ¿qué hacemos ahora?`
  if (usuario || empresa) return `Hola ${usuario || empresa}, qué bueno verte de nuevo, ¿qué hacemos ahora?`
  return "Hola, qué bueno verte de nuevo"
}

function sinNumerosLargos(texto: string) {
  return texto.replace(/\d[\d\s-]{8,}\d/g, "").replace(/\s{2,}/g, " ").trim()
}

export function EsisaAvatar() {
  const [abierto, setAbierto] = useState(false)
  const [sri, setSri] = useState<any>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [hablando, setHablando] = useState(false)
  const [silencio, setSilencio] = useState(false)
  const silencioRef = useRef(false)
  const pathname = usePathname()
  const listRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const posRef = useRef<{ x: number; y: number } | null>(null)
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null)

  useEffect(() => {
    const guardada = localStorage.getItem("esisa_pos")
    if (!guardada) return
    try {
      const p = JSON.parse(guardada)
      if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) {
        posRef.current = p
        setPos(p)
      }
    } catch {}
  }, [])

  useEffect(() => {
    const saludo = saludoEsisa()
    const memoria = localStorage.getItem("esisa_memoria")
    if (memoria) {
      try {
        const previa = JSON.parse(memoria) as Msg[]
        const charla = Array.isArray(previa) ? previa.filter((m) => m?.role === "user" || (m?.role === "esisa" && !/papá|ruc/i.test(String(m.text || "")))) : []
        let yaHablo = false
        const resto = charla.filter((m) => {
          if (!yaHablo && m.role === "esisa") return false
          if (m.role === "user") yaHablo = true
          return true
        })
        if (resto.length) {
          setMsgs([{ role: "esisa", text: saludo }, ...resto])
          return
        }
      } catch {}
    }
    setMsgs([{ role: "esisa", text: saludo }])
  }, [pathname])

  const hablar = (texto: string) => {
    const limpio = sinNumerosLargos(texto)
    if (!limpio || silencioRef.current || !("speechSynthesis" in window)) return
    const voces = window.speechSynthesis.getVoices()
    const enEspanol = voces.filter((v) => /^es([-_]|$)/i.test(v.lang) && !/^es-ES/i.test(v.lang))
    const pool = enEspanol.length ? enEspanol : voces.filter((v) => /^es([-_]|$)/i.test(v.lang))
    const voz = pool.find((v) => /paulina|sabina|angelica|ángela|mia|sof[ií]a|luc[ií]a|camila|renata|dalia|m[oó]nica|laura|female|mujer/i.test(v.name)) || pool[0]
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(limpio)
    u.lang = voz?.lang || "es-MX"
    u.rate = 0.95
    u.pitch = 1
    if (voz) u.voice = voz
    u.onstart = () => setHablando(true)
    u.onend = () => setHablando(false)
    window.speechSynthesis.speak(u)
  }

  const silenciar = () => {
    const siguiente = !silencioRef.current
    silencioRef.current = siguiente
    setSilencio(siguiente)
    if (siguiente && "speechSynthesis" in window) window.speechSynthesis.cancel()
    setHablando(false)
  }

  const checkSRI = async () => {
    try{
      const r = await fetch("/api/sri-status", { cache:"no-store" })
      const d = await r.json()
      setSri(d)
      if(d.estado==="CAIDO"){
        const alerta = "Tranquila, yo te ayudo. El servicio del SRI no está respondiendo ahora. Lo dejamos guardado y seguimos cuando vuelva. ¿qué hacemos ahora?"
        setMsgs(m=> [...m, { role:"esisa", text: alerta }])
        hablar(alerta)
        setAbierto(true)
      }
    }catch{}
  }

  const enviar = async (textoManual?: string) => {
    const texto = (textoManual || input).trim()
    if(!texto) return

    const userRaw = localStorage.getItem("meijsac_user")
    const user = userRaw ? JSON.parse(userRaw) : null
    const esDemo = user?.modo === "demo" || user?.esDemo

    // SI ES DEMO, LIMITAMOS CAPACIDAD
    if(esDemo){
      const aviso = "Tranquila, yo te ayudo. Desde la visita te oriento con lo básico, paso a paso. ¿qué hacemos ahora?"
      const nuevo = [...msgs, { role:"user", text: texto } as Msg, { role:"esisa", text: aviso } as Msg]
      setMsgs(nuevo)
      setInput("")
      hablar(aviso)
      return
    }

    const nuevo = [...msgs, { role:"user", text: texto } as Msg]
    setMsgs(nuevo)
    setInput("")
    
    try{
      const res = await fetch("/api/esisa/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ 
          mensaje: texto, 
          historial: nuevo.slice(-8),
          sriEstado: sri,
          contexto: "Eres ESISA. Hablas cálida, en español latino, explicas fácil y paso a paso. Dices tranquila, yo te ayudo. No regañas, no repites la misma frase y no lees números de identificación. Cierras con ¿qué hacemos ahora?"
        })
      })
      const data = await res.json()
      const respuesta = data.respuesta || "Tranquila, yo te ayudo. Lo vemos paso a paso. ¿qué hacemos ahora?"
      setMsgs(m=> [...m, { role:"esisa", text: respuesta }])
      hablar(respuesta)
      localStorage.setItem("esisa_memoria", JSON.stringify([...nuevo, { role:"esisa", text: respuesta }]))
    }catch{
      const fallback = "Tranquila, yo te ayudo. Se cortó un momento la conexión y ya estoy de vuelta. ¿qué hacemos ahora?"
      setMsgs(m=> [...m, { role:"esisa", text: fallback }])
      hablar(fallback)
    }
  }

  useEffect(() => {
    if (!("speechSynthesis" in window)) return
    window.speechSynthesis.getVoices()
    const cargar = () => window.speechSynthesis.getVoices()
    window.speechSynthesis.addEventListener("voiceschanged", cargar)
    return () => window.speechSynthesis.removeEventListener("voiceschanged", cargar)
  }, [])

  useEffect(() => {
    if (!abierto) return
    hablar(saludoEsisa())
  }, [abierto])

  useEffect(()=>{
    checkSRI()
    const id = setInterval(checkSRI, 60000)
    return ()=> clearInterval(id)
  },[])

  useEffect(()=>{
    listRef.current?.scrollTo(0, listRef.current.scrollHeight)
  },[msgs])

  const panelArriba = !pos || pos.y > 520
  const panelDerecha = !!pos && typeof window !== "undefined" && pos.x > window.innerWidth - 380

  return (
    <div className={`fixed z-[9999] ${pos ? "" : "bottom-5 left-5"}`} style={pos ? { left: pos.x, top: pos.y } : undefined}>
      {abierto && (
        <div className={`absolute w-[360px] h-[480px] rounded-[24px] border border-violet-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden text-slate-900 ${panelArriba ? "bottom-full mb-2" : "top-full mt-2"} ${panelDerecha ? "right-0" : "left-0"}`}>
          <div className="p-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white text-violet-600 grid place-items-center font-black">E</div>
              <div>
                <p className="font-black text-[13px] tracking-widest">ESISA</p>
<p className="text-[10px] opacity-80">
  {sri === null ? "🟡 Verificando SRI..." : sri?.estado==="CAIDO" ? "🔴 SRI CAÍDO" : "🟢 SRI Operativo"} 
  {silencio ? " • En silencio" : hablando ? " • Hablando..." : " • Lista"} 
</p>
              </div>
            </div>
            <button onClick={()=>setAbierto(false)} className="bg-white/20 px-3 py-1 rounded-full text-[11px]">✕</button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#faf8ff]">
            {msgs.map((m,i)=>(
              <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12px] leading-[1.3] ${m.role==="user"?"bg-violet-600 text-white ml-auto rounded-br-sm":"bg-white border text-slate-800 mr-auto rounded-bl-sm shadow-sm"}`}>
                {m.text}
              </div>
            ))}
            {sri && sri.estado && (
  <div className={`text-[10px] p-2 rounded-xl border ${sri.estado==="CAIDO"?"bg-red-50 border-red-200 text-red-700":"bg-green-50 border-green-200 text-green-700"}`}>
    <b>SRI {sri.estado === "CAIDO" ? "no responde - Contingencia" : "Operativo"}:</b> {sri.mensaje} 
  </div>
)}
          </div>

          <div className="p-3 border-t bg-white flex gap-2 items-center">
            <button type="button" onClick={silenciar} aria-label={silencio ? "Activar la voz" : "Silenciar"} className={`w-10 h-10 rounded-full grid place-items-center ${silencio ? "bg-slate-300" : "bg-slate-100"}`}>{silencio ? "🔇" : "🎤"}</button>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=> e.key==="Enter" && enviar()} placeholder="Cuéntame y te ayudo" className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-[12px] outline-none focus:ring-2 focus:ring-violet-300" />
            <button onClick={()=>enviar()} className="w-10 h-10 rounded-full bg-violet-600 text-white grid place-items-center font-black">↑</button>
            <button onClick={()=> { const t=msgs[msgs.length-1]?.text; if(t) hablar(t) }} className="w-10 h-10 rounded-full bg-black/5 grid place-items-center">🔊</button>
          </div>
        </div>
      )}

      <button
        type="button"
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, sx: e.clientX, sy: e.clientY, moved: false }
          const inicio = { x: rect.left, y: rect.top }
          posRef.current = inicio
          setPos(inicio)
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          if (Math.hypot(e.clientX - drag.current.sx, e.clientY - drag.current.sy) > 4) drag.current.moved = true
          const next = {
            x: Math.min(Math.max(8, e.clientX - drag.current.dx), window.innerWidth - 72),
            y: Math.min(Math.max(8, e.clientY - drag.current.dy), window.innerHeight - 72),
          }
          posRef.current = next
          setPos(next)
        }}
        onPointerUp={() => {
          const movio = drag.current?.moved
          drag.current = null
          if (movio) {
            if (posRef.current) localStorage.setItem("esisa_pos", JSON.stringify(posRef.current))
            return
          }
          setAbierto((v) => !v)
        }}
        className={`relative w-16 h-16 rounded-full grid place-items-center shadow-2xl border-2 bg-white cursor-grab active:cursor-grabbing touch-none ${sri?.estado==="CAIDO"?"border-red-400":"border-violet-200"}`}
      >
        <span className="text-[28px]">{hablando ? "🗣️" : "💜"}</span>
        {sri?.estado==="CAIDO" && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>}
      </button>
    </div>
  )
}