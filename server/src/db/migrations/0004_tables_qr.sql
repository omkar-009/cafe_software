-- migrate:up
-- Floors, tables, and QR codes ----------------------------------------------

CREATE TABLE floors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                       -- Ground Floor, Rooftop ...
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID,
  updated_by      UUID,
  deleted_by      UUID
);
CREATE INDEX idx_floors_tenant ON floors(tenant_id) WHERE deleted_at IS NULL;

CREATE TABLE restaurant_tables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  floor_id        UUID REFERENCES floors(id) ON DELETE SET NULL,
  table_number    TEXT NOT NULL,                       -- "08", "A1"
  label           TEXT,
  seat_capacity   INTEGER NOT NULL DEFAULT 4,
  status          TEXT NOT NULL DEFAULT 'AVAILABLE'
                    CHECK (status IN ('AVAILABLE','OCCUPIED','RESERVED','BILLED','INACTIVE')),

  -- QR: rotating token embedded in the QR payload; version bump invalidates old
  qr_token        TEXT NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  qr_version      INTEGER NOT NULL DEFAULT 1,
  qr_image_url    TEXT,                                -- cached PNG in Supabase (optional)

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID,
  updated_by      UUID,
  deleted_by      UUID
);
CREATE INDEX idx_tables_tenant ON restaurant_tables(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tables_floor ON restaurant_tables(floor_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_tables_tenant_number
  ON restaurant_tables(tenant_id, lower(table_number)) WHERE deleted_at IS NULL;
CREATE INDEX idx_tables_qr_token ON restaurant_tables(qr_token);

CREATE TRIGGER trg_floors_updated BEFORE UPDATE ON floors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tables_updated BEFORE UPDATE ON restaurant_tables FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TABLE IF EXISTS restaurant_tables CASCADE;
DROP TABLE IF EXISTS floors CASCADE;
