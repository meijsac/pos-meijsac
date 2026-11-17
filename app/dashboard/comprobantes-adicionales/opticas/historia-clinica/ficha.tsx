"use client"
import { useEffect, useState } from "react"
import { CIE10_OPTICA } from "@/lib/optica/cie10"
import { TEXTO_DATOS_OPTICA } from "@/lib/optica/consulta"
import { Marco } from "../../marco"

type Ojo = { esf: string; cil: string; eje: string; add: string }
type Vista = { od: string; oi: string; ao: string }
type Paciente = {
  id: string
  tipoDocumento: string
  identificacion: string
  nombres: string
  apellidos: string
  telefono: string
  email: string
  consentimientoAt: string | null
}
type Consulta = {
  id: string
  fechaHora: string
  estado?: string
  motivo: string
  plan?: string
  usuarioNombre: string
  anamnesis?: { usa_lentes?: boolean; tiempo_uso?: string; ultimo_control?: string; antecedentes_oculares?: string; antecedentes_sistemicos?: string; alergias?: string }
  lensometria?: { od?: Ojo; oi?: Ojo }
  refraccion?: { od?: Ojo & { avFinal?: string; dip?: string; altura?: string }; oi?: Ojo & { avFinal?: string; dip?: string; altura?: string }; material_sugerido?: string }
  agudeza?: { vl_sc?: Vista; vl_cc?: Vista; ph?: Vista; vp_sc?: Vista; vp_cc?: Vista }
  examen?: { biomicroscopia?: string; oftalmoscopia?: string }
  motilidad?: { cover_test_vl?: string; cover_test_vp?: string; ppc?: string; versiones?: string }
  diagnosticos: { codigo_cie10?: string; descripcion?: string }[]
  adendas: { id: string; texto: string; createdAt: string; usuarioNombre: string }[]
}

const ojoCero = (): Ojo => ({ esf: "0.00", cil: "0.00", eje: "0", add: "0.00" })
const vistaCero = (): Vista => ({ od: "", oi: "", ao: "" })

function mover(actual: string, delta: number, min: number, max: number, decimales: number) {
  const base = Number(actual)
  const inicio = Number.isFinite(base) ? base : 0
  const bruto = Math.min(max, Math.max(min, inicio + delta))
  const fino = decimales ? (Math.round(bruto * 4) / 4).toFixed(2) : String(Math.round(bruto))
  return fino
}

function Paso({ valor, onChange, paso, min, max, decimales }: { valor: string; onChange: (valor: string) => void; paso: number; min: number; max: number; decimales: number }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(mover(valor, -paso, min, max, decimales))} className="w-6 h-7 rounded bg-slate-800 text-white">-</button>
      <input value={valor} onChange={(e) => onChange(e.target.value)} className="w-16 bg-black border border-slate-700 rounded px-1 py-1 text-center text-xs" />
      <button type="button" onClick={() => onChange(mover(valor, paso, min, max, decimales))} className="w-6 h-7 rounded bg-slate-800 text-white">+</button>
    </div>
  )
}

function Ojos({ od, oi, onOd, onOi }: { od: Ojo; oi: Ojo; onOd: (ojo: Ojo) => void; onOi: (ojo: Ojo) => void }) {
  const fila = (lado: "OD" | "OI", ojo: Ojo, cambiar: (ojo: Ojo) => void) => (
    <div className="grid grid-cols-5 gap-2 items-end">
      <b className="text-xs text-teal-300">{lado}</b>
      <label className="text-[10px] text-slate-400">Esf<Paso valor={ojo.esf} paso={0.25} min={-30} max={30} decimales={2} onChange={(esf) => cambiar({ ...ojo, esf })} /></label>
      <label className="text-[10px] text-slate-400">Cil<Paso valor={ojo.cil} paso={0.25} min={-30} max={30} decimales={2} onChange={(cil) => cambiar({ ...ojo, cil })} /></label>
      <label className="text-[10px] text-slate-400">Eje<Paso valor={ojo.eje} paso={5} min={0} max={180} decimales={0} onChange={(eje) => cambiar({ ...ojo, eje })} /></label>
      <label className="text-[10px] text-slate-400">Add<Paso valor={ojo.add} paso={0.25} min={0} max={4} decimales={2} onChange={(add) => cambiar({ ...ojo, add })} /></label>
    </div>
  )
  return (
    <div className="space-y-2">
      {fila("OD", od, onOd)}
      {fila("OI", oi, onOi)}
      <button type="button" onClick={() => onOi({ ...od })} className="text-[11px] font-bold text-teal-300">Copiar ojo derecho al izquierdo</button>
    </div>
  )
}

