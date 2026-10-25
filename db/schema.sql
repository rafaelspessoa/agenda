CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  username_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'buyer', 'reception', 'supplier')),
  buyer_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  supplier_id TEXT,
  password_hash TEXT,
  supplier_code_hash TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((role = 'supplier' AND buyer_id IS NOT NULL) OR (role <> 'supplier' AND buyer_id IS NULL))
);

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_sessions_expiry_idx ON app_sessions(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS app_users_supplier_idx ON app_users(buyer_id, supplier_id) WHERE role = 'supplier';
-- login do fornecedor pelo código interno (o mesmo código pode existir em mais de um comprador)
CREATE INDEX IF NOT EXISTS app_users_supplier_code_idx ON app_users(supplier_code_hash) WHERE role = 'supplier';

CREATE TABLE IF NOT EXISTS app_login_limits (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_records (
  owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  store TEXT NOT NULL CHECK (store IN (
    'demandas', 'laboratorios', 'compras', 'historico', 'produtos',
    'estoque', 'vendas', 'fornecedores', 'filiais', 'pedidos', 'config'
  )),
  record_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, store, record_id)
);

CREATE INDEX IF NOT EXISTS app_records_owner_updated_idx ON app_records(owner_id, updated_at);
CREATE INDEX IF NOT EXISTS app_records_store_idx ON app_records(store, owner_id);

CREATE TABLE IF NOT EXISTS suppliers (
  buyer_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL,
  name TEXT NOT NULL,
  industries JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (buyer_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS suppliers_name_idx ON suppliers(name);
CREATE INDEX IF NOT EXISTS suppliers_buyer_idx ON suppliers(buyer_id, active, name);

CREATE TABLE IF NOT EXISTS appointments (
  buyer_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  appointment_id TEXT NOT NULL,
  supplier_id TEXT,
  scheduled_date DATE,
  start_time TIME,
  end_time TIME,
  status TEXT NOT NULL DEFAULT 'A fazer',
  supplier_name TEXT,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (buyer_id, appointment_id)
);

CREATE INDEX IF NOT EXISTS appointments_schedule_idx ON appointments(scheduled_date, start_time);
CREATE INDEX IF NOT EXISTS appointments_buyer_schedule_idx ON appointments(buyer_id, scheduled_date, start_time);
CREATE INDEX IF NOT EXISTS appointments_supplier_idx ON appointments(buyer_id, supplier_id, scheduled_date);

CREATE OR REPLACE FUNCTION public.sync_agenda_record_to_relational_tables()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.store = 'demandas' THEN
      DELETE FROM appointments WHERE buyer_id = OLD.owner_id AND appointment_id = OLD.record_id;
    ELSIF OLD.store = 'config' AND OLD.record_id = 'fornecedores' THEN
      DELETE FROM suppliers WHERE buyer_id = OLD.owner_id;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.store = 'config' AND NEW.record_id = 'fornecedores' THEN
    INSERT INTO suppliers (buyer_id, supplier_id, name, industries, active, updated_at)
    SELECT NEW.owner_id, item->>'id', item->>'nome',
      COALESCE(item->'industrias', item->'inds', '[]'::jsonb), TRUE, NOW()
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(NEW.payload->'value') = 'array' THEN NEW.payload->'value' ELSE '[]'::jsonb END
    ) AS items(item)
    WHERE COALESCE(item->>'id', '') <> '' AND COALESCE(item->>'nome', '') <> ''
    ON CONFLICT (buyer_id, supplier_id) DO UPDATE SET
      name = EXCLUDED.name,
      industries = EXCLUDED.industries,
      active = TRUE,
      updated_at = NOW();

    DELETE FROM suppliers existing
    WHERE existing.buyer_id = NEW.owner_id
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(NEW.payload->'value') = 'array' THEN NEW.payload->'value' ELSE '[]'::jsonb END
        ) AS items(item)
        WHERE item->>'id' = existing.supplier_id
      );
  ELSIF NEW.store = 'demandas' THEN
    IF COALESCE(NEW.payload->>'data', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN
      INSERT INTO appointments (
        buyer_id, appointment_id, supplier_id, scheduled_date, start_time, end_time,
        status, supplier_name, payload, updated_at
      ) VALUES (
        NEW.owner_id,
        NEW.record_id,
        NULLIF(NEW.payload->>'fornId', ''),
        (NEW.payload->>'data')::date,
        CASE WHEN COALESCE(NEW.payload->>'hora', '') ~ '^\d{2}:\d{2}(:\d{2})?$' THEN (NEW.payload->>'hora')::time END,
        CASE WHEN COALESCE(NEW.payload->>'horaFim', '') ~ '^\d{2}:\d{2}(:\d{2})?$' THEN (NEW.payload->>'horaFim')::time END,
        COALESCE(NULLIF(NEW.payload->>'status', ''), 'A fazer'),
        NULLIF(NEW.payload->>'fornNome', ''),
        NEW.payload,
        NOW()
      )
      ON CONFLICT (buyer_id, appointment_id) DO UPDATE SET
        supplier_id = EXCLUDED.supplier_id,
        scheduled_date = EXCLUDED.scheduled_date,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        status = EXCLUDED.status,
        supplier_name = EXCLUDED.supplier_name,
        payload = EXCLUDED.payload,
        updated_at = NOW();
    ELSE
      DELETE FROM appointments WHERE buyer_id = NEW.owner_id AND appointment_id = NEW.record_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_records_sync_relational_tables ON app_records;
CREATE TRIGGER app_records_sync_relational_tables
AFTER INSERT OR UPDATE OR DELETE ON app_records
FOR EACH ROW EXECUTE FUNCTION public.sync_agenda_record_to_relational_tables();

INSERT INTO suppliers (buyer_id, supplier_id, name, industries, active)
SELECT r.owner_id, item->>'id', item->>'nome',
  COALESCE(item->'industrias', item->'inds', '[]'::jsonb), TRUE
FROM app_records r
JOIN app_users buyer ON buyer.id = r.owner_id AND buyer.role IN ('buyer', 'admin')
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(r.payload->'value') = 'array' THEN r.payload->'value' ELSE '[]'::jsonb END
) AS items(item)
WHERE r.store = 'config' AND r.record_id = 'fornecedores'
  AND COALESCE(item->>'id', '') <> '' AND COALESCE(item->>'nome', '') <> ''
