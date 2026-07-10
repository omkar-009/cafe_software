-- migrate:up
-- Tenancy, subscriptions, users, auth ---------------------------------------

-- ── Subscription plans (platform-level catalog) ──
CREATE TABLE subscription_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,               -- FREE, STARTER, PRO, ENTERPRISE
  name            TEXT NOT NULL,
  price_monthly   NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly    NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_tables      INTEGER,                            -- NULL = unlimited
  max_staff       INTEGER,
  features        JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tenants (restaurants) ──
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            CITEXT NOT NULL UNIQUE,             -- url-safe unique handle
  name            TEXT NOT NULL,
  legal_name      TEXT,
  email           CITEXT,
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'TRIAL'
                    CHECK (status IN ('ACTIVE','SUSPENDED','DISABLED','TRIAL')),

  -- Branding / menu customization (editable by Restaurant Admin)
  logo_url        TEXT,
  cover_url       TEXT,
  brand_color     TEXT DEFAULT '#F97316',
  menu_header     TEXT,                               -- rich text/HTML shown atop menu
  menu_footer     TEXT,                               -- rich text/HTML shown below menu

  -- Locale / billing
  currency        TEXT NOT NULL DEFAULT 'INR',
  timezone        TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  address         JSONB,                              -- { line1, city, state, country, pincode }
  gst_number      TEXT,
  settings        JSONB NOT NULL DEFAULT '{}'::jsonb, -- tax defaults, service charge, prefs

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID,
  updated_by      UUID,
  deleted_by      UUID
);
CREATE INDEX idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;

-- ── Tenant ↔ plan subscription ──
CREATE TABLE tenant_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id         UUID NOT NULL REFERENCES subscription_plans(id),
  status          TEXT NOT NULL DEFAULT 'TRIAL'
                    CHECK (status IN ('TRIAL','ACTIVE','PAST_DUE','CANCELLED','EXPIRED')),
  billing_cycle   TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (billing_cycle IN ('MONTHLY','YEARLY')),
  trial_ends_at   TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_tenant ON tenant_subscriptions(tenant_id);

-- ── Users (all human/actor accounts across every role) ──
-- Super Admin has tenant_id = NULL (platform scope).
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  role            TEXT NOT NULL
                    CHECK (role IN ('SUPER_ADMIN','RESTAURANT_ADMIN','KITCHEN','WAITER','CUSTOMER')),
  full_name       TEXT NOT NULL,
  email           CITEXT,
  phone           TEXT,
  password_hash   TEXT,                               -- NULL for guest customers
  avatar_url      TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  permissions     JSONB,                              -- optional per-user override list
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID,
  updated_by      UUID,
  deleted_by      UUID
);
-- Email unique per tenant (and unique among platform super admins).
CREATE UNIQUE INDEX uq_users_tenant_email
  ON users(tenant_id, email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_users_tenant_role ON users(tenant_id, role) WHERE deleted_at IS NULL;

-- ── Refresh tokens (rotating, hashed) ──
CREATE TABLE refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL,                      -- sha256 of the raw token
  family_id       UUID NOT NULL,                      -- reuse-detection lineage
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  replaced_by     UUID,
  user_agent      TEXT,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

CREATE TRIGGER trg_tenants_updated       BEFORE UPDATE ON tenants               FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated         BEFORE UPDATE ON users                 FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_plans_updated         BEFORE UPDATE ON subscription_plans    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_subs_updated          BEFORE UPDATE ON tenant_subscriptions  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenant_subscriptions CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
