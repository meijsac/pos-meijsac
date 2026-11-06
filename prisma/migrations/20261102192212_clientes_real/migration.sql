/*
  Warnings:

  - You are about to drop the column `dniRuc` on the `Cliente` table. All the data in the column will be lost.
  - You are about to drop the column `nombre` on the `Cliente` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[identificacion,empresaId]` on the table `Cliente` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `identificacion` to the `Cliente` table without a default value. This is not possible if the table is not empty.
  - Added the required column `razonSocial` to the `Cliente` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Cliente` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Cliente" DROP COLUMN "dniRuc",
DROP COLUMN "nombre",
ADD COLUMN     "categoria" TEXT NOT NULL DEFAULT 'DETALLISTA',
ADD COLUMN     "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "diasCredito" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "identificacion" TEXT NOT NULL,
ADD COLUMN     "limiteCredito" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "nombreComercial" TEXT,
ADD COLUMN     "razonSocial" TEXT NOT NULL,
ADD COLUMN     "tipoCliente" TEXT NOT NULL DEFAULT 'NATURAL',
ADD COLUMN     "tipoId" TEXT NOT NULL DEFAULT '05',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "CajaTurno" (
    "id" TEXT NOT NULL,
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "usuario" TEXT NOT NULL,
    "puntoEmision" TEXT NOT NULL,
    "montoInicial" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "montoCierreFisico" DOUBLE PRECISION,
    "saldoEsperado" DOUBLE PRECISION,
    "diferencia" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CajaTurno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CajaMovimiento" (
    "id" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CajaMovimiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_identificacion_empresaId_key" ON "Cliente"("identificacion", "empresaId");

-- AddForeignKey
ALTER TABLE "CajaMovimiento" ADD CONSTRAINT "CajaMovimiento_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "CajaTurno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