async function pedir(url: string, cuerpo?: unknown, metodo = cuerpo ? "POST" : "GET") {
  const res = await fetch(url, {
    method: metodo,
    headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "No se pudo completar")
  return data
}

export function FichaOptica() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [aviso, setAviso] = useState("")
  const [error, setError] = useState("")
  const [usuario, setUsuario] = useState("")
  const [sucursales, setSucursales] = useState<{ id: string; codigo: string; nombre: string }[]>([])
  const [sucursalId, setSucursalId] = useState("")
  const [editId, setEditId] = useState("")
  const [unicodigo, setUnicodigo] = useState("")
  const [cedulaProfesional, setCedulaProfesional] = useState("")
  const [registroAcess, setRegistroAcess] = useState("")
  const [registroSenescyt, setRegistroSenescyt] = useState("")
  const [nuevo, setNuevo] = useState({ tipoDocumento: "CEDULA", identificacion: "", nombres: "", apellidos: "", fechaNacimiento: "", sexo: "", telefono: "", email: "", direccion: "", ocupacion: "", consentimiento: false })
  const [motivo, setMotivo] = useState("")
  const [anamnesis, setAnamnesis] = useState({ usaLentes: false, tiempoUso: "", ultimoControl: "", antecedentesOculares: "", antecedentesSistemicos: "", alergias: "" })
  const [lenteOd, setLenteOd] = useState<Ojo>(ojoCero())
  const [lenteOi, setLenteOi] = useState<Ojo>(ojoCero())
  const [rxOd, setRxOd] = useState<Ojo>(ojoCero())
  const [rxOi, setRxOi] = useState<Ojo>(ojoCero())
  const [extraOd, setExtraOd] = useState({ prisma: "", dip: "", altura: "", avFinal: "" })
  const [extraOi, setExtraOi] = useState({ prisma: "", dip: "", altura: "", avFinal: "" })
  const [material, setMaterial] = useState("")
  const [agudeza, setAgudeza] = useState({ vlSc: vistaCero(), vlCc: vistaCero(), ph: vistaCero(), vpSc: vistaCero(), vpCc: vistaCero() })
  const [examen, setExamen] = useState({ biomicroscopia: "", oftalmoscopia: "" })
  const [motilidad, setMotilidad] = useState({ coverVl: "", coverVp: "", ppc: "", versiones: "" })
  const [plan, setPlan] = useState("")
  const [diagnosticos, setDiagnosticos] = useState<{ codigo: string; descripcion: string }[]>([])
  const [buscaCie, setBuscaCie] = useState("")
  const [nota, setNota] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  async function cargar(q = "") {
    const data = await pedir(`/api/optica/pacientes${q ? `?q=${encodeURIComponent(q)}` : ""}`)
    setPacientes(data.pacientes || [])
    setUsuario(data.usuario?.nombre || "")
    setUnicodigo(data.config?.unicodigo || "")
    setCedulaProfesional(data.config?.cedulaProfesional || "")
    setRegistroAcess(data.config?.registroAcess || "")
    setRegistroSenescyt(data.config?.registroSenescyt || "")
  }

  async function abrir(fila: Paciente) {
    setPaciente(fila)
    setError("")
    const data = await pedir(`/api/optica/consultas?pacienteId=${fila.id}`)
    setConsultas(data.consultas || [])
  }

  useEffect(() => {
    cargar().catch((e) => setError(e.message))
    pedir("/api/optica/sucursales").then((data) => setSucursales(data.sucursales || [])).catch(() => {})
  }, [])

  async function guardarPaciente() {
    setGuardando(true)
    setError("")
    try {
      const data = await pedir("/api/optica/pacientes", nuevo)
      setNuevo({ tipoDocumento: "CEDULA", identificacion: "", nombres: "", apellidos: "", fechaNacimiento: "", sexo: "", telefono: "", email: "", direccion: "", ocupacion: "", consentimiento: false })
      await cargar(busqueda)
      await abrir(data.paciente)
      setAviso("Paciente guardado")
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar")
    } finally {
      setGuardando(false)
    }
  }

  async function guardarConsulta() {
    if (!paciente) return
    setGuardando(true)
    setError("")
    try {
      const cuerpo = {
        pacienteId: paciente.id,
        motivo,
        anamnesis,
        lensometria: { od: lenteOd, oi: lenteOi },
        agudeza: { vlSc: agudeza.vlSc, vlCc: agudeza.vlCc, ph: agudeza.ph, vpSc: agudeza.vpSc, vpCc: agudeza.vpCc },
        examen,
        motilidad,
        refraccion: { od: { ...rxOd, ...extraOd }, oi: { ...rxOi, ...extraOi }, material },
        diagnosticos,
        plan,
        profesional: { nombre: usuario, cedula: cedulaProfesional, registroAcess, registroSenescyt },
        unicodigo,
        sucursalId,
      }
      if (editId) await pedir(`/api/optica/consultas/${editId}`, cuerpo, "PATCH")
      else await pedir("/api/optica/consultas", { ...cuerpo, pacienteId: paciente.id })
      setEditId("")
      setMotivo("")
      setPlan("")
      setDiagnosticos([])
      setAviso("Consulta guardada y abierta. Ciérrala para emitir la receta. No se puede borrar.")
      await abrir(paciente)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar")
    } finally {
      setGuardando(false)
    }
  }

  function ojoGuardado(valor?: Partial<Ojo>): Ojo {
    return { esf: Number(valor?.esf || 0).toFixed(2), cil: Number(valor?.cil || 0).toFixed(2), eje: String(valor?.eje || 0), add: Number(valor?.add || 0).toFixed(2) }
  }

  function continuarConsulta(consulta: Consulta) {
    const vista = (fila?: Vista) => ({ od: fila?.od || "", oi: fila?.oi || "", ao: fila?.ao || "" })
    setEditId(consulta.id)
    setMotivo(consulta.motivo || "")
    setPlan(consulta.plan || "")
    setAnamnesis({
      usaLentes: !!consulta.anamnesis?.usa_lentes,
      tiempoUso: consulta.anamnesis?.tiempo_uso || "",
      ultimoControl: consulta.anamnesis?.ultimo_control || "",
      antecedentesOculares: consulta.anamnesis?.antecedentes_oculares || "",
      antecedentesSistemicos: consulta.anamnesis?.antecedentes_sistemicos || "",
      alergias: consulta.anamnesis?.alergias || "",
    })
    setLenteOd(ojoGuardado(consulta.lensometria?.od))
    setLenteOi(ojoGuardado(consulta.lensometria?.oi))
    setRxOd(ojoGuardado(consulta.refraccion?.od))
    setRxOi(ojoGuardado(consulta.refraccion?.oi))
    setExtraOd({ prisma: "", dip: String(consulta.refraccion?.od?.dip || ""), altura: String(consulta.refraccion?.od?.altura || ""), avFinal: consulta.refraccion?.od?.avFinal || "" })
    setExtraOi({ prisma: "", dip: String(consulta.refraccion?.oi?.dip || ""), altura: String(consulta.refraccion?.oi?.altura || ""), avFinal: consulta.refraccion?.oi?.avFinal || "" })
    setMaterial(consulta.refraccion?.material_sugerido || "")
    setAgudeza({ vlSc: vista(consulta.agudeza?.vl_sc), vlCc: vista(consulta.agudeza?.vl_cc), ph: vista(consulta.agudeza?.ph), vpSc: vista(consulta.agudeza?.vp_sc), vpCc: vista(consulta.agudeza?.vp_cc) })
    setExamen({ biomicroscopia: consulta.examen?.biomicroscopia || "", oftalmoscopia: consulta.examen?.oftalmoscopia || "" })
    setMotilidad({ coverVl: consulta.motilidad?.cover_test_vl || "", coverVp: consulta.motilidad?.cover_test_vp || "", ppc: consulta.motilidad?.ppc || "", versiones: consulta.motilidad?.versiones || "" })
    setDiagnosticos((consulta.diagnosticos || []).map((d) => ({ codigo: d.codigo_cie10 || "", descripcion: d.descripcion || "" })).filter((d) => d.codigo))
  }

  async function cerrarConsulta(id: string) {
    if (!paciente) return
    setError("")
    try {
      await pedir(`/api/optica/consultas/${id}/cerrar`, {})
      setAviso("Consulta cerrada. La receta quedó en la orden de trabajo.")
      await abrir(paciente)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cerrar")
    }
  }

  async function agregarNota(id: string) {
    const texto = (nota[id] || "").trim()
    if (!texto || !paciente) return
    setError("")
    try {
      await pedir(`/api/optica/consultas/${id}/adenda`, { texto })
      setNota((prev) => ({ ...prev, [id]: "" }))
      await abrir(paciente)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar la nota")
    }
  }

  const coincidencias = CIE10_OPTICA.filter((fila) => `${fila.codigo} ${fila.descripcion}`.toLowerCase().includes(buscaCie.trim().toLowerCase())).slice(0, 6)
  const campo = "w-full bg-black border border-slate-700 rounded-lg px-3 py-2 text-sm"

  return (
    <Marco titulo="Ópticas · Historia clínica">
      <p className="text-sm text-slate-300">La consulta guardada no se elimina. Si hay un error, se agrega una nota con fecha y usuario. El PDF queda listo para el sello del optometrista.</p>
      {error ? <p className="text-sm font-bold text-red-300">{error}</p> : null}
      {aviso ? <p className="text-sm font-bold text-teal-300">{aviso}</p> : null}
      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-3">
          <input value={busqueda} onChange={(e) => { setBusqueda(e.target.value); cargar(e.target.value).catch(() => {}) }} placeholder="Buscar paciente" className={campo} />
          {pacientes.map((fila) => (
            <button key={fila.id} type="button" onClick={() => abrir(fila)} className={`w-full text-left rounded-xl border px-3 py-2 ${paciente?.id === fila.id ? "border-teal-400 bg-teal-400/10" : "border-slate-800 bg-[#111827]"}`}>
              <b className="block text-sm">{fila.apellidos} {fila.nombres}</b>
              <span className="text-[11px] text-slate-400">{fila.identificacion}</span>
            </button>
          ))}
        </div>
        <div className="space-y-6">
          <section className="bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-3">
            <h2 className="font-black">Nuevo paciente</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              <select value={nuevo.tipoDocumento} onChange={(e) => setNuevo({ ...nuevo, tipoDocumento: e.target.value })} className={campo}><option value="CEDULA">Cédula</option><option value="PASAPORTE">Pasaporte</option></select>
              <input value={nuevo.identificacion} onChange={(e) => setNuevo({ ...nuevo, identificacion: e.target.value })} placeholder="Identificación" className={campo} />
              <input value={nuevo.nombres} onChange={(e) => setNuevo({ ...nuevo, nombres: e.target.value })} placeholder="Nombres" className={campo} />
              <input value={nuevo.apellidos} onChange={(e) => setNuevo({ ...nuevo, apellidos: e.target.value })} placeholder="Apellidos" className={campo} />
              <input type="date" value={nuevo.fechaNacimiento} onChange={(e) => setNuevo({ ...nuevo, fechaNacimiento: e.target.value })} className={campo} />
              <select value={nuevo.sexo} onChange={(e) => setNuevo({ ...nuevo, sexo: e.target.value })} className={campo}><option value="">Sexo</option><option value="F">Femenino</option><option value="M">Masculino</option></select>
              <input value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} placeholder="Teléfono" className={campo} />
              <input value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} placeholder="Correo" className={campo} />
              <input value={nuevo.direccion} onChange={(e) => setNuevo({ ...nuevo, direccion: e.target.value })} placeholder="Dirección" className={`${campo} sm:col-span-2`} />
              <input value={nuevo.ocupacion} onChange={(e) => setNuevo({ ...nuevo, ocupacion: e.target.value })} placeholder="Ocupación" className={`${campo} sm:col-span-2`} />
            </div>
            <label className="flex gap-2 text-sm text-slate-200"><input type="checkbox" checked={nuevo.consentimiento} onChange={(e) => setNuevo({ ...nuevo, consentimiento: e.target.checked })} />{TEXTO_DATOS_OPTICA}</label>
            <button type="button" disabled={guardando} onClick={guardarPaciente} className="bg-teal-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl">Guardar paciente</button>
          </section>

          {paciente ? (
            <section className="bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-4">
              <h2 className="font-black">Consulta de {paciente.nombres} {paciente.apellidos}</h2>
              <p className="text-xs text-slate-400">La guarda {usuario || "el usuario de esta sesión"}. Mientras esté abierta se puede corregir. Al cerrarla sale la receta y ya no se modifica.</p>
              <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} className={campo}>
                <option value="">Sucursal de la atención</option>
                {sucursales.map((fila) => <option key={fila.codigo + fila.id} value={fila.id}>{fila.codigo} {fila.nombre}</option>)}
              </select>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de consulta" className={campo} />
              <div className="grid sm:grid-cols-2 gap-2">
                <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={anamnesis.usaLentes} onChange={(e) => setAnamnesis({ ...anamnesis, usaLentes: e.target.checked })} />Usa lentes</label>
                <input value={anamnesis.tiempoUso} onChange={(e) => setAnamnesis({ ...anamnesis, tiempoUso: e.target.value })} placeholder="Tiempo de uso" className={campo} />
                <input type="date" value={anamnesis.ultimoControl} onChange={(e) => setAnamnesis({ ...anamnesis, ultimoControl: e.target.value })} className={campo} />
                <input value={anamnesis.alergias} onChange={(e) => setAnamnesis({ ...anamnesis, alergias: e.target.value })} placeholder="Alergias" className={campo} />
                <input value={anamnesis.antecedentesOculares} onChange={(e) => setAnamnesis({ ...anamnesis, antecedentesOculares: e.target.value })} placeholder="Antecedentes oculares" className={campo} />
                <input value={anamnesis.antecedentesSistemicos} onChange={(e) => setAnamnesis({ ...anamnesis, antecedentesSistemicos: e.target.value })} placeholder="Antecedentes sistémicos" className={campo} />
              </div>
              <div>
                <h3 className="text-sm font-black mb-2">Lensometría</h3>
                <Ojos od={lenteOd} oi={lenteOi} onOd={setLenteOd} onOi={setLenteOi} />
              </div>
              <div>
                <h3 className="text-sm font-black mb-2">Agudeza visual Snellen</h3>
                {([
                  ["vlSc", "Lejos sin corrección"],
                  ["vlCc", "Lejos con corrección"],
                  ["ph", "Agujero estenopeico"],
                  ["vpSc", "Cerca sin corrección"],
                  ["vpCc", "Cerca con corrección"],
                ] as const).map(([clave, titulo]) => (
                  <div key={clave} className="grid grid-cols-4 gap-2 mb-2 items-center">
                    <span className="text-[11px] text-slate-400">{titulo}</span>
                    {(["od", "oi", "ao"] as const).map((lado) => (
                      <input key={lado} value={agudeza[clave][lado]} onChange={(e) => setAgudeza({ ...agudeza, [clave]: { ...agudeza[clave], [lado]: e.target.value } })} placeholder={lado.toUpperCase()} className={campo} />
                    ))}
                  </div>
                ))}
              </div>
              <textarea value={examen.biomicroscopia} onChange={(e) => setExamen({ ...examen, biomicroscopia: e.target.value })} placeholder="Biomicroscopía" className={campo} />
              <textarea value={examen.oftalmoscopia} onChange={(e) => setExamen({ ...examen, oftalmoscopia: e.target.value })} placeholder="Oftalmoscopía" className={campo} />
              <div className="grid sm:grid-cols-2 gap-2">
                <input value={motilidad.coverVl} onChange={(e) => setMotilidad({ ...motilidad, coverVl: e.target.value })} placeholder="Cover test lejos" className={campo} />
                <input value={motilidad.coverVp} onChange={(e) => setMotilidad({ ...motilidad, coverVp: e.target.value })} placeholder="Cover test cerca" className={campo} />
                <input value={motilidad.ppc} onChange={(e) => setMotilidad({ ...motilidad, ppc: e.target.value })} placeholder="PPC" className={campo} />
                <input value={motilidad.versiones} onChange={(e) => setMotilidad({ ...motilidad, versiones: e.target.value })} placeholder="Versiones" className={campo} />
              </div>
              <div>
                <h3 className="text-sm font-black mb-2">Refracción final</h3>
                <Ojos od={rxOd} oi={rxOi} onOd={setRxOd} onOi={setRxOi} />
                <div className="grid sm:grid-cols-2 gap-2 mt-2">
                  <input value={extraOd.avFinal} onChange={(e) => setExtraOd({ ...extraOd, avFinal: e.target.value })} placeholder="AV final OD" className={campo} />
                  <input value={extraOi.avFinal} onChange={(e) => setExtraOi({ ...extraOi, avFinal: e.target.value })} placeholder="AV final OI" className={campo} />
                  <input value={extraOd.dip} onChange={(e) => setExtraOd({ ...extraOd, dip: e.target.value })} placeholder="DIP OD" className={campo} />
                  <input value={extraOi.dip} onChange={(e) => setExtraOi({ ...extraOi, dip: e.target.value })} placeholder="DIP OI" className={campo} />
                  <input value={extraOd.altura} onChange={(e) => setExtraOd({ ...extraOd, altura: e.target.value })} placeholder="Altura OD" className={campo} />
                  <input value={extraOi.altura} onChange={(e) => setExtraOi({ ...extraOi, altura: e.target.value })} placeholder="Altura OI" className={campo} />
                </div>
                <input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Material sugerido" className={`${campo} mt-2`} />
              </div>
              <div>
                <h3 className="text-sm font-black mb-2">Diagnóstico CIE-10</h3>
                <input value={buscaCie} onChange={(e) => setBuscaCie(e.target.value)} placeholder="Buscar hipermetropía, miopía, H52..." className={campo} />
                <div className="flex flex-wrap gap-2 mt-2">
                  {coincidencias.map((fila) => (
                    <button key={fila.codigo} type="button" onClick={() => setDiagnosticos((prev) => prev.some((d) => d.codigo === fila.codigo) ? prev : [...prev, fila])} className="text-[11px] border border-slate-700 rounded-full px-2 py-1">{fila.codigo} {fila.descripcion}</button>
                  ))}
                </div>
                <div className="mt-2 text-sm">{diagnosticos.map((fila) => <span key={fila.codigo} className="inline-block mr-2">{fila.codigo} {fila.descripcion}</span>)}</div>
              </div>
              <textarea value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Plan" className={campo} />
              <div className="grid sm:grid-cols-2 gap-2">
                <input value={unicodigo} onChange={(e) => setUnicodigo(e.target.value)} placeholder="Unicódigo ACESS" className={campo} />
                <input value={cedulaProfesional} onChange={(e) => setCedulaProfesional(e.target.value)} placeholder="Cédula del optometrista" className={campo} />
                <input value={registroAcess} onChange={(e) => setRegistroAcess(e.target.value)} placeholder="Registro ACESS" className={campo} />
                <input value={registroSenescyt} onChange={(e) => setRegistroSenescyt(e.target.value)} placeholder="Registro SENESCYT" className={campo} />
              </div>
              <button type="button" disabled={guardando} onClick={guardarConsulta} className="bg-teal-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl">{editId ? "Actualizar consulta abierta" : "Guardar consulta abierta"}</button>
            </section>
          ) : null}

          <section className="space-y-3">
            {consultas.map((consulta) => (
              <article key={consulta.id} className="bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-2">
                <b>{new Date(consulta.fechaHora).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })} · {consulta.estado === "CERRADA" ? "Cerrada" : "Abierta"}</b>
                <p className="text-sm">{consulta.motivo}</p>
                <p className="text-xs text-slate-400">Atendió {consulta.usuarioNombre}. {(consulta.diagnosticos || []).map((d) => d.codigo_cie10).filter(Boolean).join(", ")}</p>
                <div className="flex gap-3 text-xs font-bold">
                  <a className="text-teal-300" target="_blank" href={`/dashboard/comprobantes-adicionales/opticas/imprimir/${consulta.id}`}>PDF historia</a>
                  <a className="text-teal-300" target="_blank" href={`/dashboard/comprobantes-adicionales/opticas/imprimir/${consulta.id}?tipo=receta`}>PDF receta</a>
                  {consulta.estado !== "CERRADA" ? <button type="button" onClick={() => continuarConsulta(consulta)} className="text-teal-300">Continuar</button> : null}
                  {consulta.estado !== "CERRADA" ? <button type="button" onClick={() => cerrarConsulta(consulta.id)} className="text-amber-300">Cerrar y emitir receta</button> : null}
                </div>
                {consulta.adendas.map((adenda) => <p key={adenda.id} className="text-xs text-slate-300">Nota {new Date(adenda.createdAt).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })} · {adenda.usuarioNombre}: {adenda.texto}</p>)}
                <div className="flex gap-2">
                  <input value={nota[consulta.id] || ""} onChange={(e) => setNota({ ...nota, [consulta.id]: e.target.value })} placeholder="Nota aclaratoria" className={campo} />
                  <button type="button" onClick={() => agregarNota(consulta.id)} className="text-xs font-bold px-3 rounded-xl bg-slate-800">Agregar</button>
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>
    </Marco>
  )
}
