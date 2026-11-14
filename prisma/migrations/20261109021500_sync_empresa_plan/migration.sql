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

  IF to_regclass('public."FacturaEmitida"') IS NULL THEN
    CREATE TABLE "FacturaEmitida" (
      "id" TEXT NOT NULL,
      "empresaId" TEXT NOT NULL,
      "estado" TEXT NOT NULL,
      "payload" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FacturaEmitida_pkey" PRIMARY KEY ("id")
    );
  END IF;

  ALTER TABLE "PlanComercial" ADD COLUMN IF NOT EXISTS "descripcion" TEXT NOT NULL DEFAULT '';
  ALTER TABLE "PlanComercial" ADD COLUMN IF NOT EXISTS "precioAnual" DOUBLE PRECISION NOT NULL DEFAULT 0;
  ALTER TABLE "PlanComercial" ADD COLUMN IF NOT EXISTS "trialDias" INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE "PlanComercial" ADD COLUMN IF NOT EXISTS "documentosAnio" INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE "PlanComercial" ADD COLUMN IF NOT EXISTS "badge" TEXT NOT NULL DEFAULT '';
  ALTER TABLE "PlanComercial" ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true;

  ALTER TABLE "FacturaEmitida" ADD COLUMN IF NOT EXISTS "tipo_cobro" TEXT;
  ALTER TABLE "FacturaEmitida" ADD COLUMN IF NOT EXISTS "estado_pago" TEXT;
  ALTER TABLE "FacturaEmitida" ADD COLUMN IF NOT EXISTS "plazo" INTEGER;
  ALTER TABLE "FacturaEmitida" ADD COLUMN IF NOT EXISTS "unidad_plazo" TEXT;
  ALTER TABLE "FacturaEmitida" ADD COLUMN IF NOT EXISTS "cuotas" INTEGER;
  ALTER TABLE "FacturaEmitida" ADD COLUMN IF NOT EXISTS "fecha_vencimiento" TIMESTAMP(3);

  CREATE TABLE IF NOT EXISTS "documentos_legales" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "fecha_caducidad" TIMESTAMP(3) NOT NULL,
    "archivo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documentos_legales_pkey" PRIMARY KEY ("id")
  );
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documentos_legales_empresa_id_fkey') THEN
    ALTER TABLE "documentos_legales"
      ADD CONSTRAINT "documentos_legales_empresa_id_fkey"
      FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  CREATE TABLE IF NOT EXISTS "inventario_config" (
    "empresaId" TEXT NOT NULL,
    "metodoCosteo" TEXT NOT NULL DEFAULT 'PROMEDIO',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventario_config_pkey" PRIMARY KEY ("empresaId")
  );
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_config_empresaId_fkey') THEN
    ALTER TABLE "inventario_config"
      ADD CONSTRAINT "inventario_config_empresaId_fkey"
      FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  CREATE TABLE IF NOT EXISTS "kardex_movimientos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "productoCodigo" TEXT NOT NULL DEFAULT '',
    "productoNombre" TEXT NOT NULL DEFAULT '',
    "sucursal" TEXT NOT NULL DEFAULT 'PRINCIPAL',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL DEFAULT '',
    "cantidadEntrada" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cantidadSalida" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costoEntrada" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usuario" TEXT NOT NULL DEFAULT '',
    "transferenciaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kardex_movimientos_pkey" PRIMARY KEY ("id")
  );
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kardex_movimientos_empresaId_fkey') THEN
    ALTER TABLE "kardex_movimientos"
      ADD CONSTRAINT "kardex_movimientos_empresaId_fkey"
      FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  CREATE TABLE IF NOT EXISTS "transferencias_inventario" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origen" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "productoCodigo" TEXT NOT NULL DEFAULT '',
    "productoNombre" TEXT NOT NULL DEFAULT '',
    "cantidad" DOUBLE PRECISION NOT NULL,
    "costo" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT '',
    "usuario" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transferencias_inventario_pkey" PRIMARY KEY ("id")
  );
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transferencias_inventario_empresaId_fkey') THEN
    ALTER TABLE "transferencias_inventario"
      ADD CONSTRAINT "transferencias_inventario_empresaId_fkey"
      FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FacturaEmitida_empresaId_fkey') THEN
    ALTER TABLE "FacturaEmitida"
      ADD CONSTRAINT "FacturaEmitida_empresaId_fkey"
      FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "sesiones_usuario" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "expira" TIMESTAMP(3) NOT NULL,
  "ip" TEXT NOT NULL DEFAULT '',
  "navegador" TEXT NOT NULL DEFAULT '',
  "revocada" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sesiones_usuario_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "login_intentos" (
  "id" TEXT NOT NULL,
  "correo" TEXT NOT NULL,
  "ip" TEXT NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "exitoso" BOOLEAN NOT NULL,
  "canal" TEXT NOT NULL DEFAULT 'LOGIN',
  CONSTRAINT "login_intentos_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "seguridad_logs" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT,
  "usuario" TEXT NOT NULL DEFAULT '',
  "ip" TEXT NOT NULL DEFAULT '',
  "accion" TEXT NOT NULL,
  "dispositivo" TEXT NOT NULL DEFAULT '',
  "detalle" TEXT NOT NULL DEFAULT '',
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seguridad_logs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "password_reset" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "expira" TIMESTAMP(3) NOT NULL,
  "usado" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "password_reset_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "usuario_seguridad" (
  "usuarioId" TEXT NOT NULL,
  "dosFaActivo" BOOLEAN NOT NULL DEFAULT false,
  "totpCifrado" TEXT NOT NULL DEFAULT '',
  "respaldos" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "usuario_seguridad_pkey" PRIMARY KEY ("usuarioId")
);
ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "ficha" JSONB;
ALTER TABLE "CajaTurno" ADD COLUMN IF NOT EXISTS "montoFinal" DOUBLE PRECISION;
ALTER TABLE "CajaTurno" ADD COLUMN IF NOT EXISTS "dispositivo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CajaTurno" ADD COLUMN IF NOT EXISTS "ultimaActividad" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "FacturaEmitida" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Producto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "frecuente" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Cliente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kardex_movimientos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transferencias_inventario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Empresa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Usuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_intentos" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS "firma_electronica" (
  "empresaId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "p12Cifrado" TEXT NOT NULL,
  "titular" TEXT NOT NULL DEFAULT '',
  "claveCifrada" TEXT NOT NULL DEFAULT '',
  "expira" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "firma_electronica_pkey" PRIMARY KEY ("empresaId")
);
ALTER TABLE "firma_electronica" ADD COLUMN IF NOT EXISTS "claveCifrada" TEXT NOT NULL DEFAULT '';
ALTER TABLE "firma_electronica" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FacturaEmitida" ADD COLUMN IF NOT EXISTS "sri_status" TEXT;
ALTER TABLE "seguridad_logs" ENABLE ROW LEVEL SECURITY;

