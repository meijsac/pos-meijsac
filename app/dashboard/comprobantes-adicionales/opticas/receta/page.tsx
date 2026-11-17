"use client"
import { useEffect, useState } from "react"
import { Marco } from "../../marco"

type Consulta = {
  id: string
  fechaHora: string
  paciente?: { nombres: string; apellidos: string; identificacion: string }
  refraccion?: { od?: { esf?: number; cil?: number; eje?: number }; oi?: { esf?: number; cil?: number; eje?: number } }
}

function signo(valor: number | undefined) {
  const n = Number(valor) || 0
  return n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2)
}

export default function RecetaOpticaPage() {
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [error, setError] = useState("")
  useEffect(() => {
    fetch("/api/optica/consultas").then(async (res) => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "No se pudieron cargar las recetas")
      setConsultas(data.consultas || [])
    }).catch((e) => setError(e.message))
  }, [])
  return (
    <Marco titulo="Ópticas · Receta" claro>
      <p className="text-sm text-slate-600">La receta sale de la consulta guardada. El optometrista la imprime y pone su sello.</p>
      {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
      <div className="space-y-3">
        {consultas.map((consulta) => (
          <article key={consulta.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap justify-between gap-3 shadow-sm">
            <div>
              <b className="text-slate-950">{consulta.paciente?.apellidos} {consulta.paciente?.nombres}</b>
              <p className="text-xs text-slate-500">{new Date(consulta.fechaHora).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })} · {consulta.paciente?.identificacion}</p>
              <p className="text-sm mt-1 text-slate-800">OD {signo(consulta.refraccion?.od?.esf)} {signo(consulta.refraccion?.od?.cil)} x {consulta.refraccion?.od?.eje ?? 0} · OI {signo(consulta.refraccion?.oi?.esf)} {signo(consulta.refraccion?.oi?.cil)} x {consulta.refraccion?.oi?.eje ?? 0}</p>
            </div>
            <a href={`/dashboard/comprobantes-adicionales/opticas/imprimir/${consulta.id}?tipo=receta`} target="_blank" className="text-xs font-black bg-teal-600 text-white px-4 py-2 rounded-xl h-fit">Imprimir receta</a>
          </article>
        ))}
      </div>
    </Marco>
  )
}
