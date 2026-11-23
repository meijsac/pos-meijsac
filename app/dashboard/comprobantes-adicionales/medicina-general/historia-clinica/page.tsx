"use client"
import { useEffect, useMemo, useState } from "react"
import { Marco } from "../../marco"
import { buscarCie10 } from "@/lib/clinica/cie10"
import { bandaImcAdulto, cantidadEnLetras, edadDesde, fppDesde, imcDe, semanasDesde } from "@/lib/clinica/calculo"

type Paciente = {
  id: string
  tipoDocumento: string
  identificacion: string
  nombres: string
  apellidos: string
  fechaNacimiento: string | null
  sexo: string
  grupoSanguineo: string
  alergias: string
  telefono: string
  email: string
  direccion: string
  numeroHistoria: string
}
type Archivo = { id: string; nombre: string; mime: string; clase: string; interpretacion: string }
type Diagnostico = { codigo: string; nombre: string; tipo: string }
type Orden = { clase: string; nombre: string; estado: string }
type Medicamento = { generico: string; comercial: string; concentracion: string; forma: string; cantidad: string; cantidadLetras: string; dosis: string; via: string; frecuencia: string; duracion: string; alarma: string }
type Consulta = {
  id: string
  plantilla: string
  estado: string
  motivo: string
  enfermedad: string
  antecedentes: string
  examenFisico: string
  signos: Record<string, string>
  especialidad: Record<string, string>
  diagnosticos: Diagnostico[]
  ordenes: Orden[]
  receta: Medicamento[]
  paciente: Paciente
  archivos: Archivo[]
}

const PLANTILLAS = [
  ["general", "Medicina general"],
  ["ginecologia", "Ginecología y obstetricia"],
  ["pediatria", "Pediatría"],
] as const

const medicamentoVacio = (): Medicamento => ({ generico: "", comercial: "", concentracion: "", forma: "", cantidad: "", cantidadLetras: "", dosis: "", via: "Oral", frecuencia: "", duracion: "", alarma: "" })

function campo(clase: string) {
  return `w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500 ${clase}`
}

