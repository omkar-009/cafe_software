import { query } from '../../config/database.js';
import { buildUpdate, mapKeysToSnake } from '../../shared/sqlUpdate.js';

const ITEM_COLS = `id, tenant_id, category_id, name, description, price, tax_rate, food_type,
  spicy_level, prep_time_mins, ingredients, calories, is_available, is_out_of_stock,
  is_recommended, is_bestseller, sort_order, created_at, updated_at`;

/* ── Reads ── */

export async function list({ tenantId, categoryId, search, foodType, availableOnly, limit, offset }) {
  const where = ['m.tenant_id = $1', 'm.deleted_at IS NULL'];
  const params = [tenantId];
  if (categoryId) {
    params.push(categoryId);
    where.push(`m.category_id = $${params.length}`);
  }
  if (foodType) {
    params.push(foodType);
    where.push(`m.food_type = $${params.length}`);
  }
  if (availableOnly) {
    where.push('m.is_available = true AND m.is_out_of_stock = false');
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(m.name ILIKE $${params.length} OR m.description ILIKE $${params.length})`);
  }
  const whereSql = where.join(' AND ');

  const total = await query(`SELECT count(*)::int AS total FROM menu_items m WHERE ${whereSql}`, params);
  const { rows } = await query(
    `SELECT m.id, m.tenant_id, m.category_id, c.name AS category_name, m.name, m.description,
            m.price, m.tax_rate, m.food_type, m.spicy_level, m.prep_time_mins,
            m.is_available, m.is_out_of_stock, m.is_recommended, m.is_bestseller, m.sort_order,
            m.created_at,
            (SELECT url FROM menu_item_images i WHERE i.menu_item_id = m.id ORDER BY i.is_primary DESC, i.sort_order LIMIT 1) AS image_url
       FROM menu_items m
       LEFT JOIN categories c ON c.id = m.category_id
      WHERE ${whereSql}
      ORDER BY m.sort_order ASC, m.name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { rows, total: total.rows[0].total };
}

export async function findBaseById({ tenantId, id, q = query }) {
  const { rows } = await q(
    `SELECT ${ITEM_COLS} FROM menu_items WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return rows[0] || null;
}

/** Assemble a full item with its variants, add-on groups/options and images. */
export async function findFullById({ tenantId, id }) {
  const item = await findBaseById({ tenantId, id });
  if (!item) return null;
  const [variants, groups, images] = await Promise.all([
    query('SELECT id, name, price_delta, is_default, sort_order FROM menu_variants WHERE menu_item_id = $1 ORDER BY sort_order', [id]),
    query('SELECT id, name, min_select, max_select, is_required, sort_order FROM addon_groups WHERE menu_item_id = $1 ORDER BY sort_order', [id]),
    query('SELECT id, url, is_primary, sort_order FROM menu_item_images WHERE menu_item_id = $1 ORDER BY is_primary DESC, sort_order', [id]),
  ]);
  const groupIds = groups.rows.map((g) => g.id);
  let options = { rows: [] };
  if (groupIds.length) {
    options = await query(
      'SELECT id, group_id, name, price, is_available, sort_order FROM addon_options WHERE group_id = ANY($1::uuid[]) ORDER BY sort_order',
      [groupIds],
    );
  }
  return {
    ...item,
    variants: variants.rows,
    images: images.rows,
    addonGroups: groups.rows.map((g) => ({
      ...g,
      options: options.rows.filter((o) => o.group_id === g.id),
    })),
  };
}

/* ── Writes (transactional; caller passes a bound query fn `q`) ── */

export async function insertItem({ tenantId, data, actorId, q }) {
  const { rows } = await q(
    `INSERT INTO menu_items
      (tenant_id, category_id, name, description, price, tax_rate, food_type, spicy_level,
       prep_time_mins, ingredients, calories, is_available, is_recommended, is_bestseller, sort_order, created_by)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,0),COALESCE($7,'VEG'),COALESCE($8,0),
             COALESCE($9,15),$10,$11,COALESCE($12,true),COALESCE($13,false),COALESCE($14,false),COALESCE($15,0),$16)
     RETURNING ${ITEM_COLS}`,
    [
      tenantId, data.categoryId || null, data.name, data.description || null, data.price,
      data.taxRate, data.foodType, data.spicyLevel, data.prepTimeMins,
      data.ingredients || null, data.calories || null, data.isAvailable,
      data.isRecommended, data.isBestseller, data.sortOrder, actorId,
    ],
  );
  return rows[0];
}

export async function replaceVariants({ tenantId, itemId, variants, q }) {
  await q('DELETE FROM menu_variants WHERE menu_item_id = $1', [itemId]);
  for (const [i, v] of (variants || []).entries()) {
    // eslint-disable-next-line no-await-in-loop
    await q(
      `INSERT INTO menu_variants (tenant_id, menu_item_id, name, price_delta, is_default, sort_order)
       VALUES ($1,$2,$3,COALESCE($4,0),COALESCE($5,false),$6)`,
      [tenantId, itemId, v.name, v.priceDelta, v.isDefault, v.sortOrder ?? i],
    );
  }
}

export async function replaceImages({ tenantId, itemId, images, q }) {
  await q('DELETE FROM menu_item_images WHERE menu_item_id = $1', [itemId]);
  for (const [i, img] of (images || []).entries()) {
    // eslint-disable-next-line no-await-in-loop
    await q(
      `INSERT INTO menu_item_images (tenant_id, menu_item_id, url, is_primary, sort_order)
       VALUES ($1,$2,$3,COALESCE($4,false),$5)`,
      [tenantId, itemId, img.url, img.isPrimary ?? i === 0, img.sortOrder ?? i],
    );
  }
}

export async function replaceAddonGroups({ tenantId, itemId, addonGroups, q }) {
  await q('DELETE FROM addon_groups WHERE menu_item_id = $1', [itemId]); // cascades options
  for (const [i, g] of (addonGroups || []).entries()) {
    // eslint-disable-next-line no-await-in-loop
    const res = await q(
      `INSERT INTO addon_groups (tenant_id, menu_item_id, name, min_select, max_select, is_required, sort_order)
       VALUES ($1,$2,$3,COALESCE($4,0),COALESCE($5,1),COALESCE($6,false),$7) RETURNING id`,
      [tenantId, itemId, g.name, g.minSelect, g.maxSelect, g.isRequired, g.sortOrder ?? i],
    );
    const groupId = res.rows[0].id;
    for (const [j, o] of (g.options || []).entries()) {
      // eslint-disable-next-line no-await-in-loop
      await q(
        `INSERT INTO addon_options (tenant_id, group_id, name, price, is_available, sort_order)
         VALUES ($1,$2,$3,COALESCE($4,0),COALESCE($5,true),$6)`,
        [tenantId, groupId, o.name, o.price, o.isAvailable, o.sortOrder ?? j],
      );
    }
  }
}

const UPDATABLE = [
  'category_id', 'name', 'description', 'price', 'tax_rate', 'food_type', 'spicy_level',
  'prep_time_mins', 'ingredients', 'calories', 'is_available', 'is_out_of_stock',
  'is_recommended', 'is_bestseller', 'sort_order',
];

export async function updateItem({ tenantId, id, data, actorId, q = query }) {
  const { setSql, params, nextIndex, hasChanges } = buildUpdate(mapKeysToSnake(data), UPDATABLE, 1);
  if (!hasChanges) return findBaseById({ tenantId, id, q });
  const { rows } = await q(
    `UPDATE menu_items SET ${setSql}, updated_by = $${nextIndex}
     WHERE id = $${nextIndex + 1} AND tenant_id = $${nextIndex + 2} AND deleted_at IS NULL
     RETURNING ${ITEM_COLS}`,
    [...params, actorId, id, tenantId],
  );
  return rows[0] || null;
}

export async function softDelete({ tenantId, id, actorId }) {
  const { rowCount } = await query(
    `UPDATE menu_items SET deleted_at = now(), deleted_by = $1
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
    [actorId, id, tenantId],
  );
  return rowCount > 0;
}
