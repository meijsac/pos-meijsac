import { NextResponse } from "next/server";
export const dynamic = "force-dynamic"

interface ItemFactura {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  codigoPorcentaje: string; // "0","2","3","4","5","6","7","8","10"
}

interface PayloadFacturaSRI {
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  clienteRuc: string;
  clienteNombre: string;
  clienteEmail: string;
  items: ItemFactura[];
  formasPago: Array<{ formaPago: string; total: number }>;
}

const CATALOGO_IVA_SRI: any = {
  "0":  { tarifa: 0,  valor: 0 },
  "2":  { tarifa: 12, valor: 12 },
  "3":  { tarifa: 14, valor: 14 },
  "4":  { tarifa: 15, valor: 15 },
  "5":  { tarifa: 5,  valor: 5 },
  "6":  { tarifa: 0,  valor: 0 },
  "7":  { tarifa: 0,  valor: 0 },
  "8":  { tarifa: 8,  valor: 8 },
  "10": { tarifa: 13, valor: 13 },
}

const PROVEEDOR_SOFTWARE = {
  ruc: "1793161234001",
  razonSocial: "MEIJSAC POS TECNOLOGÍA S.A.S.",
  nombreComercial: "MEIJSAC POS",
  direccion: "Av. 15 de Noviembre, Tena, Ecuador",
  obligadoContabilidad: "NO"
};

