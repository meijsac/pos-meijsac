"use client"
import { useEffect, useState } from "react"
import { Marco } from "../../marco"

type Fila = {
  id: string
  estado: string
  plantilla: string
  motivo: string
  createdAt: string
  paciente: { nombres: string; apellidos: string; identificacion: string }
  receta: { generico?: string }[]
}

export default function RecetasMedicina() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [aviso, setAviso] = useState("")

  useEffect(() => {
    fetch("/api/clinica/consultas?estado=CERRADA", { credentials: "same-origin" })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) { setAviso(data.error || "No se pudieron leer las recetas"); return }
        setFilas((Array.isArray(data.consultas) ? data.consultas : []).filter((item: Fila) => Array.isArray(item.receta) && item.receta.length))
      })
      .catch(() => setAviso("No se pudieron leer las recetas"))
  }, [])

  return (
    <Marco titulo="Medicina general · Receta">
      {aviso && <p className="text-amber-300 text-sm">{aviso}</p>}
      <div className="space-y-3">
        {filas.map((fila) => (
          <div key={fila.id} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex justify-between gap-3">
            <div>
              <p className="font-black text-white">{fila.paciente.apellidos} {fila.paciente.nombres}</p>
              <p className="text-xs text-slate-400">{fila.paciente.identificacion} · {fila.motivo || "Consulta"} · {fila.receta.map((med) => med.generico).filter(Boolean).join(", ")}</p>
            </div>
            <a href={`/dashboard/comprobantes-adicionales/medicina-general/imprimir/${fila.id}`} target="_blank" className="text-xs font-black bg-teal-600 text-white px-4 py-2 rounded-xl h-fit">Imprimir</a>
          </div>
        ))}
        {!aviso && filas.length === 0 && <p className="text-slate-400 text-sm">Las recetas aparecen cuando la consulta se cierra.</p>}
      </div>
    </Marco>
  )
}
