-- Crea, de una sola vez, toda columna de Empresa y la tabla PlanComercial
-- que el schema de Prisma ya usa y Supabase todavía no tiene.
-- IF NOT EXISTS: si firmaExpira, planEstado o planId ya se agregaron a mano, no falla
-- y sigue con planInicio, planFin y el resto.
DO $$
BEGIN
  IF to_regclass('public."PlanComercial"') IS NULL THEN
    CREATE TABLE "PlanComercial" (
      "id" TEXT NOT NULL,
      "nombre" TEXT NOT NULL,
      "precio" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "duracionDias" INTEGER NOT NULL,
      "limiteComprobantes" INTEGER NOT NULL,
      "limiteUsuarios" INTEGER NOT NULL,
      "modulos" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PlanComercial_pkey" PRIMARY KEY ("id")
    );
  END IF;

  ALTER TABLE "PlanComercial" ADD COLUMN IF NOT EXISTS "nombre" TEXT NOT NULL DEFAULT '';
  ALTER TABLE "PlanComercial" ADD COLUMN IF NOT EXISTS "precio" DOUBLE PRECISION NOT NULL DEFAULT 0;
  ALTER TABLE "PlanComercial" ADD COLUMN IF NOT EXISTS "duracionDias" INTEGER NOT NULL DEFAULT 30;
  ALTER TABLE "PlanComercial" ADD COLUMN IF NOT EXISTS "limiteComprobantes" INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE "PlanComercial" ADD COLUMN IF NOT EXISTS "limiteUsuarios" INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE "PlanComercial" ADD COLUMN IF NOT EXISTS "modulos" TEXT NOT NULL DEFAULT '';
  ALTER TABLE "PlanComercial" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  ALTER TABLE "PlanComercial" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

  ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "razonSocial" TEXT;
  ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "nombreComercial" TEXT;
  ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "direccion" TEXT;
  ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "telefono" TEXT;
  ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "email" TEXT;
  ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "datosRegistro" JSONB;
  ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "firmaExpira" TIMESTAMP(3);
  ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "planEstado" TEXT NOT NULL DEFAULT 'PRUEBA';
  ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "planId" TEXT;
  ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "planInicio" TIMESTAMP(3);
  ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "planFin" TIMESTAMP(3);
  ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "metodoPago" TEXT;
  ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "comprobantesUsados" INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "pruebaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

  UPDATE "Empresa"
  SET "razonSocial" = COALESCE("razonSocial", "nombre", "ruc")
  WHERE "razonSocial" IS NULL;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Empresa_planId_fkey') THEN
    ALTER TABLE "Empresa"
      ADD CONSTRAINT "Empresa_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "PlanComercial"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