export default function HistoriaClinicaMedicina() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [aviso, setAviso] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [cie, setCie] = useState("")
  const [tipoDx, setTipoDx] = useState("Definitivo")
  const [nuevo, setNuevo] = useState({ tipoDocumento: "CEDULA", identificacion: "", nombres: "", apellidos: "", fechaNacimiento: "", sexo: "", grupoSanguineo: "", alergias: "", telefono: "", consentimiento: false })

  const cargarPacientes = async (q = "") => {
    const res = await fetch(`/api/clinica/pacientes?q=${encodeURIComponent(q)}`, { credentials: "same-origin" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setAviso(data.error || "No se pudieron leer los pacientes"); return }
    setPacientes(Array.isArray(data.pacientes) ? data.pacientes : [])
  }

  const cargarConsultas = async (pacienteId: string) => {
    const res = await fetch(`/api/clinica/consultas?pacienteId=${encodeURIComponent(pacienteId)}`, { credentials: "same-origin" })
    const data = await res.json().catch(() => ({}))
    setConsultas(Array.isArray(data.consultas) ? data.consultas : [])
  }

  useEffect(() => { void cargarPacientes() }, [])

  const imc = useMemo(() => imcDe(consulta?.signos?.peso, consulta?.signos?.talla), [consulta?.signos?.peso, consulta?.signos?.talla])
  const cerrada = consulta?.estado === "CERRADA"

  const elegir = async (item: Paciente) => {
    setPaciente(item)
    setConsulta(null)
    await cargarConsultas(item.id)
  }

  const crearPaciente = async () => {
    setAviso("")
    const res = await fetch("/api/clinica/pacientes", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nuevo) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setAviso(data.error || "No se pudo crear el paciente"); return }
    setNuevo({ tipoDocumento: "CEDULA", identificacion: "", nombres: "", apellidos: "", fechaNacimiento: "", sexo: "", grupoSanguineo: "", alergias: "", telefono: "", consentimiento: false })
    await cargarPacientes()
    await elegir(data.paciente)
  }

  const abrirConsulta = async (plantilla: string) => {
    if (!paciente) return
    setAviso("")
    const res = await fetch("/api/clinica/consultas", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pacienteId: paciente.id, plantilla }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setAviso(data.error || "No se pudo abrir la consulta"); return }
    setConsulta(data.consulta)
    await cargarConsultas(paciente.id)
  }

  const guardar = async (cerrar = false) => {
    if (!consulta || cerrada) return
    setAviso("")
    const res = await fetch(`/api/clinica/consultas/${consulta.id}`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(consulta) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setAviso(data.error || "No se pudo guardar"); return }
    let actual = data.consulta as Consulta
    if (cerrar) {
      const fin = await fetch(`/api/clinica/consultas/${consulta.id}`, { method: "POST", credentials: "same-origin" })
      const cerrado = await fin.json().catch(() => ({}))
      if (!fin.ok) { setAviso(cerrado.error || "No se pudo cerrar"); return }
      actual = cerrado.consulta
    }
    setConsulta(actual)
    if (paciente) await cargarConsultas(paciente.id)
    setAviso(cerrar ? "Consulta cerrada. La receta ya se puede imprimir." : "Borrador guardado.")
    return actual as Consulta
  }

  const facturar = async () => {
    if (!consulta) return
    if (!cerrada) {
      const actual = await guardar(true)
      if (!actual || actual.estado !== "CERRADA") return
    }
    const persona = consulta.paciente
    const tipo = persona.tipoDocumento === "PASAPORTE" ? "06" : "05"
    sessionStorage.setItem("meijsac_proforma_factura", JSON.stringify({
      cliente: { tipoDoc: tipo, identificacion: persona.identificacion, razon: `${persona.apellidos} ${persona.nombres}`.trim(), direccion: persona.direccion || "", email: persona.email || "", telefono: persona.telefono || "" },
      items: [{ codigo: "CONSULTA", descripcion: "Consulta médica", cant: 1, pUnit: 0, codigoPorcentaje: "4", tarifa: 15, iva: 15 }],
    }))
    window.location.href = "/dashboard/factura-xml"
  }

  const subirArchivo = async (file: File | undefined, clase: string) => {
    if (!consulta || !file) return
    const form = new FormData()
    form.set("consultaId", consulta.id)
    form.set("clase", clase)
    form.set("archivo", file)
    const res = await fetch("/api/clinica/archivos", { method: "POST", credentials: "same-origin", body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setAviso(data.error || "No se pudo guardar el examen"); return }
    setConsulta({ ...consulta, archivos: [...consulta.archivos, data.archivo] })
  }

  const interpretar = async (archivo: Archivo, interpretacion: string) => {
    if (!consulta) return
    const res = await fetch("/api/clinica/archivos", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: archivo.id, interpretacion }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setAviso(data.error || "No se pudo guardar la interpretación"); return }
    setConsulta({ ...consulta, archivos: consulta.archivos.map((item) => item.id === archivo.id ? data.archivo : item) })
  }

  const poner = (parte: Partial<Consulta>) => { if (consulta && !cerrada) setConsulta({ ...consulta, ...parte }) }
  const signo = (clave: string, valor: string) => poner({ signos: { ...consulta?.signos, [clave]: valor } })
  const extra = (clave: string, valor: string) => poner({ especialidad: { ...consulta?.especialidad, [clave]: valor } })

  return (
    <Marco titulo="Medicina general · Historia clínica">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <aside className="lg:col-span-3 space-y-3">
          <input value={busqueda} onChange={(e) => { setBusqueda(e.target.value); void cargarPacientes(e.target.value) }} placeholder="Buscar paciente" className={campo("")} />
          <div className="space-y-2 max-h-64 overflow-auto">
            {pacientes.map((item) => (
              <button key={item.id} type="button" onClick={() => { void elegir(item) }} className="w-full text-left bg-slate-900 border border-slate-800 rounded-xl p-3">
                <b className="text-sm text-white">{item.apellidos} {item.nombres}</b>
                <p className="text-[11px] text-slate-400">{item.identificacion} · {item.numeroHistoria}</p>
              </button>
            ))}
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3 space-y-2">
            <p className="text-xs font-black text-teal-300">Nuevo paciente</p>
            <select value={nuevo.tipoDocumento} onChange={(e) => setNuevo({ ...nuevo, tipoDocumento: e.target.value })} className={campo("")}><option value="CEDULA">Cédula</option><option value="PASAPORTE">Pasaporte</option></select>
            <input value={nuevo.identificacion} onChange={(e) => setNuevo({ ...nuevo, identificacion: e.target.value })} placeholder="Identificación" className={campo("")} />
            <input value={nuevo.apellidos} onChange={(e) => setNuevo({ ...nuevo, apellidos: e.target.value })} placeholder="Apellidos" className={campo("")} />
            <input value={nuevo.nombres} onChange={(e) => setNuevo({ ...nuevo, nombres: e.target.value })} placeholder="Nombres" className={campo("")} />
            <input type="date" value={nuevo.fechaNacimiento} onChange={(e) => setNuevo({ ...nuevo, fechaNacimiento: e.target.value })} className={campo("")} />
            <select value={nuevo.sexo} onChange={(e) => setNuevo({ ...nuevo, sexo: e.target.value })} className={campo("")}><option value="">Sexo</option><option>Femenino</option><option>Masculino</option></select>
            <input value={nuevo.grupoSanguineo} onChange={(e) => setNuevo({ ...nuevo, grupoSanguineo: e.target.value })} placeholder="Grupo sanguíneo" className={campo("")} />
            <input value={nuevo.alergias} onChange={(e) => setNuevo({ ...nuevo, alergias: e.target.value })} placeholder="Alergias" className={campo("")} />
            <input value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} placeholder="Teléfono" className={campo("")} />
            <label className="flex gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={nuevo.consentimiento} onChange={(e) => setNuevo({ ...nuevo, consentimiento: e.target.checked })} />Autoriza el uso de sus datos de salud en esta historia.</label>
            <button type="button" onClick={() => { void crearPaciente() }} className="w-full bg-teal-600 text-white rounded-lg py-2 text-xs font-black">Guardar paciente</button>
          </div>
        </aside>

        <section className="lg:col-span-9 space-y-4">
          {aviso && <p className="text-sm text-amber-300">{aviso}</p>}
          {paciente && !consulta && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <p className="font-black text-white">{paciente.apellidos} {paciente.nombres}</p>
              <div className="flex flex-wrap gap-2">
                {PLANTILLAS.map(([id, nombre]) => <button key={id} type="button" onClick={() => { void abrirConsulta(id) }} className="bg-teal-600 text-white rounded-lg px-3 py-2 text-xs font-black">{nombre}</button>)}
              </div>
              {consultas.map((item) => (
                <button key={item.id} type="button" onClick={() => setConsulta(item)} className="block w-full text-left border border-slate-800 rounded-xl p-3">
                  <b className="text-sm">{PLANTILLAS.find((p) => p[0] === item.plantilla)?.[1] || item.plantilla}</b>
                  <span className="text-[11px] text-slate-400"> · {item.estado} · {item.motivo || "Sin motivo"}</span>
                </button>
              ))}
            </div>
          )}

          {consulta && (
            <div className="space-y-4">
              <header className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black text-white">{consulta.paciente.apellidos} {consulta.paciente.nombres}</h2>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300">{PLANTILLAS.find((p) => p[0] === consulta.plantilla)?.[1]}</span>
                    {consulta.paciente.alergias && <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">Alergia: {consulta.paciente.alergias}</span>}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{consulta.paciente.identificacion} · {edadDesde(consulta.paciente.fechaNacimiento)} · {consulta.paciente.sexo} · {consulta.paciente.grupoSanguineo} · {consulta.paciente.numeroHistoria}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setConsulta(null)} className="bg-slate-800 px-3 py-2 rounded-lg text-xs">Volver</button>
                  <button type="button" disabled={cerrada} onClick={() => { void guardar(false) }} className="bg-slate-800 px-3 py-2 rounded-lg text-xs disabled:opacity-40">Guardar borrador</button>
                  <a href={`/dashboard/comprobantes-adicionales/medicina-general/imprimir/${consulta.id}`} target="_blank" className="bg-slate-800 px-3 py-2 rounded-lg text-xs">Imprimir receta</a>
                  <button type="button" onClick={() => { void facturar() }} className="bg-teal-600 px-3 py-2 rounded-lg text-xs font-black">Cerrar y facturar</button>
                </div>
              </header>

              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
                {[["pa", "P. arterial"], ["fc", "F. cardíaca"], ["fr", "F. respiratoria"], ["temp", "Temp °C"], ["spo2", "SpO2 %"], ["peso", "Peso kg"], ["talla", "Talla cm"]].map(([clave, etiqueta]) => (
                  <label key={clave} className="bg-slate-900/70 border border-slate-800 rounded-xl p-2">
                    <span className="text-[10px] text-slate-400">{etiqueta}</span>
                    <input disabled={cerrada} value={consulta.signos?.[clave] || ""} onChange={(e) => signo(clave, e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                  </label>
                ))}
                <div className="bg-teal-950/40 border border-teal-500/30 rounded-xl p-2">
                  <span className="text-[10px] text-teal-300">IMC</span>
                  <b className="block text-teal-200">{imc == null ? "—" : consulta.plantilla === "pediatria" ? imc : `${imc} ${bandaImcAdulto(imc)}`}</b>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-7 space-y-4">
                  <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <h3 className="text-sm font-black">Anamnesis y examen físico</h3>
                    <input disabled={cerrada} value={consulta.motivo} onChange={(e) => poner({ motivo: e.target.value })} placeholder="Motivo de consulta" className={campo("")} />
                    <textarea disabled={cerrada} value={consulta.enfermedad} onChange={(e) => poner({ enfermedad: e.target.value })} rows={3} placeholder="Enfermedad actual" className={campo("")} />
                    <textarea disabled={cerrada} value={consulta.antecedentes} onChange={(e) => poner({ antecedentes: e.target.value })} rows={2} placeholder="Antecedentes" className={campo("")} />
                    <textarea disabled={cerrada} value={consulta.examenFisico} onChange={(e) => poner({ examenFisico: e.target.value })} rows={2} placeholder="Examen físico" className={campo("")} />
                  </div>

                  {consulta.plantilla === "ginecologia" && (
                    <div className="bg-slate-900/70 border border-pink-500/30 rounded-2xl p-4 space-y-3">
                      <h3 className="text-sm font-black text-pink-200">Antecedentes gineco-obstétricos</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <input disabled={cerrada} type="date" value={consulta.especialidad?.fum || ""} onChange={(e) => extra("fum", e.target.value)} className={campo("")} />
                        <input readOnly value={fppDesde(consulta.especialidad?.fum || "")} placeholder="FPP" className={campo("text-teal-300")} />
                        <input readOnly value={semanasDesde(consulta.especialidad?.fum || "")} placeholder="Semanas" className={campo("text-teal-300")} />
                        <input disabled={cerrada} value={consulta.especialidad?.formula || ""} onChange={(e) => extra("formula", e.target.value)} placeholder="G P C A" className={campo("")} />
                        <input disabled={cerrada} value={consulta.especialidad?.menarquia || ""} onChange={(e) => extra("menarquia", e.target.value)} placeholder="Menarquia" className={campo("")} />
                        <input disabled={cerrada} value={consulta.especialidad?.ciclos || ""} onChange={(e) => extra("ciclos", e.target.value)} placeholder="Ciclos" className={campo("")} />
                        <input disabled={cerrada} value={consulta.especialidad?.anticonceptivo || ""} onChange={(e) => extra("anticonceptivo", e.target.value)} placeholder="Anticonceptivo" className={campo("")} />
                        <input disabled={cerrada} value={consulta.especialidad?.pap || ""} onChange={(e) => extra("pap", e.target.value)} placeholder="Último PAP" className={campo("")} />
                        <input disabled={cerrada} value={consulta.especialidad?.mamografia || ""} onChange={(e) => extra("mamografia", e.target.value)} placeholder="Mamografía" className={campo("")} />
                      </div>
                    </div>
                  )}

                  {consulta.plantilla === "pediatria" && (
                    <div className="bg-slate-900/70 border border-sky-500/30 rounded-2xl p-4 space-y-3">
                      <h3 className="text-sm font-black text-sky-200">Pediatría</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <input disabled={cerrada} value={consulta.especialidad?.responsable || ""} onChange={(e) => extra("responsable", e.target.value)} placeholder="Adulto responsable" className={campo("")} />
                        <input disabled={cerrada} value={consulta.especialidad?.pesoNacer || ""} onChange={(e) => extra("pesoNacer", e.target.value)} placeholder="Peso al nacer" className={campo("")} />
                        <input disabled={cerrada} value={consulta.especialidad?.edadGestacional || ""} onChange={(e) => extra("edadGestacional", e.target.value)} placeholder="Edad gestacional al nacer" className={campo("")} />
                        <input disabled={cerrada} value={consulta.especialidad?.alimentacion || ""} onChange={(e) => extra("alimentacion", e.target.value)} placeholder="Alimentación" className={campo("")} />
                        <textarea disabled={cerrada} value={consulta.especialidad?.vacunas || ""} onChange={(e) => extra("vacunas", e.target.value)} rows={2} placeholder="Vacunas" className={`${campo("")} col-span-2`} />
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <h3 className="text-sm font-black">Diagnóstico CIE-10</h3>
                    <div className="flex gap-2">
                      <input disabled={cerrada} value={cie} onChange={(e) => setCie(e.target.value)} placeholder="Buscar código o enfermedad" className={campo("")} />
                      <select disabled={cerrada} value={tipoDx} onChange={(e) => setTipoDx(e.target.value)} className={campo("w-36")}><option>Definitivo</option><option>Presuntivo</option></select>
                    </div>
                    {buscarCie10(cie).map(([codigo, nombre]) => (
                      <button key={codigo} type="button" disabled={cerrada} onClick={() => { poner({ diagnosticos: [...consulta.diagnosticos.filter((d) => d.codigo !== codigo), { codigo, nombre, tipo: tipoDx }] }); setCie("") }} className="block w-full text-left text-xs bg-slate-950 rounded-lg px-3 py-2">{codigo} — {nombre}</button>
                    ))}
                    {consulta.diagnosticos.map((item) => (
                      <div key={item.codigo} className="flex justify-between text-xs bg-slate-950 rounded-lg px-3 py-2"><span><b className="text-indigo-300">{item.codigo}</b> {item.nombre}</span><span>{item.tipo}</span></div>
                    ))}
                  </div>
                </div>

                <div className="xl:col-span-5 space-y-4">
                  <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-black">Exámenes e imagenología</h3>
                    </div>
                    <div className="flex gap-2">
                      <label className="text-[11px] bg-amber-500/15 text-amber-200 rounded-lg px-3 py-2 cursor-pointer">+ Laboratorio<input type="file" accept="application/pdf,image/jpeg,.jpg" className="hidden" onChange={(e) => { void subirArchivo(e.target.files?.[0], "lab"); e.target.value = "" }} /></label>
                      <label className="text-[11px] bg-sky-500/15 text-sky-200 rounded-lg px-3 py-2 cursor-pointer">+ Imagen / RX<input type="file" accept="application/pdf,image/jpeg,.jpg" className="hidden" onChange={(e) => { void subirArchivo(e.target.files?.[0], "imagen"); e.target.value = "" }} /></label>
                    </div>
                    {consulta.archivos.map((archivo) => (
                      <div key={archivo.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                        <div className="flex justify-between gap-2 text-xs">
                          <span><b className={archivo.clase === "lab" ? "text-cyan-300" : "text-amber-300"}>{archivo.clase === "lab" ? "[Lab]" : "[Imagen]"}</b> {archivo.nombre}</span>
                          <a href={`/api/clinica/archivos/${archivo.id}`} target="_blank" className="text-teal-300">Abrir</a>
                        </div>
                        <textarea value={archivo.interpretacion} onChange={(e) => setConsulta({ ...consulta, archivos: consulta.archivos.map((item) => item.id === archivo.id ? { ...item, interpretacion: e.target.value } : item) })} onBlur={(e) => { void interpretar(archivo, e.target.value) }} rows={2} placeholder="Interpretación" className={campo("")} />
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input disabled={cerrada} id="orden-nombre" placeholder="Orden de examen" className={campo("")} />
                      <button type="button" disabled={cerrada} onClick={() => {
                        const input = document.getElementById("orden-nombre") as HTMLInputElement | null
                        const nombre = input?.value.trim() || ""
                        if (!nombre) return
                        poner({ ordenes: [...consulta.ordenes, { clase: "lab", nombre, estado: "Solicitado" }] })
                        if (input) input.value = ""
                      }} className="text-xs bg-slate-800 rounded-lg px-3">Agregar</button>
                    </div>
                    {consulta.ordenes.map((orden, i) => <p key={`${orden.nombre}-${i}`} className="text-xs text-slate-300">{orden.clase === "lab" ? "[Lab]" : "[Imagen]"} {orden.nombre} · {orden.estado}</p>)}
                  </div>

                  <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <h3 className="text-sm font-black">Receta</h3>
                    {consulta.receta.map((med, i) => (
                      <div key={i} className="grid grid-cols-2 gap-2 border border-slate-800 rounded-xl p-2">
                        <input disabled={cerrada} value={med.generico} onChange={(e) => { const receta = [...consulta.receta]; receta[i] = { ...med, generico: e.target.value }; poner({ receta }) }} placeholder="Nombre genérico" className={campo("")} />
                        <input disabled={cerrada} value={med.comercial} onChange={(e) => { const receta = [...consulta.receta]; receta[i] = { ...med, comercial: e.target.value }; poner({ receta }) }} placeholder="Nombre comercial" className={campo("")} />
                        <input disabled={cerrada} value={med.concentracion} onChange={(e) => { const receta = [...consulta.receta]; receta[i] = { ...med, concentracion: e.target.value }; poner({ receta }) }} placeholder="Concentración" className={campo("")} />
                        <input disabled={cerrada} value={med.forma} onChange={(e) => { const receta = [...consulta.receta]; receta[i] = { ...med, forma: e.target.value }; poner({ receta }) }} placeholder="Forma" className={campo("")} />
                        <input disabled={cerrada} value={med.cantidad} onChange={(e) => { const receta = [...consulta.receta]; receta[i] = { ...med, cantidad: e.target.value, cantidadLetras: cantidadEnLetras(e.target.value) }; poner({ receta }) }} placeholder="Cantidad" className={campo("")} />
                        <input readOnly value={med.cantidadLetras} placeholder="En letras" className={campo("")} />
                        <input disabled={cerrada} value={med.dosis} onChange={(e) => { const receta = [...consulta.receta]; receta[i] = { ...med, dosis: e.target.value }; poner({ receta }) }} placeholder="Dosis" className={campo("")} />
                        <input disabled={cerrada} value={med.via} onChange={(e) => { const receta = [...consulta.receta]; receta[i] = { ...med, via: e.target.value }; poner({ receta }) }} placeholder="Vía" className={campo("")} />
                        <input disabled={cerrada} value={med.frecuencia} onChange={(e) => { const receta = [...consulta.receta]; receta[i] = { ...med, frecuencia: e.target.value }; poner({ receta }) }} placeholder="Frecuencia" className={campo("")} />
                        <input disabled={cerrada} value={med.duracion} onChange={(e) => { const receta = [...consulta.receta]; receta[i] = { ...med, duracion: e.target.value }; poner({ receta }) }} placeholder="Duración" className={campo("")} />
                        <input disabled={cerrada} value={med.alarma} onChange={(e) => { const receta = [...consulta.receta]; receta[i] = { ...med, alarma: e.target.value }; poner({ receta }) }} placeholder="Signos de alarma" className={`${campo("")} col-span-2`} />
                      </div>
                    ))}
                    {!cerrada && <button type="button" onClick={() => poner({ receta: [...consulta.receta, medicamentoVacio()] })} className="text-xs bg-teal-600 rounded-lg px-3 py-2 font-black">Agregar medicamento</button>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </Marco>
  )
}
