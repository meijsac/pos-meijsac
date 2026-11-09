export const LOGO_MAX_BYTES = 2 * 1024 * 1024
export const LOGO_FORMATOS = ["png", "jpg", "jpeg", "webp"]

export function errorLogo(nombre: string, tipo: string, peso: number): string | null {
  const ext = nombre.split(".").pop()?.toLowerCase() || ""
  const mimeOk = tipo === "image/png" || tipo === "image/jpeg" || tipo === "image/webp"
  const extOk = LOGO_FORMATOS.includes(ext)
  if (!mimeOk || !extOk) return "Formato no permitido. Sube una imagen PNG, JPG o WEBP."
  if (peso > LOGO_MAX_BYTES) return "La imagen es muy grande. El máximo es 2 MB. Comprime la imagen o elige otra más liviana."
  return null
}

export function mimeDeLogo(nombre: string, tipo: string) {
  if (tipo === "image/png" || tipo === "image/jpeg" || tipo === "image/webp") return tipo
  const ext = nombre.split(".").pop()?.toLowerCase()
  if (ext === "png") return "image/png"
  if (ext === "webp") return "image/webp"
  return "image/jpeg"
}
