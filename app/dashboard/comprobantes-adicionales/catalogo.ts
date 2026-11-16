export type ModuloAdicional = {
  slug: string
  titulo: string
  detalle: string
  construccion?: boolean
  documentos?: { slug: string; titulo: string }[]
}

export const MODULOS_ADICIONALES: ModuloAdicional[] = [
  {
    slug: "opticas",
    titulo: "Ópticas",
    detalle: "Historia clínica y receta",
    documentos: [
      { slug: "historia-clinica", titulo: "Historia clínica" },
      { slug: "receta", titulo: "Receta" },
    ],
  },
  {
    slug: "medicina-general",
    titulo: "Medicina general",
    detalle: "Historia clínica y receta",
    documentos: [
      { slug: "historia-clinica", titulo: "Historia clínica" },
      { slug: "receta", titulo: "Receta" },
    ],
  },
  {
    slug: "odontologia",
    titulo: "Odontología",
    detalle: "Historia clínica y receta",
    documentos: [
      { slug: "historia-clinica", titulo: "Historia clínica" },
      { slug: "receta", titulo: "Receta" },
    ],
  },
  { slug: "radiografias", titulo: "Radiografías", detalle: "En construcción", construccion: true },
  { slug: "firmar-pdf", titulo: "Firmar documentos PDF", detalle: "En construcción", construccion: true },
  { slug: "condominos", titulo: "Control de condóminos", detalle: "En construcción", construccion: true },
]

export function moduloPorSlug(slug: string) {
  return MODULOS_ADICIONALES.find((modulo) => modulo.slug === slug) || null
}
