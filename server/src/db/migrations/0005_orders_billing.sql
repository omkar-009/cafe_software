-- migrate:up
-- Customers, coupons, orders, order items, payments, invoices ----------------

CREATE TABLE customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT,
  phone           TEXT,
  email           CITEXT,
  visits_count    INTEGER NOT NULL DEFAULT 0,
  total_spent     NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_visit_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE UNIQUE INDEX uq_customers_tenant_phone
  ON customers(tenant_id, phone) WHERE phone IS NOT NULL;

CREATE TABLE coupons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code            CITEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL CHECK (type IN ('PERCENTAGE','FLAT')),
  value           NUMERIC(10,2) NOT NULL CHECK (value >= 0),
  min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_discount    NUMERIC(10,2),                       -- cap for percentage coupons
  usage_limit     INTEGER,                             -- NULL = unlimited
  used_count      INTEGER NOT NULL DEFAULT 0,
  per_customer_limit INTEGER,
  starts_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID,
  updated_by      UUID,
  deleted_by      UUID
);
CREATE UNIQUE INDEX uq_coupons_tenant_code
  ON coupons(tenant_id, code) WHERE deleted_at IS NULL;

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number    TEXT NOT NULL,                       -- human friendly, per-tenant
  table_id        UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  floor_id        UUID REFERENCES floors(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  waiter_id       UUID REFERENCES users(id) ON DELETE SET NULL,

  status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','ACCEPTED','PREPARING','READY',
                                      'SERVED','COMPLETED','REJECTED','DELAYED','CANCELLED')),
  order_type      TEXT NOT NULL DEFAULT 'DINE_IN'
                    CHECK (order_type IN ('DINE_IN','TAKEAWAY','DELIVERY')),
  priority        SMALLINT NOT NULL DEFAULT 0,

  -- Money (all computed server-side, never trusted from client)
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_charge  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,

  coupon_id       UUID REFERENCES coupons(id) ON DELETE SET NULL,
  coupon_code     TEXT,

  payment_status  TEXT NOT NULL DEFAULT 'UNPAID'
                    CHECK (payment_status IN ('UNPAID','PENDING','PAID','REFUNDED')),

  customer_note   TEXT,
  accepted_at     TIMESTAMPTZ,
  ready_at        TIMESTAMPTZ,
  served_at       TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID,
  updated_by      UUID,
  deleted_by      UUID
);
CREATE UNIQUE INDEX uq_orders_tenant_number ON orders(tenant_id, order_number);
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at DESC);
CREATE INDEX idx_orders_table ON orders(table_id);
CREATE INDEX idx_orders_waiter ON orders(waiter_id);

CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id    UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  variant_id      UUID REFERENCES menu_variants(id) ON DELETE SET NULL,

  name_snapshot   TEXT NOT NULL,                       -- immutable name at order time
  variant_snapshot TEXT,
  unit_price      NUMERIC(10,2) NOT NULL,              -- base + variant delta
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  addons_total    NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_total      NUMERIC(12,2) NOT NULL,              -- (unit_price + addons) * qty
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','PREPARING','READY','SERVED','CANCELLED')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

CREATE TABLE order_item_addons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_item_id   UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  addon_option_id UUID REFERENCES addon_options(id) ON DELETE SET NULL,
  name_snapshot   TEXT NOT NULL,
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_item_addons_item ON order_item_addons(order_item_id);

CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL,
  method          TEXT NOT NULL CHECK (method IN ('CASH','CARD','UPI','ONLINE')),
  status          TEXT NOT NULL DEFAULT 'PAID'
                    CHECK (status IN ('PENDING','PAID','FAILED','REFUNDED')),
  reference       TEXT,
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID
);
CREATE INDEX idx_payments_order ON payments(order_id);

CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  invoice_number  TEXT NOT NULL,
  snapshot        JSONB NOT NULL,                      -- fully-rendered bill data
  pdf_url         TEXT,
  print_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID
);
CREATE UNIQUE INDEX uq_invoices_tenant_number ON invoices(tenant_id, invoice_number);
CREATE INDEX idx_invoices_order ON invoices(order_id);

-- Per-tenant monotonic counters for order & invoice numbers (race-safe via row lock)
CREATE TABLE tenant_counters (
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  counter_key     TEXT NOT NULL,                       -- 'order' | 'invoice'
  value           BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, counter_key)
);

CREATE TRIGGER trg_orders_updated  BEFORE UPDATE ON orders  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_coupons_updated BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TABLE IF EXISTS tenant_counters CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_item_addons CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
