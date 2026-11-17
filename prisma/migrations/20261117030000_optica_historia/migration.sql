CREATE TABLE IF NOT EXISTS "optica_config" (
  "empresa_id" TEXT NOT NULL,
  "unicodigo" TEXT NOT NULL DEFAULT '',
  "registro_acess" TEXT NOT NULL DEFAULT '',
  "registro_senescyt" TEXT NOT NULL DEFAULT '',
  "cedula_profesional" TEXT NOT NULL DEFAULT '',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "optica_config_pkey" PRIMARY KEY ("empresa_id")
);

CREATE TABLE IF NOT EXISTS "optica_paciente" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "tipo_documento" TEXT NOT NULL DEFAULT 'CEDULA',
  "identificacion" TEXT NOT NULL,
  "nombres" TEXT NOT NULL,
  "apellidos" TEXT NOT NULL,
  "fecha_nacimiento" DATE,
  "sexo" TEXT NOT NULL DEFAULT '',
  "telefono" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "direccion" TEXT NOT NULL DEFAULT '',
  "ocupacion" TEXT NOT NULL DEFAULT '',
  "consentimiento_at" TIMESTAMP(3),
  "consentimiento_texto" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "optica_paciente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "optica_consulta" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "paciente_id" TEXT NOT NULL,
  "usuario_id" TEXT,
  "usuario_nombre" TEXT NOT NULL,
  "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cerrada" BOOLEAN NOT NULL DEFAULT true,
  "motivo" TEXT NOT NULL DEFAULT '',
  "anamnesis" JSONB NOT NULL,
  "lensometria" JSONB NOT NULL,
  "agudeza" JSONB NOT NULL,
  "examen" JSONB NOT NULL,
  "motilidad" JSONB NOT NULL,
  "refraccion" JSONB NOT NULL,
  "diagnosticos" JSONB NOT NULL,
  "plan" TEXT NOT NULL DEFAULT '',
  "profesional" JSONB NOT NULL,
  "establecimiento" JSONB NOT NULL,
  "paciente_resumen" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "optica_consulta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "optica_adenda" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "consulta_id" TEXT NOT NULL,
  "usuario_id" TEXT,
  "usuario_nombre" TEXT NOT NULL,
  "texto" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "optica_adenda_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "optica_paciente_empresa_identificacion" ON "optica_paciente" ("empresa_id", "identificacion");
CREATE INDEX IF NOT EXISTS "optica_paciente_empresa_idx" ON "optica_paciente" ("empresa_id");
CREATE INDEX IF NOT EXISTS "optica_consulta_empresa_fecha_idx" ON "optica_consulta" ("empresa_id", "fecha_hora");
CREATE INDEX IF NOT EXISTS "optica_consulta_paciente_idx" ON "optica_consulta" ("paciente_id");
CREATE INDEX IF NOT EXISTS "optica_adenda_consulta_idx" ON "optica_adenda" ("consulta_id");

DO $$ BEGIN
  ALTER TABLE "optica_config" ADD CONSTRAINT "optica_config_empresa_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "optica_paciente" ADD CONSTRAINT "optica_paciente_empresa_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "optica_consulta" ADD CONSTRAINT "optica_consulta_empresa_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "optica_consulta" ADD CONSTRAINT "optica_consulta_paciente_fkey" FOREIGN KEY ("paciente_id") REFERENCES "optica_paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "optica_consulta" ADD CONSTRAINT "optica_consulta_usuario_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "optica_adenda" ADD CONSTRAINT "optica_adenda_consulta_fkey" FOREIGN KEY ("consulta_id") REFERENCES "optica_consulta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "optica_adenda" ADD CONSTRAINT "optica_adenda_usuario_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
