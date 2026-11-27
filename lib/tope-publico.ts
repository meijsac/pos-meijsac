const marcas = new Map<string, number[]>()

export function cupoPublico(clave: string, tope = 8, ventanaMs = 15 * 60 * 1000) {
  const ahora = Date.now()
  const previas = (marcas.get(clave) || []).filter((t) => ahora - t < ventanaMs)
  if (previas.length >= tope) {
    marcas.set(clave, previas)
    return false
  }
  previas.push(ahora)
  marcas.set(clave, previas)
  return true
}
