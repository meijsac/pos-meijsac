// lib/auth-seguro.ts
export function iniciarSesionSegura(usuario: any) {
  const codigo2FA = Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
  localStorage.setItem("meijsac_2fa_code", codigo2FA);
  localStorage.setItem("meijsac_2fa_exp", (Date.now() + 5 * 60 * 1000).toString()); // 5 min
  localStorage.setItem("meijsac_user_pendiente", JSON.stringify(usuario));
  
  // En producción aquí envías por email/WhatsApp. Ahora lo mostramos en consola para prueba
  console.log("🔐 TU CODIGO 2FA ES:", codigo2FA);
  alert(`🔐 CODIGO 2FA (prueba): ${codigo2FA} - En producción esto llega por email/WhatsApp`);
  return codigo2FA;
}

export function verificar2FA(codigoIngresado: string): boolean {
  const codigoReal = localStorage.getItem("meijsac_2fa_code");
  const exp = Number(localStorage.getItem("meijsac_2fa_exp") || 0);
  if (Date.now() > exp) return false;
  if (codigoIngresado === codigoReal) {
    const userPendiente = JSON.parse(localStorage.getItem("meijsac_user_pendiente") || "{}");
    localStorage.setItem("meijsac_user", JSON.stringify(userPendiente));
    localStorage.setItem("meijsac_session_start", Date.now().toString());
    localStorage.setItem("meijsac_last_activity", Date.now().toString());
    localStorage.removeItem("meijsac_2fa_code");
    localStorage.removeItem("meijsac_user_pendiente");
    return true;
  }
  return false;
}

export function cerrarSesionPorInactividad() {
  localStorage.removeItem("meijsac_user");
  localStorage.removeItem("meijsac_session_start");
  localStorage.removeItem("meijsac_last_activity");
  window.location.href = "/login";
}