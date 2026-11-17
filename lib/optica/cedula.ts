export function cedulaValida(valor: string) {
  const digitos = String(valor || "").replace(/\D/g, "")
  if (digitos.length !== 10) return false
  const provincia = Number(digitos.slice(0, 2))
  if (provincia < 1 || (provincia > 24 && provincia !== 30)) return false
  if (Number(digitos[2]) > 5) return false
  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2]
  let suma = 0
  for (let i = 0; i < 9; i++) {
    let producto = Number(digitos[i]) * coeficientes[i]
    if (producto >= 10) producto -= 9
    suma += producto
  }
  const verificador = (10 - (suma % 10)) % 10
  return verificador === Number(digitos[9])
}