ON CONFLICT (buyer_id, supplier_id) DO UPDATE SET
  name = EXCLUDED.name, industries = EXCLUDED.industries, active = TRUE, updated_at = NOW();

INSERT INTO appointments (
  buyer_id, appointment_id, supplier_id, scheduled_date, start_time, end_time,
  status, supplier_name, payload
)
SELECT r.owner_id, r.record_id, NULLIF(r.payload->>'fornId', ''),
  (r.payload->>'data')::date,
  CASE WHEN COALESCE(r.payload->>'hora', '') ~ '^\d{2}:\d{2}(:\d{2})?$' THEN (r.payload->>'hora')::time END,
  CASE WHEN COALESCE(r.payload->>'horaFim', '') ~ '^\d{2}:\d{2}(:\d{2})?$' THEN (r.payload->>'horaFim')::time END,
  COALESCE(NULLIF(r.payload->>'status', ''), 'A fazer'),
  NULLIF(r.payload->>'fornNome', ''), r.payload
FROM app_records r
JOIN app_users buyer ON buyer.id = r.owner_id AND buyer.role IN ('buyer', 'admin')
WHERE r.store = 'demandas' AND COALESCE(r.payload->>'data', '') ~ '^\d{4}-\d{2}-\d{2}$'
ON CONFLICT (buyer_id, appointment_id) DO UPDATE SET
  supplier_id = EXCLUDED.supplier_id,
  scheduled_date = EXCLUDED.scheduled_date,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  status = EXCLUDED.status,
  supplier_name = EXCLUDED.supplier_name,
  payload = EXCLUDED.payload,
  updated_at = NOW();

-- Retenção de agendamentos (para o banco não crescer sem limite):
--   * finalizados (concluídos, cancelados ou com atendimento finalizado): 5 dias após a finalização;
--   * pendentes que nunca foram iniciados: 2 dias após a data agendada.
--   Agendamentos repetitivos não entram na regra dos pendentes (a repetição seria perdida).
--   A exclusão em app_records também remove a linha de appointments (gatilho acima).
CREATE OR REPLACE FUNCTION public.agenda_ts(value TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT CASE WHEN value ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}' THEN value::timestamptz END
$$;

CREATE OR REPLACE FUNCTION public.cleanup_agenda_records()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  removed INTEGER;
  today DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  DELETE FROM app_records r
  WHERE r.store = 'demandas' AND (
    (
      (COALESCE(r.payload->>'status', '') IN ('Concluído', 'Cancelado') OR COALESCE(r.payload->>'finalizouEm', '') <> '')
      AND COALESCE(public.agenda_ts(r.payload->>'concluidoEm'), public.agenda_ts(r.payload->>'finalizouEm'), r.updated_at) < NOW() - INTERVAL '5 days'
    ) OR (
      COALESCE(r.payload->>'status', '') NOT IN ('Concluído', 'Cancelado')
      AND COALESCE(r.payload->>'finalizouEm', '') = ''
      AND COALESCE(r.payload->>'iniciouEm', '') = ''
      AND COALESCE(NULLIF(r.payload->'recorrencia'->>'tipo', ''), 'nenhuma') = 'nenhuma'
      AND COALESCE(r.payload->>'data', '') ~ '^\d{4}-\d{2}-\d{2}$'
      AND (r.payload->>'data')::date < today - 2
    )
  );
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

-- roda a limpeza a cada hora no próprio banco (pg_cron do Supabase)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'agenda-limpeza';
  PERFORM cron.schedule('agenda-limpeza', '15 * * * *', 'SELECT public.cleanup_agenda_records()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponivel; a limpeza automatica nao foi agendada: %', SQLERRM;
END;
$$;

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_login_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;