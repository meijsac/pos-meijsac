CREATE TABLE IF NOT EXISTS "proformas" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "numero" INTEGER NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'GUARDADA',
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proformas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "proformas_empresa_id_numero_key" ON "proformas" ("empresa_id", "numero");
CREATE INDEX IF NOT EXISTS "proformas_empresa_id_created_at_idx" ON "proformas" ("empresa_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "proformas" ADD CONSTRAINT "proformas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
