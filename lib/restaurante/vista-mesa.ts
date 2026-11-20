type Plato = { nombre?: string; cant?: number; precio?: number; estado?: string; mods?: { termino?: string; acomp?: string; nota?: string } }
type Mesa = { nombre?: string; zona?: string; estado?: string; items?: Plato[] }
type PlatoMenu = { nombre?: string; precio?: number; cat?: string; activo?: boolean }

function dinero(valor: number) {
  return Math.round(valor * 100) / 100
}

export function etiquetaPlato(estado: unknown) {
  const marca = String(estado || "").toUpperCase()
  if (marca === "PREPARANDO") return "Preparándose"
  if (marca === "LISTO") return "Listo"
  if (marca === "ENTREGADO") return "Servido"
  if (marca === "PENDIENTE") return "Por enviar"
  return "En cocina"
}

export function vistaPublicaMesa(mesa: Mesa, menu: unknown, categorias: unknown, local: string) {
  const abierta = mesa.estado === "OCUPADA" || mesa.estado === "CUENTA"
  const items = abierta && Array.isArray(mesa.items) ? mesa.items : []
  const platos = items.filter((item) => item?.nombre).map((item) => {
    const mods = [item.mods?.termino, item.mods?.acomp, item.mods?.nota].filter(Boolean).join(" · ")
    return {
      nombre: String(item.nombre),
      cant: Number(item.cant) || 1,
      precio: dinero(Number(item.precio) || 0),
      estado: etiquetaPlato(item.estado),
      nota: mods,
    }
  })
  const subtotal = dinero(platos.reduce((suma, item) => suma + item.precio * item.cant, 0))
  const carta = (Array.isArray(menu) ? menu : []).filter((plato) => plato && typeof plato === "object" && (plato as PlatoMenu).activo !== false && (plato as PlatoMenu).nombre).slice(0, 500).map((plato) => {
    const fila = plato as PlatoMenu
    return { nombre: String(fila.nombre), precio: dinero(Number(fila.precio) || 0), cat: String(fila.cat || "MENÚ") }
  })
  const grupos = (Array.isArray(categorias) ? categorias : []).map((nombre) => String(nombre || "").trim()).filter(Boolean).slice(0, 80)
  return {
    local: local || "Restaurante",
    mesa: String(mesa.nombre || "Mesa"),
    zona: String(mesa.zona || ""),
    cuentaAbierta: abierta && platos.length > 0,
    platos,
    subtotal,
    iva: dinero(subtotal * 0.15),
    propina: dinero(subtotal * 0.1),
    total: dinero(subtotal * 1.25),
    menu: carta,
    categorias: grupos.length ? grupos : [...new Set(carta.map((plato) => plato.cat))],
  }
}
