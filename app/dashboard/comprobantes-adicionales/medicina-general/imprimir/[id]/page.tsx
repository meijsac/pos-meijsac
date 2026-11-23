"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

type Medicamento = { generico?: string; comercial?: string; concentracion?: string; forma?: string; cantidad?: string; cantidadLetras?: string; dosis?: string; via?: string; frecuencia?: string; duracion?: string; alarma?: string }

export default function ImprimirRecetaMedica() {
  const params = useParams<{ id: string }>()
  const [consulta, setConsulta] = useState<Record<string, any> | null>(null)
  const [empresa, setEmpresa] = useState({ razon: "", ruc: "" })

  useEffect(() => {
    fetch(`/api/clinica/consultas/${params.id}`, { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (data.consulta) {
          setConsulta(data.consulta)
          setEmpresa(data.empresa || { razon: "", ruc: "" })
        }
      })
      .catch(() => {})
  }, [params.id])

  if (!consulta) return <p style={{ fontFamily: "Arial, sans-serif", padding: 24 }}>Cargando receta...</p>
  const paciente = consulta.paciente || {}
  const receta = Array.isArray(consulta.receta) ? consulta.receta as Medicamento[] : []
  const ordenes = Array.isArray(consulta.ordenes) ? consulta.ordenes as { clase?: string; nombre?: string; estado?: string }[] : []

  return (
    <main style={{ fontFamily: "Arial, sans-serif", color: "#111", padding: 28, maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>{empresa.razon || "Establecimiento"}</h1>
      <p style={{ fontSize: 12 }}>{empresa.ruc ? `RUC ${empresa.ruc}` : ""}</p>
      <h2 style={{ fontSize: 16, marginTop: 16 }}>Receta médica</h2>
      <p><b>Paciente:</b> {paciente.apellidos} {paciente.nombres} · {paciente.identificacion} · {paciente.numeroHistoria}</p>
      <p><b>Motivo:</b> {consulta.motivo || "—"}</p>
      <h3>Rp.</h3>
      {receta.length === 0 && <p>Sin medicamentos.</p>}
      {receta.map((med, i) => (
        <p key={i}>{i + 1}. {med.generico} {med.concentracion} {med.forma} {med.comercial ? `(${med.comercial})` : ""} — Cantidad {med.cantidad} {med.cantidadLetras ? `(${med.cantidadLetras})` : ""}<br />{med.dosis} · {med.via} · {med.frecuencia} · {med.duracion}{med.alarma ? ` · Alarma: ${med.alarma}` : ""}</p>
      ))}
      {ordenes.length > 0 && <h3>Órdenes</h3>}
      {ordenes.map((orden, i) => <p key={i}>{orden.clase === "imagen" ? "Imagen" : "Laboratorio"}: {orden.nombre} · {orden.estado}</p>)}
      <p style={{ marginTop: 28 }}><b>Profesional:</b> {consulta.usuarioNombre}</p>
      <button type="button" onClick={() => window.print()} style={{ marginTop: 16 }}>Imprimir</button>
    </main>
  )
}
