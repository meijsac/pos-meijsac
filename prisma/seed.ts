const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const empresa = await prisma.empresa.create({
    data: {
      ruc: "1790000000001",
      razonSocial: "MEIJ S.A.",
      nombre: "MEIJ",
      nombreComercial: "MEIJ",
      direccion: "QUITO"
    }
  })

  const usuario = await prisma.usuario.create({
    data: {
      nombre: "Admin",
      email: "meicsacont@gmail.com",
      password: "admin123",
      rol: "ADMIN",
      empresaId: empresa.id
    }
  })

  console.log("Listo! Empresa:", empresa.id, "Usuario:", usuario.id)
}

main()