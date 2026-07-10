-- migrate:up
-- Notifications & audit logs -------------------------------------------------

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Target: a specific user, or broadcast to a role within the tenant
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  target_role     TEXT CHECK (target_role IN ('RESTAURANT_ADMIN','KITCHEN','WAITER')),
  type            TEXT NOT NULL,                        -- ORDER_NEW, ORDER_READY, PAYMENT_DONE ...
  title           TEXT NOT NULL,
  body            TEXT,
  link            TEXT,                                 -- deep-link to module/record
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread
  ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_tenant_role
  ON notifications(tenant_id, target_role, is_read);
CREATE INDEX idx_notifications_created ON notifications(tenant_id, created_at DESC);

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = platform action
  module          TEXT NOT NULL,                        -- AUTH, MENU, ORDER ...
  action          TEXT NOT NULL,                        -- CREATE, UPDATE, DELETE, LOGIN ...
  record_id       UUID,
  description     TEXT,
  old_values      JSONB,
  new_values      JSONB,

  actor_id        UUID,                                 -- users.id (created_by / performed_by)
  actor_role      TEXT,
  actor_name      TEXT,

  ip_address      TEXT,
  device          TEXT,
  browser         TEXT,
  operating_system TEXT,
  location        JSONB,                                -- optional geo enrichment

  created_by      UUID,
  updated_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_tenant_module ON audit_logs(tenant_id, module);
CREATE INDEX idx_audit_tenant_action ON audit_logs(tenant_id, action);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_record ON audit_logs(record_id);

-- migrate:down
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
