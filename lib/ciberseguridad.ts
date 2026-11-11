// lib/ciberseguridad.ts
export type Rol = "ADMIN" | "CAJERO" | "BODEGA" | "AUDITOR";
export type LogSeguridad = { id: string; fecha: string; usuario: string; accion: string; ip: string; riesgo: "BAJO" | "MEDIO" | "ALTO" };

export const POLITICA_SEGURIDAD = {
  intentosMax: 3,
  bloqueoMin: 15, // minutos
  sesionMin: 30, // expira en 30 min sin actividad
  passwordMin: 8,
  requiereMayuscula: true,
  requiere2FA: false,
  encriptarCliente: true, // RUC, telefono, etc.
};

export function encriptarDato(dato: string): string {
  if (typeof window === "undefined") return dato;
  // Encriptación simple en frontend, en producción usa AES en backend
  return btoa(dato.split("").reverse().join(""));
}

export function desencriptarDato(dato: string): string {
  try { return atob(dato).split("").reverse().join(""); } catch { return dato; }
}

export function registrarLog(accion: string, riesgo: LogSeguridad["riesgo"] = "BAJO") {
  const usuario = JSON.parse(localStorage.getItem("meijsac_user") || '{"nombre":"SISTEMA"}');
  const logs: LogSeguridad[] = JSON.parse(localStorage.getItem("meijsac_logs_seguridad") || "[]");
  const nuevoLog: LogSeguridad = {
    id: Date.now().toString(),
    fecha: new Date().toISOString(),
    usuario: usuario.nombre,
    accion,
    ip: "local", // en producción sacas IP real del request
    riesgo
  };
  localStorage.setItem("meijsac_logs_seguridad", JSON.stringify([nuevoLog, ...logs].slice(0, 500)));
}

export function validarRol(rolRequerido: Rol[]): boolean {
  const user = JSON.parse(localStorage.getItem("meijsac_user") || '{"rol":"CAJERO"}');
  return rolRequerido.includes(user.rol);
}