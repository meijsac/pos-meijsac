import { NextRequest, NextResponse } from 'next/server';
import * as forge from 'node-forge';
import { prisma } from '@/lib/prisma';
import { usuarioConEmpresaDesdeRequest } from '@/lib/empresa-sesion';
import { encriptarBytes, encriptar } from '@/lib/seguridad';
import { firmaCoincideConEmpresa } from '@/lib/sri/cedula-ruc';

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try{
    const formData = await req.formData();
    const file = formData.get('p12') as File;
    const clave = formData.get('clave') as string;
    const rucEmpresa = formData.get('rucEmpresa') as string;

    if(!file) return NextResponse.json({ok:false, error:"Sube el archivo.p12"}, {status:400});

    const arrayBuffer = await file.arrayBuffer();
    const p12Der = forge.util.createBuffer(arrayBuffer as any);
    const p12Asn1 = forge.asn1.fromDer(p12Der);

    let p12:any;
    try{
      p12 = (forge.pkcs12 as any).pkcs12FromAsn1(p12Asn1, clave);
    }catch{
      return NextResponse.json({ok:false, error:"Contraseña de firma incorrecta"});
    }

    const certBags = p12.getBags({bagType: forge.pki.oids.certBag})[forge.pki.oids.certBag];
    const cert = certBags[0].cert;

    const fechaExp = cert.validity.notAfter;
    const diasRestantes = Math.ceil((fechaExp.getTime() - Date.now()) / (1000*60*60*24));
    const subject = (cert.subject.attributes as any[]).map((a:any) => a.value).join(' ');

    const attrs = cert.subject.attributes as any[];
// La cédula en Ecuador viene en SERIALNUMBER del certificado
let cedulaEnFirma = attrs.find((a:any) => 
  a.shortName === 'SERIALNUMBER' || a.name === 'serialNumber'
)?.value || "";

// Si no viene como SERIALNUMBER, la buscamos en el texto del subject
if (!cedulaEnFirma) {
  const match = subject.match(/\b(\d{10})\b/);
  if (match) cedulaEnFirma = match[1];
}

const rucEnFirma = cedulaEnFirma;
// Persona natural: IDCEC-1708330509 es la misma persona que el RUC 1708330509001.
const rucCoincide = firmaCoincideConEmpresa(rucEnFirma, rucEmpresa);

const ruc = String(rucEmpresa || "").trim()
if (ruc) {
  await prisma.empresa.updateMany({
    where: { ruc },
    data: { firmaExpira: fechaExp },
  })
}

const sesion = await usuarioConEmpresaDesdeRequest(req)
let guardada = false
if (!("error" in sesion)) {
  const bytes = Buffer.from(new Uint8Array(arrayBuffer))
  await prisma.firmaElectronica.upsert({
    where: { empresaId: sesion.empresa.id },
    create: {
      empresaId: sesion.empresa.id,
      nombre: file.name || "firma.p12",
      p12Cifrado: encriptarBytes(bytes),
      claveCifrada: clave ? encriptar(clave) : "",
      titular: subject.slice(0, 300),
      expira: fechaExp,
    },
    update: {
      nombre: file.name || "firma.p12",
      p12Cifrado: encriptarBytes(bytes),
      claveCifrada: clave ? encriptar(clave) : "",
      titular: subject.slice(0, 300),
      expira: fechaExp,
    },
  })
  if (!ruc || ruc === sesion.empresa.ruc) {
    await prisma.empresa.update({ where: { id: sesion.empresa.id }, data: { firmaExpira: fechaExp } })
  }
  guardada = true
}

return NextResponse.json({
  guardada,
  claveGuardada: true,
  ok: true,
  ruc: rucEmpresa,
  rucEnFirma: rucEnFirma,
  rucCoincide: rucCoincide,
  titular: subject,
  expira: fechaExp,
  fechaExpiracion: fechaExp,
  dias: diasRestantes,
  diasRestantes: diasRestantes,
  valido: diasRestantes > 0
})

  }catch(e:any){
    return NextResponse.json({ok:false, error: e.message}, {status:500})
  }
}