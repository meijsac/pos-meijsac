import { permisosNormales } from "@/lib/permisos-pos"

export function veHistoriaClinica(usuario: { rol?: string | null; permisos?: unknown }) {
  if (String(usuario.rol || "").toUpperCase() === "ADMIN") return true
  return permisosNormales(usuario.permisos).verHistoriaClinica
}

export function consultaParaQuien(consulta: Record<string, unknown>, historia: boolean) {
  if (historia) return consulta
  const profesional = consulta.profesional && typeof consulta.profesional === "object" ? consulta.profesional as Record<string, unknown> : {}
  const paciente = consulta.paciente && typeof consulta.paciente === "object" ? consulta.paciente as Record<string, unknown> : null
  return {
    id: consulta.id,
    fechaHora: consulta.fechaHora,
    estado: consulta.estado,
    cerrada: consulta.cerrada,
    usuarioNombre: consulta.usuarioNombre,
    paciente: paciente ? { id: paciente.id, nombres: paciente.nombres, apellidos: paciente.apellidos, identificacion: paciente.identificacion } : null,
    pacienteResumen: consulta.pacienteResumen,
    refraccion: consulta.refraccion,
    profesional: {
      nombre: profesional.nombre || "",
      cedula: profesional.cedula || "",
      registro_acess: profesional.registro_acess || "",
      registro_senescyt: profesional.registro_senescyt || "",
    },
    establecimiento: consulta.establecimiento,
    diagnosticos: [],
    motivo: "",
    plan: "",
    anamnesis: {},
    examen: {},
    motilidad: {},
    agudeza: {},
    lensometria: {},
    adendas: [],
  }
}
