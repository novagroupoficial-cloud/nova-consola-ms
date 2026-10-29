-- NOVA Activación 2.0: inicialización idempotente.
CREATE TABLE IF NOT EXISTS nova_schema_version (id integer PRIMARY KEY CHECK(id=1), version integer NOT NULL);
CREATE TABLE IF NOT EXISTS nova_accounts (
 id text PRIMARY KEY, role text NOT NULL CHECK(role IN ('admin','client')),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120), email text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
 key_hash text UNIQUE, key_hint text NOT NULL DEFAULT '', session_version integer NOT NULL DEFAULT 1,
 active boolean NOT NULL DEFAULT true, balance integer NOT NULL DEFAULT 0 CHECK(balance BETWEEN 0 AND 1000000),
 daily_limit integer NOT NULL DEFAULT 0 CHECK(daily_limit BETWEEN 0 AND 10000), usage_day text NOT NULL DEFAULT '', daily_used integer NOT NULL DEFAULT 0 CHECK(daily_used>=0),
 expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_login_at timestamptz,
 CHECK((role='admin' AND id='admin' AND key_hash IS NULL) OR (role='client' AND id<>'admin' AND length(key_hash)=64))
);
CREATE TABLE IF NOT EXISTS nova_operations (
 id text PRIMARY KEY, account_id text NOT NULL REFERENCES nova_accounts(id), request_id text NOT NULL,
 product text NOT NULL, iid text NOT NULL, cid text,
 status text NOT NULL CHECK(status IN ('pending','success','error')), error_code text NOT NULL DEFAULT '', error_message text NOT NULL DEFAULT '',
 charged boolean NOT NULL DEFAULT false, refunded boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(account_id,request_id)
);
CREATE INDEX IF NOT EXISTS nova_operations_account_date ON nova_operations(account_id,created_at DESC);
CREATE INDEX IF NOT EXISTS nova_operations_date ON nova_operations(created_at DESC);
CREATE TABLE IF NOT EXISTS nova_credit_ledger (
 id text PRIMARY KEY, account_id text NOT NULL REFERENCES nova_accounts(id), operation_id text REFERENCES nova_operations(id),
 delta integer NOT NULL, balance_after integer NOT NULL CHECK(balance_after>=0), reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nova_ledger_account_date ON nova_credit_ledger(account_id,created_at DESC);
CREATE TABLE IF NOT EXISTS nova_audit (
 id text PRIMARY KEY, action text NOT NULL, account_id text REFERENCES nova_accounts(id), details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO nova_accounts(id,role,name) VALUES('admin','admin','Administrador') ON CONFLICT(id) DO NOTHING;
INSERT INTO nova_schema_version(id,version) VALUES(1,2) ON CONFLICT(id) DO NOTHING;
