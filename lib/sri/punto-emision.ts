export type PuntoFactura = {
  estab: string
  pto: string
  serie: string
  ultimo: string
  indice: number
}

function tres(valor: unknown) {
  return String(valor ?? "").replace(/\D/g, "").padStart(3, "0").slice(-3)
}

function nueve(valor: unknown) {
  const digitos = String(valor ?? "").replace(/\D/g, "")
  return digitos ? digitos.padStart(9, "0").slice(-9) : ""
}

function esFactura(fila: any) {
  const codigo = String(fila?.codigo || "01").replace(/\D/g, "").padStart(2, "0").slice(-2)
  const tipo = String(fila?.tipo || "").toUpperCase()
  const estado = String(fila?.estado || "ACTIVO").toUpperCase()
  const apagada = estado.includes("INACTIV") || estado.includes("BAJA") || estado === "OFF"
  return (codigo === "01" || tipo.includes("FACTURA")) && !apagada
}

export function codigoAmbienteFactura(ambiente: unknown) {
  const codigo = String(ambiente ?? "").trim().toUpperCase()
  if (codigo === "2" || codigo.includes("PROD")) return "2"
  return "1"
}

export function serieDeAmbiente(ambiente: unknown) {
  return codigoAmbienteFactura(ambiente) === "2" ? "001-001" : "001-002"
}

export function ultimoDelAmbiente(fila: any, ambiente: unknown) {
  const codigo = codigoAmbienteFactura(ambiente)
  const propio = nueve(fila?.porAmbiente && typeof fila.porAmbiente === "object" ? fila.porAmbiente[codigo] : "")
  if (propio && propio !== "000000000") return propio
  return nueve(fila?.ultimo)
}

function codigoDocumento(fila: any) {
  return String(fila?.codigo || "01").replace(/\D/g, "").padStart(2, "0").slice(-2)
}

export function aplicarPuntoGuardado(lista: unknown, prevLista: unknown, sucursales: unknown, prevSucursales: unknown) {
  const next = (Array.isArray(lista) ? lista : []).map((fila: any) => ({
    ...(fila || {}),
    porAmbiente: { ...((fila || {}).porAmbiente || {}) },
  }))
  const previos = Array.isArray(prevLista) ? prevLista : []
  for (const fila of next) {
    if (fila.preferida === true || fila.puntoEditado) continue
    const previa = previos.find((p: any) => tres(p?.estab) === tres(fila?.estab) && tres(p?.pto) === tres(fila?.pto) && codigoDocumento(p) === codigoDocumento(fila))
    if (previa?.preferida === true) fila.preferida = true
  }
  const elegidas: any[] = []
  const tomar = (fila: any, numero: unknown, forzarNumero: boolean) => {
    const n = nueve(numero)
    if (forzarNumero && n && n !== "000000000") {
      fila.porAmbiente = { "1": n, "2": n }
      fila.ultimo = n
    }
    elegidas.push(fila)
  }
  for (const fila of next) {
    if (fila?.puntoEditado) fila.ultimoEscrito = fila.ultimo
  }
  if (Array.isArray(sucursales)) {
    const prev = Array.isArray(prevSucursales) ? prevSucursales : []
    for (const suc of sucursales as any[]) {
      const estab = tres(suc?.id)
      const pto = tres(suc?.ptoEmision)
      const inicio = nueve(suc?.secuencialInicio)
      if (estab === "000" || pto === "000") continue
      const antes = prev.find((p: any) => tres(p?.id) === estab)
      const inicioAntes = nueve(antes?.secuencialInicio)
      const cambioPunto = !antes || tres(antes?.ptoEmision) !== pto
      const cambioSec = Boolean(inicio) && inicio !== inicioAntes
      if (!antes && pto === "001" && (!inicio || inicio === "000000001")) continue
      if (!cambioPunto && !cambioSec) continue
      let fila = next.find((s) => esFactura(s) && tres(s?.estab) === estab && tres(s?.pto) === pto)
      if (fila?.puntoEditado) continue
      if (!fila) {
        fila = { estab, pto, codigo: "01", tipo: "01 FACTURA", ultimo: inicio, estado: "ACTIVO", porAmbiente: { "1": "", "2": "" } }
        next.push(fila)
      }
      const a1 = nueve(fila?.porAmbiente?.["1"])
      const a2 = nueve(fila?.porAmbiente?.["2"])
      tomar(fila, inicio || fila.ultimo, Boolean(cambioSec && inicio !== a1 && inicio !== a2))
    }
  }
  for (const fila of next) {
    if (!fila?.puntoEditado || !esFactura(fila)) continue
    const n = nueve(fila.ultimoEscrito ?? fila.ultimo)
    tomar(fila, n, Boolean(n && n !== "000000000"))
  }
  if (elegidas.length) {
    const unica = elegidas[elegidas.length - 1]
    for (const fila of next) {
      if (!esFactura(fila)) continue
      fila.preferida = fila === unica
    }
  }
  for (const fila of next) {
    delete fila.puntoEditado
    delete fila.ultimoEscrito
  }
  return next
}

