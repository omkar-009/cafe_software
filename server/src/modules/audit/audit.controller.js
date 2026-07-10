import catchAsync from '../../shared/catchAsync.js';
import { ok } from '../../shared/ApiResponse.js';
import { parseOffsetPagination, buildOffsetMeta } from '../../shared/pagination.js';
import { sendExport } from '../../shared/export.js';
import * as repo from './audit.repository.js';

function filtersFrom(req) {
  return {
    tenantId: req.tenantId,
    module: req.query.module,
    action: req.query.action,
    actorId: req.query.actorId,
    actorRole: req.query.actorRole,
    search: req.query.search,
    from: req.query.from,
    to: req.query.to,
  };
}

export const list = catchAsync(async (req, res) => {
  const { limit, offset, page } = parseOffsetPagination(req.query);
  const { rows, total } = await repo.list(filtersFrom(req), { limit, offset });
  return ok(res, { logs: rows }, { meta: buildOffsetMeta({ page, limit, total }) });
});

export const facets = catchAsync(async (req, res) => {
  const data = await repo.facets(req.tenantId);
  return ok(res, data);
});

export const exportLogs = catchAsync(async (req, res) => {
  const rows = await repo.forExport(filtersFrom(req));
  const columns = [
    { header: 'Timestamp', key: 'created_at', width: 24 },
    { header: 'Module', key: 'module' },
    { header: 'Action', key: 'action' },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Employee', key: 'actor_name' },
    { header: 'Role', key: 'actor_role' },
    { header: 'IP', key: 'ip_address' },
    { header: 'Device', key: 'device' },
    { header: 'Browser', key: 'browser' },
    { header: 'OS', key: 'operating_system' },
  ];
  return sendExport(res, {
    format: req.query.format === 'xlsx' ? 'xlsx' : 'csv',
    filename: `audit-logs-${new Date().toISOString().slice(0, 10)}`,
    sheetName: 'Audit Logs',
    columns,
    rows,
  });
});
