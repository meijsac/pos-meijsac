CREATE TABLE IF NOT EXISTS "restaurante_estado" (
  "empresa_id" TEXT NOT NULL,
  "mesas" JSONB NOT NULL DEFAULT '[]',
  "tickets" JSONB NOT NULL DEFAULT '[]',
  "menu" JSONB NOT NULL DEFAULT '[]',
  "categorias" JSONB NOT NULL DEFAULT '[]',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "restaurante_estado_pkey" PRIMARY KEY ("empresa_id")
);

DO $$ BEGIN
  ALTER TABLE "restaurante_estado" ADD CONSTRAINT "restaurante_estado_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
