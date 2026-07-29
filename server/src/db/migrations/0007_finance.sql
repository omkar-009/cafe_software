-- migrate:up
-- Finance: per-product cost (COGS), expenses ---------------------------------

-- Cost to produce a menu item (₹). gross margin = price - cost_price.
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Snapshot the unit cost at order time so historical COGS stays accurate even
-- if the product's cost changes later or the product is deleted.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_snapshot NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE TABLE expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category        TEXT NOT NULL DEFAULT 'OTHER'
                    CHECK (category IN ('INGREDIENTS','SALARIES','RENT','UTILITIES','MARKETING',
                                        'MAINTENANCE','EQUIPMENT','PACKAGING','TAXES','OTHER')),
  title           TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  vendor          TEXT,
  payment_method  TEXT NOT NULL DEFAULT 'CASH'
                    CHECK (payment_method IN ('CASH','CARD','UPI','BANK','OTHER')),
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  note            TEXT,
  attachment_url  TEXT,
  is_recurring    BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID,
  updated_by      UUID,
  deleted_by      UUID
);
CREATE INDEX idx_expenses_tenant_date ON expenses(tenant_id, expense_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_tenant_category ON expenses(tenant_id, category) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TABLE IF EXISTS expenses CASCADE;
ALTER TABLE order_items DROP COLUMN IF EXISTS cost_snapshot;
ALTER TABLE menu_items DROP COLUMN IF EXISTS cost_price;
