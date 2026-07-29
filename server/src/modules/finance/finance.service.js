import ApiError from '../../shared/ApiError.js';
import { AUDIT_MODULE } from '../../shared/constants.js';
import { auditFromRequest } from '../audit/audit.service.js';
import * as expenses from './expenses.repository.js';
import * as fin from './finance.repository.js';

/* ── Expenses CRUD ── */

export async function listExpenses(params, pagination) {
  return expenses.list(params, pagination);
}

export async function createExpense(req) {
  const exp = await expenses.create({ tenantId: req.tenantId, data: req.body, actorId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.EXPENSE, action: 'CREATE', recordId: exp.id,
    description: `Added expense "${exp.title}" (${exp.category}) ₹${exp.amount}`,
    newValues: { category: exp.category, amount: exp.amount },
  });
  return exp;
}

export async function updateExpense(req) {
  const before = await expenses.findById({ tenantId: req.tenantId, id: req.params.id });
  if (!before) throw ApiError.notFound('Expense not found');
  const exp = await expenses.update({ tenantId: req.tenantId, id: req.params.id, data: req.body, actorId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.EXPENSE, action: 'UPDATE', recordId: exp.id,
    description: `Updated expense "${exp.title}"`,
    oldValues: { amount: before.amount, category: before.category },
    newValues: { amount: exp.amount, category: exp.category },
  });
  return exp;
}

export async function deleteExpense(req) {
  const before = await expenses.findById({ tenantId: req.tenantId, id: req.params.id });
  if (!before) throw ApiError.notFound('Expense not found');
  await expenses.softDelete({ tenantId: req.tenantId, id: req.params.id, actorId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.EXPENSE, action: 'DELETE', recordId: before.id,
    description: `Deleted expense "${before.title}" (₹${before.amount})`,
  });
}

export function expenseSummary({ tenantId, from, to }) {
  return expenses.summaryByCategory({ tenantId, from, to });
}

/* ── Profit & Loss ── */

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/**
 * @param {object} p
 * @param {string} p.tenantId
 * @param {Date}   p.from  order/expense window start
 * @param {Date}   p.to    window end
 * @param {string} p.expFrom  expense_date lower bound (YYYY-MM-DD)
 * @param {string} p.expTo    expense_date upper bound
 */
export async function profitAndLoss({ tenantId, from, to, expFrom, expTo }) {
  const [sales, cogs, expensesTotal, byCategory] = await Promise.all([
    fin.salesTotals({ tenantId, from, to }),
    fin.cogsTotal({ tenantId, from, to }),
    expenses.totalForRange({ tenantId, from: expFrom, to: expTo }),
    expenses.summaryByCategory({ tenantId, from: expFrom, to: expTo }),
  ]);

  const netSales = sales.net_sales;
  const grossProfit = netSales - cogs;
  const netProfit = grossProfit - expensesTotal;

  return {
    netSales,
    taxCollected: sales.tax_collected,
    serviceCharge: sales.service_charge,
    discounts: sales.discounts,
    totalCollected: sales.total_collected,
    ordersCount: sales.orders_count,
    cogs,
    grossProfit,
    grossMargin: pct(grossProfit, netSales),
    expensesTotal,
    expensesByCategory: byCategory,
    netProfit,
    netMargin: pct(netProfit, netSales),
    avgOrderValue: sales.orders_count > 0 ? Math.round((netSales / sales.orders_count) * 100) / 100 : 0,
  };
}

export async function productProfitability({ tenantId, from, to }) {
  const rows = await fin.productProfitability({ tenantId, from, to });
  return rows.map((r) => {
    const profit = r.revenue - r.cost;
    return { ...r, profit, margin: pct(profit, r.revenue) };
  });
}

export async function pnlTrend({ tenantId, from, to }) {
  const rows = await fin.dailyPnl({ tenantId, from, to });
  return rows.map((r) => ({
    day: r.day,
    netSales: r.net_sales,
    cogs: r.cogs,
    profit: r.net_sales - r.cogs,
    orders: r.orders,
  }));
}
