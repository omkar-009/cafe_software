-- migrate:up
-- Menu catalog: categories, items, images, variants, add-ons ------------------

CREATE TABLE categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  image_url       TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID,
  updated_by      UUID,
  deleted_by      UUID
);
CREATE INDEX idx_categories_tenant ON categories(tenant_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_categories_tenant_name
  ON categories(tenant_id, lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE menu_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  tax_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,     -- percentage
  food_type       TEXT NOT NULL DEFAULT 'VEG'
                    CHECK (food_type IN ('VEG','NON_VEG','EGG','VEGAN')),
  spicy_level     SMALLINT NOT NULL DEFAULT 0 CHECK (spicy_level BETWEEN 0 AND 3),
  prep_time_mins  INTEGER NOT NULL DEFAULT 15,
  ingredients     TEXT[],
  calories        INTEGER,

  is_available    BOOLEAN NOT NULL DEFAULT true,
  is_out_of_stock BOOLEAN NOT NULL DEFAULT false,
  is_recommended  BOOLEAN NOT NULL DEFAULT false,
  is_bestseller   BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID,
  updated_by      UUID,
  deleted_by      UUID
);
CREATE INDEX idx_menu_items_tenant ON menu_items(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_menu_items_category ON menu_items(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_menu_items_search
  ON menu_items USING gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'')));

CREATE TABLE menu_item_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_item_id    UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_menu_images_item ON menu_item_images(menu_item_id);

-- Size / portion variants (Small / Medium / Large ...)
CREATE TABLE menu_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_item_id    UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                       -- Small / Medium / Large
  price_delta     NUMERIC(10,2) NOT NULL DEFAULT 0,    -- added to base price
  is_default      BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_menu_variants_item ON menu_variants(menu_item_id);

-- Add-on / customization groups (Extra Cheese, Toppings ...)
CREATE TABLE addon_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_item_id    UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  min_select      INTEGER NOT NULL DEFAULT 0,
  max_select      INTEGER NOT NULL DEFAULT 1,
  is_required     BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_addon_groups_item ON addon_groups(menu_item_id);

CREATE TABLE addon_options (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id        UUID NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_available    BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_addon_options_group ON addon_options(group_id);

CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_menu_items_updated BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TABLE IF EXISTS addon_options CASCADE;
DROP TABLE IF EXISTS addon_groups CASCADE;
DROP TABLE IF EXISTS menu_variants CASCADE;
DROP TABLE IF EXISTS menu_item_images CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
