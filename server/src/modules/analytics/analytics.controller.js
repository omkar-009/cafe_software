import catchAsync from '../../shared/catchAsync.js';
import { ok } from '../../shared/ApiResponse.js';
import { sendExport } from '../../shared/export.js';
import * as service from './analytics.service.js';

export const dashboard = catchAsync(async (req, res) => {
  const data = await service.dashboard({
    tenantId: req.tenantId,
    from: req.query.from,
    to: req.query.to,
  });
  return ok(res, data);
});

export const exportSales = catchAsync(async (req, res) => {
  const rows = await service.salesReportRows({
    tenantId: req.tenantId,
    from: req.query.from,
    to: req.query.to,
  });
  return sendExport(res, {
    format: req.query.format === 'xlsx' ? 'xlsx' : 'csv',
    filename: `sales-report-${new Date().toISOString().slice(0, 10)}`,
    sheetName: 'Sales',
    columns: [
      { header: 'Date', key: 'day', width: 16 },
      { header: 'Orders', key: 'orders' },
      { header: 'Revenue', key: 'revenue' },
    ],
    rows,
  });
});