export function puntoActivoFactura(secuenciales: unknown, _ambiente: unknown, estabElegido?: string): { punto: PuntoFactura; aviso: string } {
  const lista = Array.isArray(secuenciales) ? secuenciales : []
  const facturas = lista
    .map((fila, indice) => ({ fila, indice }))
    .filter(({ fila }) => esFactura(fila))
  const serieAmbiente = serieDeAmbiente(_ambiente)
  const delAmbiente = facturas.filter(({ fila }) => `${tres(fila?.estab)}-${tres(fila?.pto)}` === serieAmbiente)
  const preferido = tres(estabElegido || "")
  const delEstablecimiento = preferido && preferido !== "000"
    ? facturas.filter(({ fila }) => tres(fila?.estab) === preferido)
    : []
  const guardada = facturas.find(({ fila }) => fila?.preferida === true)
  const elegida = guardada
    || delAmbiente[0]
    || delEstablecimiento[0]
    || facturas.find(({ fila }) => String(fila?.estado || "").toUpperCase() === "ACTIVO")
    || facturas[0]
  if (!elegida) {
    return {
      punto: { estab: "", pto: "", serie: "", ultimo: "", indice: -1 },
      aviso: "No hay un punto de emisión en Configuración",
    }
  }
  const estab = tres(elegida.fila?.estab)
  const pto = tres(elegida.fila?.pto)
  return {
    punto: { estab, pto, serie: `${estab}-${pto}`, ultimo: ultimoDelAmbiente(elegida.fila, _ambiente), indice: elegida.indice },
    aviso: "",
  }
}

export function elegirSecuencial(pedido: string, ultimo: string, usados: Set<string>) {
  const base = nueve(ultimo) || nueve(pedido)
  return siguienteSecuencial(base && base !== "000000000" ? base : "0", usados)
}

export function siguienteSecuencial(ultimo: string, usados: Set<string>) {
  let n = Number(nueve(ultimo) || "0") + 1
  if (!Number.isFinite(n) || n < 1) n = 1
  while (n <= 999999999 && usados.has(String(n).padStart(9, "0"))) n += 1
  if (n > 999999999) return ""
  return String(n).padStart(9, "0")
}

export function mismoAmbienteFactura(payload: any, ambiente: unknown) {
  const codigo = codigoAmbienteFactura(ambiente)
  const clave = String(payload?.claveAcceso || "")
  if (clave.length === 49) return clave[23] === codigo
  const envio = String(payload?.envioSri || "").toUpperCase()
  if (envio.includes("PROD")) return codigo === "2"
  if (envio.includes("PRUEB")) return codigo === "1"
  return true
}

export function secuencialYaUsado(secuencial: string, usados: Set<string>) {
  const n = nueve(secuencial)
  return Boolean(n) && usados.has(n)
}
