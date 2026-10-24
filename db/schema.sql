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