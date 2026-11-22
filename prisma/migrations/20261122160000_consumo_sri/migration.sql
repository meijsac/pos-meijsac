ALTER TABLE "FacturaEmitida" ADD COLUMN IF NOT EXISTS "ambiente" VARCHAR(1);
ALTER TABLE "FacturaEmitida" ADD COLUMN IF NOT EXISTS "fecha_autorizacion" TIMESTAMP(3);
ALTER TABLE "FacturaEmitida" ADD COLUMN IF NOT EXISTS "estado_sri" VARCHAR(20);

CREATE INDEX IF NOT EXISTS "FacturaEmitida_empresaId_ambiente_fecha_autorizacion_idx"
  ON "FacturaEmitida" ("empresaId", "ambiente", "fecha_autorizacion");

CREATE OR REPLACE FUNCTION meijsac_fecha_autorizacion(texto text) RETURNS timestamp AS $$
BEGIN
  IF texto IS NULL OR btrim(texto) = '' THEN RETURN NULL; END IF;
  IF texto ~ '^\d{4}-\d{2}-\d{2}' THEN RETURN texto::timestamp; END IF;
  IF texto ~ '^\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}' THEN RETURN to_timestamp(texto, 'DD/MM/YYYY HH24:MI:SS'); END IF;
  IF texto ~ '^\d{2}/\d{2}/\d{4} \d{2}:\d{2}' THEN RETURN to_timestamp(texto, 'DD/MM/YYYY HH24:MI'); END IF;
  IF texto ~ '^\d{2}/\d{2}/\d{4}' THEN RETURN to_timestamp(texto, 'DD/MM/YYYY'); END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

UPDATE "FacturaEmitida"
SET "ambiente" = CASE
  WHEN length(regexp_replace(COALESCE(payload->>'claveAcceso', ''), '[^0-9]', '', 'g')) >= 24
    AND substring(regexp_replace(COALESCE(payload->>'claveAcceso', ''), '[^0-9]', '', 'g') from 24 for 1) IN ('1', '2')
    THEN substring(regexp_replace(COALESCE(payload->>'claveAcceso', ''), '[^0-9]', '', 'g') from 24 for 1)
  WHEN upper(COALESCE(payload->>'envioSri', '')) LIKE '%PROD%' THEN '2'
  ELSE '1'
END
WHERE "ambiente" IS NULL;

UPDATE "FacturaEmitida"
SET "fecha_autorizacion" = meijsac_fecha_autorizacion(payload->>'fechaAutorizacion')
WHERE "fecha_autorizacion" IS NULL
  AND btrim(COALESCE(payload->>'fechaAutorizacion', '')) <> '';

UPDATE "FacturaEmitida"
SET "estado_sri" = CASE
  WHEN upper(COALESCE(payload->>'estadoSRI', payload->>'estado', "estado", '')) LIKE '%ANUL%' THEN 'ANULADO'
  WHEN upper(COALESCE(payload->>'estadoSRI', payload->>'estado', "estado", '')) LIKE '%RECHAZ%'
    OR upper(COALESCE(payload->>'estadoSRI', payload->>'estado', "estado", '')) LIKE '%DEVUELT%'
    OR upper(COALESCE(payload->>'estadoSRI', payload->>'estado', "estado", '')) LIKE '%NO AUTORIZ%' THEN 'RECHAZADO'
  WHEN btrim(COALESCE(payload->>'fechaAutorizacion', '')) <> '' THEN 'AUTORIZADO'
  ELSE 'EN_PROCESO'
END
WHERE "estado_sri" IS NULL;
