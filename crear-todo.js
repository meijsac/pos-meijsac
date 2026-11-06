const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
p.empresa.create({data:{ruc:"1790000000001",razonSocial:"MEIJ S.A.",nombre:"MEIJ"}}).then(e=>p.usuario.create({data:{nombre:"Admin",email:"admin@meij.com",password:"admin123",rol:"ADMIN",empresaId:e.id}}).then(()=>{console.log("LISTO");process.exit()}))