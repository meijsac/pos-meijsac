export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id")?.trim().replace(/\D/g,"") || "";
  if (!id) return Response.json({ success: false, error: "Sin ID" });

  const rucs = [id, id.length === 10 ? `${id}001` : ""].filter(Boolean);
  
  const endpoints = [
    (ruc: string) => `https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/CatastroSujetoRucDto/obtenerPorNumerosRuc?ruc=${ruc}`,
    (ruc: string) => `https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumerosRuc?ruc=${ruc}`
  ];

  for (const ruc of rucs) {
    for (const makeUrl of endpoints) {
      try {
        const res = await fetch(makeUrl(ruc), {
          headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://srienlinea.sri.gob.ec/" },
          cache: "no-store",
          signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) continue;
        
        const json = await res.json();
        const d = Array.isArray(json) ? json[0] : json?.contribuyente || json;
        
        if (d?.razonSocial) {
          // 1. Intentar obtener la dirección de los campos principales
          let direccion = d.direccionMatriz || d.direccion || d.calle || "";

          // 2. Si está vacía, buscar en el endpoint de establecimientos del SRI
          if (!direccion) {
            try {
              const rEst = await fetch(
                `https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/Establecimiento/obtenerPorNumeroRuc?ruc=${ruc}`,
                { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://srienlinea.sri.gob.ec/" }, cache: "no-store" }
              );
              const jEst = await rEst.json();
              if (Array.isArray(jEst) && jEst.length > 0) {
                const mat = jEst.find((e: any) => e.codigoEstablecimiento === "001") || jEst[0];
                direccion = mat.direccionCompleta || mat.direccion || "";
              }
            } catch {}
          }

          // Limpieza opcional (remover "ECUADOR" si viene al final o formatear espacios)
          direccion = direccion.replace(/,\s*ECUADOR$/i, "").trim();

          return Response.json({
            success: true,
            data: {
              razonSocial: d.razonSocial,
              direccion: direccion || "No especificada"
            }
          });
        }
      } catch {}
    }
  }

  return Response.json({ success: false, error: `SRI no devolvió datos para ${id}.` });
}