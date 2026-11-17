"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

type Ojo = { esf?: number; cil?: number; eje?: number; add?: number; prisma?: string; dip?: number | null; altura?: number | null; avFinal?: string; av_final?: string }
type Consulta = {
  fechaHora: string
  motivo: string
  plan: string
  usuarioNombre: string
  anamnesis: Record<string, string | boolean>
  lensometria: { od: Ojo; oi: Ojo }
  agudeza: Record<string, { od?: string; oi?: string; ao?: string } | string>
  examen: { biomicroscopia?: string; oftalmoscopia?: string }
  motilidad: Record<string, string>
  refraccion: { od: Ojo; oi: Ojo; material_sugerido?: string }
  diagnosticos: { codigo_cie10?: string; descripcion?: string }[]
  profesional: { nombre?: string; cedula?: string; registro_acess?: string; registro_senescyt?: string }
  establecimiento: { nombre?: string; ruc?: string; ciudad?: string; unicodigo_acess?: string }
  pacienteResumen: { nombres?: string; apellidos?: string; identificacion?: string; fecha_nacimiento?: string }
  adendas: { id: string; texto: string; createdAt: string; usuarioNombre: string }[]
}

function signo(valor: number | undefined) {
  const n = Number(valor) || 0
  if (n > 0) return `+${n.toFixed(2)}`
  return n.toFixed(2)
}

function filaRx(titulo: string, ojo: Ojo) {
  return <tr><td>{titulo}</td><td>{signo(ojo?.esf)}</td><td>{signo(ojo?.cil)}</td><td>{ojo?.eje ?? 0}°</td><td>{signo(ojo?.add)}</td><td>{ojo?.avFinal || ojo?.av_final || ""}</td><td>{ojo?.dip ?? ""}</td><td>{ojo?.altura ?? ""}</td></tr>
}

export default function ImprimirOpticaPage() {
  const params = useParams<{ id: string }>()
  const [receta, setReceta] = useState(false)
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    setReceta(new URLSearchParams(window.location.search).get("tipo") === "receta")
    fetch(`/api/optica/consultas/${params.id}`).then(async (res) => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "No se encontró la consulta")
      setConsulta(data.consulta)
    }).catch((e) => setError(e.message))
  }, [params.id])
  if (error) return <p style={{ fontFamily: "Arial, sans-serif", padding: 24 }}>{error}</p>
  if (!consulta) return <p style={{ fontFamily: "Arial, sans-serif", padding: 24 }}>Cargando...</p>
  const paciente = consulta.pacienteResumen || {}
  const local = consulta.establecimiento || {}
  const profesional = consulta.profesional || {}
  const fecha = new Date(consulta.fechaHora).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })
  return (
    <main style={{ fontFamily: "Arial, sans-serif", color: "#111", background: "#fff", padding: 28, maxWidth: 800, margin: "0 auto" }}>
      <button type="button" onClick={() => window.print()} style={{ marginBottom: 16 }}>Imprimir</button>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>{local.nombre || "Óptica"}</h1>
      <p style={{ margin: 0 }}>RUC {local.ruc || "—"} · {local.ciudad || ""} · Unicódigo ACESS {local.unicodigo_acess || "—"}</p>
      <h2 style={{ fontSize: 16 }}>{receta ? "Receta óptica" : "Historia clínica optométrica"}</h2>
      <p><b>{paciente.apellidos} {paciente.nombres}</b><br />Identificación {paciente.identificacion || "—"} · Nacimiento {paciente.fecha_nacimiento || "—"}<br />Fecha {fecha}</p>
      {receta ? null : <p><b>Motivo:</b> {consulta.motivo}</p>}
      {receta ? null : <p><b>Anamnesis:</b> {consulta.anamnesis?.usa_lentes ? "Usa lentes" : "No usa lentes"}. {String(consulta.anamnesis?.tiempo_uso || "")} {String(consulta.anamnesis?.antecedentes_oculares || "")} {String(consulta.anamnesis?.alergias || "")}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr><th></th><th>Esf</th><th>Cil</th><th>Eje</th><th>Add</th><th>AV</th><th>DIP</th><th>Altura</th></tr></thead>
        <tbody>
          {filaRx("OD", consulta.refraccion?.od)}
          {filaRx("OI", consulta.refraccion?.oi)}
        </tbody>
      </table>
      <p><b>Material:</b> {consulta.refraccion?.material_sugerido || "—"}</p>
      <p><b>Diagnóstico:</b> {(consulta.diagnosticos || []).map((d) => `${d.codigo_cie10 || ""} ${d.descripcion || ""}`).join(" · ")}</p>
      {receta ? null : <p><b>Plan:</b> {consulta.plan || "—"}</p>}
      {receta ? null : <p><b>Biomicroscopía:</b> {consulta.examen?.biomicroscopia || "—"} · <b>Oftalmoscopía:</b> {consulta.examen?.oftalmoscopia || "—"}</p>}
      {receta ? null : (consulta.adendas || []).map((adenda) => <p key={adenda.id}><b>Nota {new Date(adenda.createdAt).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })} · {adenda.usuarioNombre}:</b> {adenda.texto}</p>)}
      <div style={{ marginTop: 48, width: 280 }}>
        <div style={{ borderTop: "1px solid #111", paddingTop: 8 }}>
          <p style={{ margin: 0 }}>{profesional.nombre || consulta.usuarioNombre}</p>
          <p style={{ margin: 0 }}>Cédula {profesional.cedula || "—"}</p>
          <p style={{ margin: 0 }}>ACESS {profesional.registro_acess || "—"} · SENESCYT {profesional.registro_senescyt || "—"}</p>
          <p style={{ margin: "12px 0 0" }}>Firma y sello</p>
        </div>
      </div>
      <style>{`@media print { button { display: none } }`}</style>
    </main>
  )
}
