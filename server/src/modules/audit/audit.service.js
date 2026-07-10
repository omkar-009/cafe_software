/**
 * Audit service — records every important action with full actor + client
 * context. Designed to be called from any module's service layer.
 *
 * Writes are best-effort and never block or fail the main request: a logging
 * error is swallowed (and logged) rather than surfaced to the user.
 */
import { query } from '../../config/database.js';
import logger from '../../config/logger.js';

/**
 * @param {object} params
 * @param {string|null} params.tenantId
 * @param {string} params.module      one of AUDIT_MODULE
 * @param {string} params.action      CREATE | UPDATE | DELETE | LOGIN | ...
 * @param {string} [params.recordId]
 * @param {string} [params.description]
 * @param {object} [params.oldValues]
 * @param {object} [params.newValues]
 * @param {object} [params.actor]     { id, role, name }
 * @param {object} [params.client]    { ip, device, browser, os } (req.clientCtx)
 * @param {(text,params)=>Promise} [params.q]  optional transactional query fn
 */
export async function recordAudit({
  tenantId = null,
  module,
  action,
  recordId = null,
  description = null,
  oldValues = null,
  newValues = null,
  actor = {},
  client = {},
  q = query,
}) {
  try {
    await q(
      `INSERT INTO audit_logs
        (tenant_id, module, action, record_id, description, old_values, new_values,
         actor_id, actor_role, actor_name, ip_address, device, browser, operating_system,
         created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$8)`,
      [
        tenantId,
        module,
        action,
        recordId,
        description,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        actor.id ?? null,
        actor.role ?? null,
        actor.name ?? null,
        client.ip ?? null,
        client.device ?? null,
        client.browser ?? null,
        client.os ?? null,
      ],
    );
  } catch (err) {
    logger.error({ err, module, action }, 'Failed to write audit log');
  }
}

/** Convenience wrapper that pulls actor + client context straight from req. */
export function auditFromRequest(req, payload) {
  return recordAudit({
    tenantId: payload.tenantId ?? req.tenantId ?? null,
    actor: req.user
      ? { id: req.user.id, role: req.user.role, name: req.user.fullName }
      : {},
    client: req.clientCtx || {},
    ...payload,
  });
}
