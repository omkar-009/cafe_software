/**
 * Idempotent development seed.
 *   - Subscription plans
 *   - A platform Super Admin
 *   - A demo restaurant (tenant) with Admin / Kitchen / Waiter accounts
 *   - Sample floor, tables, categories and menu items
 *
 * Safe to run multiple times (uses ON CONFLICT / existence checks).
 *
 * Demo credentials (password for all): Password123!
 *   super admin : superadmin@restrosaas.com
 *   restaurant  : owner@demo.com        (tenant slug: demo-cafe)
 *   kitchen     : kitchen@demo.com
 *   waiter      : waiter@demo.com
 */
import { withTransaction, pool } from '../config/database.js';
import { hashPassword } from '../shared/security.js';
import { ROLES, TENANT_STATUS } from '../shared/constants.js';
import logger from '../config/logger.js';

const DEMO_PASSWORD = 'Password123!';

async function seed() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await withTransaction(async (q) => {
    // ── Subscription plans ──
    await q(
      `INSERT INTO subscription_plans (code, name, price_monthly, price_yearly, max_tables, max_staff, features)
       VALUES
        ('FREE','Free Trial',0,0,10,5,'{"analytics":false,"kds":true}'),
        ('STARTER','Starter',999,9990,25,15,'{"analytics":true,"kds":true}'),
        ('PRO','Professional',2499,24990,100,50,'{"analytics":true,"kds":true,"reports":true}'),
        ('ENTERPRISE','Enterprise',6999,69990,NULL,NULL,'{"analytics":true,"kds":true,"reports":true,"priority_support":true}')
       ON CONFLICT (code) DO NOTHING`,
    );

    // ── Super Admin (platform scope, tenant_id NULL) ──
    await q(
      `INSERT INTO users (tenant_id, role, full_name, email, password_hash)
       SELECT NULL, $1, 'Platform Owner', 'superadmin@restrosaas.com', $2
       WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'superadmin@restrosaas.com' AND tenant_id IS NULL)`,
      [ROLES.SUPER_ADMIN, passwordHash],
    );

    // ── Demo tenant ──
    const tenantRes = await q(
      `INSERT INTO tenants (slug, name, email, phone, status, brand_color, menu_header, menu_footer, currency, address)
       VALUES ('demo-cafe','Demo Cafe','owner@demo.com','+911234567890',$1,'#F97316',
               'Welcome to Demo Cafe ☕ — freshly brewed happiness',
               'Thank you for dining with us! Follow @democafe',
               'INR', '{"line1":"12 MG Road","city":"Bengaluru","state":"KA","country":"India","pincode":"560001"}')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [TENANT_STATUS.ACTIVE],
    );
    const tenantId = tenantRes.rows[0].id;

    // Attach PRO subscription
    await q(
      `INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
       SELECT $1, id, 'ACTIVE', now(), now() + interval '30 days' FROM subscription_plans WHERE code = 'PRO'
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );

    // ── Staff ──
    const staff = [
      [ROLES.RESTAURANT_ADMIN, 'Demo Owner', 'owner@demo.com'],
      [ROLES.KITCHEN, 'Head Chef', 'kitchen@demo.com'],
      [ROLES.WAITER, 'Ravi Waiter', 'waiter@demo.com'],
    ];
    for (const [role, name, email] of staff) {
      // eslint-disable-next-line no-await-in-loop
      await q(
        `INSERT INTO users (tenant_id, role, full_name, email, password_hash, created_by)
         SELECT $1,$2,$3,$4,$5,$1
         WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = $4 AND tenant_id = $1)`,
        [tenantId, role, name, email, passwordHash],
      );
    }

    // ── Floor + tables ──
    const floorRes = await q(
      `INSERT INTO floors (tenant_id, name, sort_order)
       SELECT $1,'Ground Floor',1
       WHERE NOT EXISTS (SELECT 1 FROM floors WHERE tenant_id = $1 AND name = 'Ground Floor')
       RETURNING id`,
      [tenantId],
    );
    if (floorRes.rows[0]) {
      const floorId = floorRes.rows[0].id;
      for (let i = 1; i <= 8; i += 1) {
        const num = String(i).padStart(2, '0');
        // eslint-disable-next-line no-await-in-loop
        await q(
          `INSERT INTO restaurant_tables (tenant_id, floor_id, table_number, seat_capacity)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT DO NOTHING`,
          [tenantId, floorId, num, 4],
        );
      }
    }

    // ── Categories + items ──
    const categories = [
      ['Starters', 1],
      ['Main Course', 2],
      ['Beverages', 3],
      ['Desserts', 4],
    ];
    const catIds = {};
    for (const [name, order] of categories) {
      // eslint-disable-next-line no-await-in-loop
      const res = await q(
        `INSERT INTO categories (tenant_id, name, sort_order)
         VALUES ($1,$2,$3)
         ON CONFLICT (tenant_id, lower(name)) WHERE deleted_at IS NULL DO UPDATE SET sort_order = EXCLUDED.sort_order
         RETURNING id`,
        [tenantId, name, order],
      );
      catIds[name] = res.rows[0].id;
    }

    const items = [
      ['Starters', 'Paneer Tikka', 'Char-grilled cottage cheese', 220, 5, 'VEG', 2, true],
      ['Starters', 'Chicken Wings', 'Spicy buffalo wings', 280, 5, 'NON_VEG', 3, false],
      ['Main Course', 'Butter Chicken', 'Creamy tomato gravy', 340, 5, 'NON_VEG', 1, true],
      ['Main Course', 'Veg Biryani', 'Fragrant basmati rice', 260, 5, 'VEG', 2, true],
      ['Beverages', 'Cold Coffee', 'Iced blended coffee', 140, 12, 'VEG', 0, false],
      ['Beverages', 'Fresh Lime Soda', 'Sweet & salty', 90, 12, 'VEG', 0, false],
      ['Desserts', 'Gulab Jamun', 'Warm syrup-soaked', 120, 5, 'VEG', 0, false],
    ];
    for (const [cat, name, desc, price, tax, type, spicy, best] of items) {
      // eslint-disable-next-line no-await-in-loop
      await q(
        `INSERT INTO menu_items (tenant_id, category_id, name, description, price, tax_rate, food_type, spicy_level, is_bestseller)
         SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9
         WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE tenant_id = $1 AND lower(name) = lower($3) AND deleted_at IS NULL)`,
        [tenantId, catIds[cat], name, desc, price, tax, type, spicy, best],
      );
    }

    // ── A demo coupon ──
    await q(
      `INSERT INTO coupons (tenant_id, code, description, type, value, min_order_amount, max_discount, is_active)
       SELECT $1,'WELCOME10','10% off your first order','PERCENTAGE',10,199,100,true
       WHERE NOT EXISTS (SELECT 1 FROM coupons WHERE tenant_id = $1 AND code = 'WELCOME10' AND deleted_at IS NULL)`,
      [tenantId],
    );
  });

  logger.info('✅ Seed complete.');
  logger.info(`   Super Admin : superadmin@restrosaas.com / ${DEMO_PASSWORD}`);
  logger.info(`   Restaurant  : owner@demo.com (slug: demo-cafe) / ${DEMO_PASSWORD}`);
  logger.info(`   Kitchen     : kitchen@demo.com / ${DEMO_PASSWORD}`);
  logger.info(`   Waiter      : waiter@demo.com / ${DEMO_PASSWORD}`);
}

seed()
  .catch((err) => {
    logger.error({ err }, 'Seed failed');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
