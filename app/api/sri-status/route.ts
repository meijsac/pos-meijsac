export async function GET() {
  return Response.json({ status: "ok", sri: "activo", modo: "buscar-ruc" });
}