function generarDigitoVerificadorM11(cadena48: string): string {
  let pivote = 2; let suma = 0;
  for (let i = cadena48.length - 1; i >= 0; i--) {
    suma += parseInt(cadena48.charAt(i)) * pivote;
    pivote = pivote === 7 ? 2 : pivote + 1;
  }
  const residuo = suma % 11; const digito = 11 - residuo;
  if (digito === 11) return "0"; if (digito === 10) return "1"; return digito.toString();
}
function crearClaveAcceso(p: PayloadFacturaSRI, fechaStr: string): string {
  const fechaLimpia = fechaStr.replace(/\//g, "");
  const tipoComprobante = "01"; const rucEmisor = PROVEEDOR_SOFTWARE.ruc;
  const ambiente = "1"; const serie = p.establecimiento + p.puntoEmision;
  const codigoNumerico = Math.floor(10000000 + Math.random() * 90000000).toString();
  const tipoEmision = "1";
  const cadena48 = fechaLimpia + tipoComprobante + rucEmisor + ambiente + serie + p.secuencial + codigoNumerico + tipoEmision;
  return cadena48 + generarDigitoVerificadorM11(cadena48);
}

export async function POST(request: Request) {
  try {
    const body: PayloadFacturaSRI = await request.json();
    const fechaEmision = new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
    const claveAcceso = crearClaveAcceso(body, fechaEmision);

    // --- 1. CALCULAR BASES Y ARMAR DETALLES CON EL NODO <impuesto> QUE PREGUNTAS ---
    let totalSinImpuestos = 0;
    let totalDescuento = 0;
    let importetotal = 0;
    let agrupadoImpuestos: any = {}; // para totalConImpuestos

    const detallesXml = body.items.map((item:any)=>{
      const base = item.cantidad * item.precioUnitario - (item.descuento || 0);
      const tarifaObj = CATALOGO_IVA_SRI[item.codigoPorcentaje] || CATALOGO_IVA_SRI["4"];
      const tarifa = tarifaObj.tarifa;
      // Si es No Objeto (6) o Exento (7) el IVA es 0
      const valorIvaCalculado = (item.codigoPorcentaje==="6" || item.codigoPorcentaje==="7") ? 0 : base * (tarifa / 100);

      totalSinImpuestos += base;
      importetotal += base + valorIvaCalculado;

      // Agrupar para el totalConImpuestos de infoFactura
      if(!agrupadoImpuestos[item.codigoPorcentaje]){
        agrupadoImpuestos[item.codigoPorcentaje] = { base:0, valor:0, tarifa: tarifa }
      }
      agrupadoImpuestos[item.codigoPorcentaje].base += base;
      agrupadoImpuestos[item.codigoPorcentaje].valor += valorIvaCalculado;

      // --- AQUÍ ES DONDE VA EL <impuesto> QUE PREGUNTAS ---
      return `
      <detalle>
        <codigoPrincipal>${item.codigo || "001"}</codigoPrincipal>
        <descripcion>${item.descripcion}</descripcion>
        <cantidad>${item.cantidad}</cantidad>
        <precioUnitario>${item.precioUnitario.toFixed(2)}</precioUnitario>
        <descuento>${(item.descuento||0).toFixed(2)}</descuento>
        <precioTotalSinImpuesto>${base.toFixed(2)}</precioTotalSinImpuesto>
        <impuestos>
          <impuesto>
            <codigo>2</codigo>
            <codigoPorcentaje>${item.codigoPorcentaje}</codigoPorcentaje>
            <tarifa>${tarifa}</tarifa>
            <baseImponible>${base.toFixed(2)}</baseImponible>
            <valor>${valorIvaCalculado.toFixed(2)}</valor>
          </impuesto>
        </impuestos>
      </detalle>`;
    }).join("");

    // --- 2. ARMAR totalConImpuestos agrupado ---
    const totalConImpuestosXml = Object.keys(agrupadoImpuestos).map(cod=>{
      const g = agrupadoImpuestos[cod];
      return `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${cod}</codigoPorcentaje>
        <baseImponible>${g.base.toFixed(2)}</baseImponible>
        <valor>${g.valor.toFixed(2)}</valor>
      </totalImpuesto>`;
    }).join("");

    const xmlFacturaBase = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>1</ambiente><tipoEmision>1</tipoEmision>
    <razonSocial>${PROVEEDOR_SOFTWARE.razonSocial}</razonSocial>
    <nombreComercial>${PROVEEDOR_SOFTWARE.nombreComercial}</nombreComercial>
    <ruc>${PROVEEDOR_SOFTWARE.ruc}</ruc>
    <claveAcceso>${claveAcceso}</claveAcceso>
    <codDoc>01</codDoc><estab>${body.establecimiento}</estab>
    <ptoEmi>${body.puntoEmision}</ptoEmi><secuencial>${body.secuencial}</secuencial>
    <dirMatriz>${PROVEEDOR_SOFTWARE.direccion}</dirMatriz>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${fechaEmision}</fechaEmision>
    <dirEstablecimiento>${PROVEEDOR_SOFTWARE.direccion}</dirEstablecimiento>
    <obligadoContabilidad>${PROVEEDOR_SOFTWARE.obligadoContabilidad}</obligadoContabilidad>
    <tipoIdentificacionComprador>${body.clienteRuc.length === 13 ? "04" : "05"}</tipoIdentificacionComprador>
    <razonSocialComprador>${body.clienteNombre}</razonSocialComprador>
    <identificacionComprador>${body.clienteRuc}</identificacionComprador>
    <totalSinImpuestos>${totalSinImpuestos.toFixed(2)}</totalSinImpuestos>
    <totalDescuento>${totalDescuento.toFixed(2)}</totalDescuento>
    <totalConImpuestos>${totalConImpuestosXml}
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${importetotal.toFixed(2)}</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos>${body.formasPago.map(p => `<pago><formaPago>${p.formaPago}</formaPago><total>${p.total.toFixed(2)}</total></pago>`).join("")}</pagos>
  </infoFactura>
  <detalles>${detallesXml}
  </detalles>
  <infoAdicional>
    <campoAdicional nombre="Email">${body.clienteEmail}</campoAdicional>
  </infoAdicional>
</factura>`.trim();

    return NextResponse.json({ success: true, mensaje: "XML Tabla 17 OK", claveAcceso, xmlBase: xmlFacturaBase });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}