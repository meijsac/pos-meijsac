CREATE TABLE IF NOT EXISTS "clinica_paciente" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "tipo_documento" TEXT NOT NULL DEFAULT 'CEDULA',
  "identificacion" TEXT NOT NULL,
  "nombres" TEXT NOT NULL,
  "apellidos" TEXT NOT NULL,
  "fecha_nacimiento" DATE,
  "sexo" TEXT NOT NULL DEFAULT '',
  "grupo_sanguineo" TEXT NOT NULL DEFAULT '',
  "alergias" TEXT NOT NULL DEFAULT '',
  "telefono" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "direccion" TEXT NOT NULL DEFAULT '',
  "numero_historia" TEXT NOT NULL DEFAULT '',
  "consentimiento_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinica_paciente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "clinica_consulta" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "paciente_id" TEXT NOT NULL,
  "usuario_id" TEXT,
  "usuario_nombre" TEXT NOT NULL,
  "plantilla" TEXT NOT NULL DEFAULT 'general',
  "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
  "motivo" TEXT NOT NULL DEFAULT '',
  "enfermedad" TEXT NOT NULL DEFAULT '',
  "antecedentes" TEXT NOT NULL DEFAULT '',
  "examen_fisico" TEXT NOT NULL DEFAULT '',
  "signos" JSONB NOT NULL DEFAULT '{}',
  "especialidad" JSONB NOT NULL DEFAULT '{}',
  "diagnosticos" JSONB NOT NULL DEFAULT '[]',
  "ordenes" JSONB NOT NULL DEFAULT '[]',
  "receta" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinica_consulta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "clinica_archivo" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "consulta_id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "clase" TEXT NOT NULL DEFAULT 'imagen',
  "ruta" TEXT NOT NULL,
  "interpretacion" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinica_archivo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "clinica_paciente_empresa_identificacion_key" ON "clinica_paciente" ("empresa_id", "identificacion");
CREATE INDEX IF NOT EXISTS "clinica_paciente_empresa_idx" ON "clinica_paciente" ("empresa_id");
CREATE INDEX IF NOT EXISTS "clinica_consulta_empresa_fecha_idx" ON "clinica_consulta" ("empresa_id", "created_at");
CREATE INDEX IF NOT EXISTS "clinica_consulta_paciente_idx" ON "clinica_consulta" ("paciente_id");
CREATE INDEX IF NOT EXISTS "clinica_archivo_consulta_idx" ON "clinica_archivo" ("consulta_id");

DO $$ BEGIN
  ALTER TABLE "clinica_paciente" ADD CONSTRAINT "clinica_paciente_empresa_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "clinica_consulta" ADD CONSTRAINT "clinica_consulta_empresa_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "clinica_consulta" ADD CONSTRAINT "clinica_consulta_paciente_fkey" FOREIGN KEY ("paciente_id") REFERENCES "clinica_paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "clinica_consulta" ADD CONSTRAINT "clinica_consulta_usuario_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "clinica_archivo" ADD CONSTRAINT "clinica_archivo_consulta_fkey" FOREIGN KEY ("consulta_id") REFERENCES "clinica_consulta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
