ALTER TABLE "optica_consulta" ADD COLUMN IF NOT EXISTS "sucursal_id" TEXT;
ALTER TABLE "optica_consulta" ADD COLUMN IF NOT EXISTS "estado" TEXT NOT NULL DEFAULT 'CERRADA';

DO $$ BEGIN
  ALTER TABLE "optica_consulta" ADD CONSTRAINT "optica_consulta_sucursal_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "establecimientos_sri"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "optica_orden" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "sucursal_id" TEXT,
  "consulta_id" TEXT,
  "paciente_id" TEXT NOT NULL,
  "cliente_facturacion_id" TEXT,
  "factura_id" TEXT,
  "formula" JSONB NOT NULL,
  "tipo_lente" TEXT NOT NULL DEFAULT '',
  "material" TEXT NOT NULL DEFAULT '',
  "observaciones" TEXT NOT NULL DEFAULT '',
  "armazon_nombre" TEXT NOT NULL DEFAULT '',
  "luna_nombre" TEXT NOT NULL DEFAULT '',
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_COTIZAR',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "optica_orden_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "optica_orden_consulta_id_key" ON "optica_orden" ("consulta_id");
CREATE INDEX IF NOT EXISTS "optica_orden_empresa_idx" ON "optica_orden" ("empresa_id");

DO $$ BEGIN
  ALTER TABLE "optica_orden" ADD CONSTRAINT "optica_orden_empresa_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "optica_orden" ADD CONSTRAINT "optica_orden_sucursal_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "establecimientos_sri"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "optica_orden" ADD CONSTRAINT "optica_orden_consulta_fkey" FOREIGN KEY ("consulta_id") REFERENCES "optica_consulta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "optica_orden" ADD CONSTRAINT "optica_orden_paciente_fkey" FOREIGN KEY ("paciente_id") REFERENCES "optica_paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "optica_orden" ADD CONSTRAINT "optica_orden_cliente_fkey" FOREIGN KEY ("cliente_facturacion_id") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION proteger_optica_consulta()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.estado = 'CERRADA' THEN
    RAISE EXCEPTION 'Una historia cerrada no se modifica. Agrega una nota aclaratoria.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_optica_consulta_cerrada ON "optica_consulta";
CREATE TRIGGER trg_optica_consulta_cerrada
BEFORE UPDATE ON "optica_consulta"
FOR EACH ROW EXECUTE FUNCTION proteger_optica_consulta();
