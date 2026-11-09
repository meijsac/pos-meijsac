-- CreateTable
CREATE TABLE "PlanComercial" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duracionDias" INTEGER NOT NULL,
    "limiteComprobantes" INTEGER NOT NULL,
    "limiteUsuarios" INTEGER NOT NULL,
    "modulos" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanComercial_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "firmaExpira" TIMESTAMP(3),
ADD COLUMN     "planEstado" TEXT NOT NULL DEFAULT 'PRUEBA',
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "planInicio" TIMESTAMP(3),
ADD COLUMN     "planFin" TIMESTAMP(3),
ADD COLUMN     "metodoPago" TEXT,
ADD COLUMN     "comprobantesUsados" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pruebaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanComercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
