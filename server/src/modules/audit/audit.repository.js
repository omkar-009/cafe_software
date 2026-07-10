import { query } from '../../config/database.js';

const COLS = `id, tenant_id, module, action, record_id, description,
  actor_id, actor_role, actor_name, ip_address, device, browser, operating_system,
  created_at`;

function buildWhere({ tenantId, module, action, actorId, actorRole, search, from, to }) {
  const where = ['tenant_id = $1'];
  const params = [tenantId];
  const add = (frag, val) => { params.push(val); where.push(frag.replace('?', `$${params.length}`)); };
  if (module) add('module = ?', module);
  if (action) add('action = ?', action);
  if (actorId) add('actor_id = ?', actorId);
  if (actorRole) add('actor_role = ?', actorRole);
  if (from) add('created_at >= ?', from);
  if (to) add('created_at <= ?', to);
  if (search) {
    params.push(`%${search}%`);
    const i = params.length;
    where.push(`(description ILIKE $${i} OR actor_name ILIKE $${i} OR record_id::text ILIKE $${i})`);
  }
  return { whereSql: where.join(' AND '), params };
}

export async function list(filters, { limit, offset }) {
  const { whereSql, params } = buildWhere(filters);
  const total = await query(`SELECT count(*)::int AS total FROM audit_logs WHERE ${whereSql}`, params);
  const { rows } = await query(
    `SELECT ${COLS}, old_values, new_values FROM audit_logs WHERE ${whereSql}
     ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { rows, total: total.rows[0].total };
}

/** Bounded fetch for exports (hard cap to protect memory). */
export async function forExport(filters, cap = 50000) {
  const { whereSql, params } = buildWhere(filters);
  const { rows } = await query(
    `SELECT ${COLS} FROM audit_logs WHERE ${whereSql} ORDER BY created_at DESC LIMIT $${params.length + 1}`,
    [...params, cap],
  );
  return rows;
}

/** Distinct modules/actions present (drives filter dropdowns in the UI). */
export async function facets(tenantId) {
  const [modules, actions] = await Promise.all([
    query('SELECT DISTINCT module FROM audit_logs WHERE tenant_id = $1 ORDER BY module', [tenantId]),
    query('SELECT DISTINCT action FROM audit_logs WHERE tenant_id = $1 ORDER BY action', [tenantId]),
  ]);
  return { modules: modules.rows.map((r) => r.module), actions: actions.rows.map((r) => r.action) };
}
