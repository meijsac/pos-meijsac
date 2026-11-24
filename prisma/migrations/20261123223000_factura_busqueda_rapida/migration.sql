CREATE INDEX IF NOT EXISTS "FacturaEmitida_empresa_clave_idx"
  ON "FacturaEmitida" ("empresaId", (payload->>'claveAcceso'));

CREATE INDEX IF NOT EXISTS "FacturaEmitida_empresa_cola_idx"
  ON "FacturaEmitida" ("empresaId", (payload->>'colaId'));

CREATE INDEX IF NOT EXISTS "FacturaEmitida_empresa_serie_sec_idx"
  ON "FacturaEmitida" (
    "empresaId",
    (payload->>'establecimiento'),
    (lpad(regexp_replace(COALESCE(payload->>'secuencial', ''), '[^0-9]', '', 'g'), 9, '0'))
  );