-- Cierra el API público de Supabase. El backend (postgres / service_role) ignora RLS.
-- No usa USING (true). Un usuario del API solo ve la empresa de su token.
DO $$
DECLARE
  t text;
  pol record;
  con_empresa text[] := ARRAY[
    'FacturaEmitida','Producto','Cliente','Usuario','Proveedor',
    'kardex_movimientos','transferencias_inventario','MovimientoInventario',
    'inventario_config','firma_electronica','seguridad_logs'
  ];
  cerradas text[] := ARRAY[
    'PlanComercial','login_intentos','password_reset','usuario_seguridad','CajaTurno','CajaMovimiento'
  ];
  todas text[] := con_empresa || cerradas || ARRAY['Empresa','documentos_legales','Sucursal','sesiones_usuario'];
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND (qual = 'true' OR with_check = 'true')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;

  FOREACH t IN ARRAY todas LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', t);
    EXECUTE format('DROP POLICY IF EXISTS meijsac_tenant ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS meijsac_cerrada ON %I', t);
  END LOOP;

  IF to_regprocedure('auth.jwt()') IS NULL THEN RETURN; END IF;

  FOREACH t IN ARRAY con_empresa LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format(
      'CREATE POLICY meijsac_tenant ON %I FOR ALL TO authenticated USING ("empresaId" = coalesce(auth.jwt() ->> ''empresaId'', '''')) WITH CHECK ("empresaId" = coalesce(auth.jwt() ->> ''empresaId'', ''''))',
      t
    );
  END LOOP;

  IF to_regclass('public."Empresa"') IS NOT NULL THEN
    CREATE POLICY meijsac_tenant ON "Empresa" FOR ALL TO authenticated
      USING ("id" = coalesce(auth.jwt() ->> 'empresaId', ''))
      WITH CHECK ("id" = coalesce(auth.jwt() ->> 'empresaId', ''));
  END IF;

  IF to_regclass('public.documentos_legales') IS NOT NULL THEN
    CREATE POLICY meijsac_tenant ON documentos_legales FOR ALL TO authenticated
      USING (empresa_id = coalesce(auth.jwt() ->> 'empresaId', ''))
      WITH CHECK (empresa_id = coalesce(auth.jwt() ->> 'empresaId', ''));
  END IF;

  IF to_regclass('public."Sucursal"') IS NOT NULL THEN
    CREATE POLICY meijsac_tenant ON "Sucursal" FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM "Cliente" c
        WHERE c.id = "Sucursal"."clienteId"
          AND c."empresaId" = coalesce(auth.jwt() ->> 'empresaId', '')
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM "Cliente" c
        WHERE c.id = "Sucursal"."clienteId"
          AND c."empresaId" = coalesce(auth.jwt() ->> 'empresaId', '')
      ));
  END IF;

  IF to_regclass('public.sesiones_usuario') IS NOT NULL THEN
    CREATE POLICY meijsac_tenant ON sesiones_usuario FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM "Usuario" u
        WHERE u.id = sesiones_usuario."usuarioId"
          AND u."empresaId" = coalesce(auth.jwt() ->> 'empresaId', '')
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM "Usuario" u
        WHERE u.id = sesiones_usuario."usuarioId"
          AND u."empresaId" = coalesce(auth.jwt() ->> 'empresaId', '')
      ));
  END IF;

  FOREACH t IN ARRAY cerradas LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format(
      'CREATE POLICY meijsac_cerrada ON %I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;

ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS ambiente_sri TEXT NOT NULL DEFAULT '1';
UPDATE "Empresa" SET ambiente_sri = '2'
WHERE ambiente_sri = '1' AND (
  "datosRegistro"->>'ambienteCodigo' = '2'
  OR upper(coalesce("datosRegistro"->>'ambiente', '')) LIKE '%PROD%'
);

ALTER TABLE "firma_electronica" DROP COLUMN IF EXISTS "p12Cifrado";
ALTER TABLE "firma_electronica" DROP COLUMN IF EXISTS "claveCifrada";

CREATE TABLE IF NOT EXISTS certificados_sri (
  empresa_id TEXT PRIMARY KEY REFERENCES "Empresa"(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  p12_iv TEXT NOT NULL,
  p12_tag TEXT NOT NULL,
  clave_cifrada TEXT NOT NULL,
  clave_iv TEXT NOT NULL,
  clave_tag TEXT NOT NULL,
  expira TIMESTAMP(3) NOT NULL,
  titular TEXT NOT NULL DEFAULT '',
  nombre TEXT NOT NULL DEFAULT '',
  ruc_certificado TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS empresa_usuarios (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES "Empresa"(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  rol TEXT NOT NULL,
  UNIQUE (empresa_id, user_id)
);
INSERT INTO empresa_usuarios (id, empresa_id, user_id, rol)
SELECT u.id, u."empresaId", u.id, u.rol
FROM "Usuario" u
ON CONFLICT (empresa_id, user_id) DO UPDATE SET rol = EXCLUDED.rol;

ALTER TABLE certificados_sri ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresa_usuarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON certificados_sri FROM anon;
REVOKE ALL ON empresa_usuarios FROM anon;
DROP POLICY IF EXISTS certificados_sri_bloqueo ON certificados_sri;
CREATE POLICY certificados_sri_bloqueo ON certificados_sri
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DO $$
DECLARE
  t text;
BEGIN
  IF to_regprocedure('auth.uid()') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS empresa_usuarios_propia ON empresa_usuarios;
  CREATE POLICY empresa_usuarios_propia ON empresa_usuarios
    FOR SELECT TO authenticated
    USING (user_id = auth.uid()::text);
  FOREACH t IN ARRAY ARRAY['FacturaEmitida','Producto','Cliente','Usuario','Proveedor','firma_electronica'] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS miembro_empresa ON %I', t);
    EXECUTE format(
      'CREATE POLICY miembro_empresa ON %I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM empresa_usuarios eu WHERE eu.empresa_id = %I."empresaId" AND eu.user_id = auth.uid()::text)) WITH CHECK (EXISTS (SELECT 1 FROM empresa_usuarios eu WHERE eu.empresa_id = %I."empresaId" AND eu.user_id = auth.uid()::text))',
      t, t, t
    );
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN RETURN; END IF;
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('firmas-electronicas', 'firmas-electronicas', false)
  ON CONFLICT (id) DO UPDATE SET public = false;
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('comprobantes-sri', 'comprobantes-sri', false)
  ON CONFLICT (id) DO UPDATE SET public = false;
  DROP POLICY IF EXISTS firmas_sin_cliente ON storage.objects;
  CREATE POLICY firmas_sin_cliente ON storage.objects
    AS RESTRICTIVE
    FOR ALL TO anon, authenticated
    USING (bucket_id <> 'firmas-electronicas' AND bucket_id <> 'comprobantes-sri')
    WITH CHECK (bucket_id <> 'firmas-electronicas' AND bucket_id <> 'comprobantes-sri');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS catalogos_sri (
  id TEXT PRIMARY KEY,
  grupo TEXT NOT NULL,
  codigo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  porcentaje DOUBLE PRECISION NOT NULL DEFAULT 0,
  vigente BOOLEAN NOT NULL DEFAULT true,
  "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoPor" TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS catalogos_sri_grupo_codigo ON catalogos_sri (grupo, codigo);

CREATE TABLE IF NOT EXISTS catalogos_sri_cambios (
  id TEXT PRIMARY KEY,
  grupo TEXT NOT NULL,
  codigo TEXT NOT NULL,
  fecha TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario TEXT NOT NULL,
  antes TEXT NOT NULL DEFAULT '',
  despues TEXT NOT NULL DEFAULT ''
);
