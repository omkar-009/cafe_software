import dayjs from 'dayjs';
import catchAsync from '../../shared/catchAsync.js';
import { ok, created, noContent } from '../../shared/ApiResponse.js';
import { parseOffsetPagination, buildOffsetMeta } from '../../shared/pagination.js';
import { sendExport } from '../../shared/export.js';
import * as service from './finance.service.js';

/** Resolve a report window (ISO for orders, YYYY-MM-DD for expenses). Defaults to this month. */
function resolveRange(query) {
  const from = query.from ? dayjs(query.from) : dayjs().startOf('month');
  const to = query.to ? dayjs(query.to) : dayjs();
  return {
    from: from.toDate(),
    to: to.toDate(),
    expFrom: from.format('YYYY-MM-DD'),
    expTo: to.format('YYYY-MM-DD'),
  };
}

/* ── Expenses ── */
export const listExpenses = catchAsync(async (req, res) => {
  const { limit, offset, page } = parseOffsetPagination(req.query);
  const { rows, total, totalAmount } = await service.listExpenses(
    { tenantId: req.tenantId, category: req.query.category, search: req.query.search, from: req.query.from, to: req.query.to },
    { limit, offset },
  );
  return ok(res, { expenses: rows, totalAmount }, { meta: buildOffsetMeta({ page, limit, total }) });
});

export const createExpense = catchAsync(async (req, res) => {
  const expense = await service.createExpense(req);
  return created(res, { expense }, { message: 'Expense added' });
});

export const updateExpense = catchAsync(async (req, res) => {
  const expense = await service.updateExpense(req);
  return ok(res, { expense }, { message: 'Expense updated' });
});

export const removeExpense = catchAsync(async (req, res) => {
  await service.deleteExpense(req);
  return noContent(res);
});

export const exportExpenses = catchAsync(async (req, res) => {
  const { rows } = await service.listExpenses(
    { tenantId: req.tenantId, category: req.query.category, from: req.query.from, to: req.query.to },
    { limit: 10000, offset: 0 },
  );
  return sendExport(res, {
    format: req.query.format === 'xlsx' ? 'xlsx' : 'csv',
    filename: `expenses-${dayjs().format('YYYY-MM-DD')}`,
    sheetName: 'Expenses',
    columns: [
      { header: 'Date', key: 'expense_date' }, { header: 'Category', key: 'category' },
      { header: 'Title', key: 'title' }, { header: 'Vendor', key: 'vendor' },
      { header: 'Amount', key: 'amount' }, { header: 'Payment', key: 'payment_method' },
      { header: 'Note', key: 'note' },
    ],
    rows,
  });
});

/* ── Profit & Loss ── */
export const pnl = catchAsync(async (req, res) => {
  const { from, to, expFrom, expTo } = resolveRange(req.query);
  const report = await service.profitAndLoss({ tenantId: req.tenantId, from, to, expFrom, expTo });
  return ok(res, { pnl: report, range: { from, to } });
});

export const pnlTrend = catchAsync(async (req, res) => {
  const { from, to } = resolveRange(req.query);
  const trend = await service.pnlTrend({ tenantId: req.tenantId, from, to });
  return ok(res, { trend });
});

export const productProfit = catchAsync(async (req, res) => {
  const { from, to } = resolveRange(req.query);
  const products = await service.productProfitability({ tenantId: req.tenantId, from, to });
  return ok(res, { products });
});

export const exportProductProfit = catchAsync(async (req, res) => {
  const { from, to } = resolveRange(req.query);
  const products = await service.productProfitability({ tenantId: req.tenantId, from, to });
  return sendExport(res, {
    format: req.query.format === 'xlsx' ? 'xlsx' : 'csv',
    filename: `product-profit-${dayjs().format('YYYY-MM-DD')}`,
    sheetName: 'Product profit',
    columns: [
      { header: 'Product', key: 'name' }, { header: 'Qty sold', key: 'qty' },
      { header: 'Revenue', key: 'revenue' }, { header: 'Cost', key: 'cost' },
      { header: 'Profit', key: 'profit' }, { header: 'Margin %', key: 'margin' },
    ],
    rows: products,
  });
});
