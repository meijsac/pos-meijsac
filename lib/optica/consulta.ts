import { diagnosticoCie } from "@/lib/optica/cie10"

export const TEXTO_DATOS_OPTICA = "Autorizo a este consultorio a guardar mi cédula, mi teléfono y los datos del examen de la vista para atender la consulta, elaborar la receta y conservar la historia. Puedo pedir ver o corregir esos datos."

function texto(valor: unknown, tope = 500) {
  return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, tope)
}

function dioptria(valor: unknown) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return 0
  const limitado = Math.min(30, Math.max(-30, n))
  return Math.round(limitado * 4) / 4
}

function eje(valor: unknown) {
  const n = Math.round(Number(valor))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(180, n)
}

function ojo(valor: unknown) {
  const fila = valor && typeof valor === "object" ? valor as Record<string, unknown> : {}
  return { esf: dioptria(fila.esf), cil: dioptria(fila.cil), eje: eje(fila.eje), add: dioptria(fila.add) }
}

function ojoRx(valor: unknown) {
  const fila = valor && typeof valor === "object" ? valor as Record<string, unknown> : {}
  const dip = Number(fila.dip)
  const altura = Number(fila.altura)
  return {
    ...ojo(fila),
    prisma: texto(fila.prisma, 40),
    dip: Number.isFinite(dip) ? Math.min(80, Math.max(0, Math.round(dip * 10) / 10)) : null,
    altura: Number.isFinite(altura) ? Math.min(40, Math.max(0, Math.round(altura * 10) / 10)) : null,
    avFinal: texto(fila.avFinal || fila.av_final, 20),
  }
}

function par(valor: unknown, clave: "od" | "oi") {
  const fila = valor && typeof valor === "object" ? valor as Record<string, unknown> : {}
  return fila[clave]
}

export function sanearConsulta(body: Record<string, unknown>) {
  const motivo = texto(body.motivo, 500)
  if (!motivo) return { error: "Escribe el motivo de la consulta" }
  const lista = Array.isArray(body.diagnosticos) ? body.diagnosticos : []
  const diagnosticos = lista.map((fila) => {
    const codigo = diagnosticoCie(String((fila as { codigo?: string })?.codigo || ""))
    return codigo ? { codigo_cie10: codigo.codigo, descripcion: codigo.descripcion, tipo: "Definitivo" } : null
  }).filter(Boolean)
  if (!diagnosticos.length) return { error: "Elige al menos un diagnóstico CIE-10" }
  const anamnesis = body.anamnesis && typeof body.anamnesis === "object" ? body.anamnesis as Record<string, unknown> : {}
  const agudeza = body.agudeza && typeof body.agudeza === "object" ? body.agudeza as Record<string, unknown> : {}
  const examen = body.examen && typeof body.examen === "object" ? body.examen as Record<string, unknown> : {}
  const motilidad = body.motilidad && typeof body.motilidad === "object" ? body.motilidad as Record<string, unknown> : {}
  const refraccion = body.refraccion && typeof body.refraccion === "object" ? body.refraccion as Record<string, unknown> : {}
  const profesional = body.profesional && typeof body.profesional === "object" ? body.profesional as Record<string, unknown> : {}
  const vista = (grupo: unknown) => {
    const fila = grupo && typeof grupo === "object" ? grupo as Record<string, unknown> : {}
    return { od: texto(fila.od, 20), oi: texto(fila.oi, 20), ao: texto(fila.ao, 20) }
  }
  return {
    datos: {
      motivo,
      anamnesis: {
        usa_lentes: Boolean(anamnesis.usaLentes ?? anamnesis.usa_lentes),
        tiempo_uso: texto(anamnesis.tiempoUso ?? anamnesis.tiempo_uso, 80),
        ultimo_control: texto(anamnesis.ultimoControl ?? anamnesis.ultimo_control, 20),
        antecedentes_oculares: texto(anamnesis.antecedentesOculares ?? anamnesis.antecedentes_oculares, 300),
        antecedentes_sistemicos: texto(anamnesis.antecedentesSistemicos ?? anamnesis.antecedentes_sistemicos, 300),
        alergias: texto(anamnesis.alergias, 200),
      },
      lensometria: { od: ojo(par(body.lensometria, "od")), oi: ojo(par(body.lensometria, "oi")) },
      agudeza: {
        escala: "Snellen",
        vl_sc: vista(agudeza.vlSc ?? agudeza.vl_sc),
        vl_cc: vista(agudeza.vlCc ?? agudeza.vl_cc),
        ph: vista(agudeza.ph),
        vp_sc: vista(agudeza.vpSc ?? agudeza.vp_sc),
        vp_cc: vista(agudeza.vpCc ?? agudeza.vp_cc),
      },
      examen: {
        biomicroscopia: texto(examen.biomicroscopia, 500),
        oftalmoscopia: texto(examen.oftalmoscopia, 500),
      },
      motilidad: {
        cover_test_vl: texto(motilidad.coverVl ?? motilidad.cover_test_vl, 80),
        cover_test_vp: texto(motilidad.coverVp ?? motilidad.cover_test_vp, 80),
        ppc: texto(motilidad.ppc, 40),
        versiones: texto(motilidad.versiones, 120),
      },
      refraccion: {
        od: ojoRx(par(refraccion, "od")),
        oi: ojoRx(par(refraccion, "oi")),
        material_sugerido: texto(refraccion.material ?? refraccion.material_sugerido, 200),
      },
      diagnosticos,
      plan: texto(body.plan, 800),
      profesional: {
        nombre: texto(profesional.nombre, 120),
        cedula: texto(profesional.cedula, 20),
        registro_acess: texto(profesional.registroAcess ?? profesional.registro_acess, 40),
        registro_senescyt: texto(profesional.registroSenescyt ?? profesional.registro_senescyt, 40),
      },
      unicodigo: texto(body.unicodigo, 20),
    },
  }
}
