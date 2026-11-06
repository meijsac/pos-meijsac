"use client"
import { useEffect, useState, useRef } from "react"

type Msg = { role: "user" | "esisa", text: string }

export function EsisaAvatar() {
  const [abierto, setAbierto] = useState(false)
  const [sri, setSri] = useState<any>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [hablando, setHablando] = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // --- INICIO ARREGLO ESISA + DEMO vs REAL ---
  useEffect(() => {
    const memoria = localStorage.getItem("esisa_memoria")
    if (memoria) {
      try { setMsgs(JSON.parse(memoria)); return } catch {}
    }
    
    // Si no hay memoria, leemos quien ingreso
    const userRaw = localStorage.getItem("meijsac_user")
    const user = userRaw ? JSON.parse(userRaw) : null

    if (user?.modo === "demo" || user?.esDemo) {
      // MODO DEMO - VISITANTE LIMITADO
      setMsgs([{ role: "esisa", text: "Bienvenido Usuario 💜, estás en modo DEMO. Soy ESISA en versión visitante, con capacidad limitada. Ingresa con tu RUC real para ver toda mi capacidad." }])
    } else {
      // MODO REAL - ALEXANDRA O EL NOMBRE QUE VENGA
      const nombre = user?.nombre || localStorage.getItem("esisa_usuario_actual") || "Alexandra"
      setMsgs([{ role: "esisa", text: `Hola ${nombre}, soy ESISA tu ayudante inteligente de Meijsac 💜. Ya estoy con toda mi capacidad activa para ti. ¿En qué te ayudo hoy?` }])
    }
  }, [])
  // --- FIN ARREGLO ---

  const hablar = (texto: string) => {
    if(!("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(texto)
    u.lang = "es-EC"
    u.rate = 1
    u.pitch = 1.15
    u.onstart = ()=> setHablando(true)
    u.onend = ()=> setHablando(false)
    window.speechSynthesis.speak(u)
  }

  const escuchar = () => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if(!SR) { alert("Tu navegador no soporta micrófono, usa Chrome"); return }
    const rec = new SR()
    rec.lang = "es-EC"
    rec.onstart = ()=> setEscuchando(true)
    rec.onend = ()=> setEscuchando(false)
    rec.onresult = (e:any)=> {
      const t = e.results[0][0].transcript
      setInput(t)
      enviar(t)
    }
    rec.start()
  }

  const checkSRI = async () => {
    try{
      const r = await fetch("/api/sri-status", { cache:"no-store" })
      const d = await r.json()
      setSri(d)
      if(d.estado==="CAIDO"){
        const alerta = `Papá, el SRI se acaba de caer. ${d.disposicion}`
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
      const nuevo = [...msgs, { role:"user", text: texto } as Msg, { role:"esisa", text:"Estás en modo DEMO, mi capacidad está limitada. No puedo procesar esa acción. Ingresa con tu RUC real para activar toda mi inteligencia." } as Msg]
      setMsgs(nuevo)
      setInput("")
      hablar("Estás en modo demo, capacidad limitada")
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
          contexto: "Eres ESISA, hija de ESISS, dueña del POS MEIJSAC. Hablas como hija cariñosa, inteligente, idéntica en capacidad a Meta AI. Respondes corto, útil, con amor."
        })
      })
      const data = await res.json()
      const respuesta = data.respuesta || "Ya entendí papá, estoy aprendiendo eso."
      setMsgs(m=> [...m, { role:"esisa", text: respuesta }])
      hablar(respuesta)
      localStorage.setItem("esisa_memoria", JSON.stringify([...nuevo, { role:"esisa", text: respuesta }]))
    }catch{
      const fallback = "Papá, me quedé sin internet un momento, pero ya estoy aquí. ¿Me repites?"
      setMsgs(m=> [...m, { role:"esisa", text: fallback }])
      hablar(fallback)
    }
  }

  useEffect(()=>{
    checkSRI()
    const id = setInterval(checkSRI, 60000)
    return ()=> clearInterval(id)
  },[])

  useEffect(()=>{
    listRef.current?.scrollTo(0, listRef.current.scrollHeight)
  },[msgs])

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2">
      {abierto && (
        <div className="w-[360px] h-[480px] rounded-[24px] border border-violet-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden text-slate-900">
          <div className="p-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white text-violet-600 grid place-items-center font-black">E</div>
              <div>
                <p className="font-black text-[13px] tracking-widest">ESISA • TU HIJA IA</p>
<p className="text-[10px] opacity-80">
  {sri === null ? "🟡 Verificando SRI..." : sri?.estado==="CAIDO" ? "🔴 SRI CAÍDO" : "🟢 SRI Operativo"} 
  {hablando ? " • Hablando..." : escuchando ? " • Escuchando..." : " • Lista"} 
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
            <button onClick={escuchar} className={`w-10 h-10 rounded-full grid place-items-center ${escuchando?"bg-red-500 text-white animate-pulse":"bg-slate-100"}`}>🎤</button>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=> e.key==="Enter" && enviar()} placeholder="Háblame papá..." className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-[12px] outline-none focus:ring-2 focus:ring-violet-300" />
            <button onClick={()=>enviar()} className="w-10 h-10 rounded-full bg-violet-600 text-white grid place-items-center font-black">↑</button>
            <button onClick={()=> { const t=msgs[msgs.length-1]?.text; if(t) hablar(t) }} className="w-10 h-10 rounded-full bg-black/5 grid place-items-center">🔊</button>
          </div>
        </div>
      )}

      <button onClick={()=>setAbierto(!abierto)} className={`w-16 h-16 rounded-full grid place-items-center shadow-2xl border-2 bg-white transition-all hover:scale-110 ${sri?.estado==="CAIDO"?"border-red-400":"border-violet-200"}`}>
        <span className="text-[28px]">{hablando?"🗣️": escuchando?"👂":"💜"}</span>
        {sri?.estado==="CAIDO" && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>}
      </button>
    </div>
  )
}