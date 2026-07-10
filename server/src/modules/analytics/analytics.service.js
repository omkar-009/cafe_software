import dayjs from 'dayjs';
import * as repo from './analytics.repository.js';

/** Resolve a [from, to] window from query params (defaults to last 30 days). */
export function resolveRange({ from, to } = {}) {
  const end = to ? dayjs(to) : dayjs();
  const start = from ? dayjs(from) : end.subtract(30, 'day');
  return { from: start.startOf('day').toDate(), to: end.endOf('day').toDate() };
}

/** Full dashboard payload assembled in parallel. */
export async function dashboard({ tenantId, from, to }) {
  const range = resolveRange({ from, to });
  const [
    summary, periods, timeseries, peak, dishes, prep, waiters, customers,
  ] = await Promise.all([
    repo.summary({ tenantId, ...range }),
    repo.periodSales({ tenantId }),
    repo.salesTimeseries({ tenantId, ...range }),
    repo.peakHours({ tenantId, ...range }),
    repo.popularDishes({ tenantId, ...range, limit: 10 }),
    repo.avgPrepTime({ tenantId, ...range }),
    repo.waiterPerformance({ tenantId, ...range }),
    repo.customerBreakdown({ tenantId }),
  ]);

  return {
    range,
    kpis: {
      totalOrders: Number(summary.total_orders),
      completedOrders: Number(summary.completed_orders),
      cancelledOrders: Number(summary.cancelled_orders),
      revenue: Number(summary.revenue),
      avgBillValue: Number(summary.avg_bill_value),
      customers: Number(summary.customers),
      avgPrepMins: Math.round(prep * 10) / 10,
    },
    periodSales: {
      today: Number(periods.today),
      week: Number(periods.week),
      month: Number(periods.month),
      year: Number(periods.year),
    },
    salesTimeseries: timeseries.map((r) => ({ day: r.day, orders: Number(r.orders), revenue: Number(r.revenue) })),
    peakHours: peak.map((r) => ({ hour: r.hour, orders: Number(r.orders) })),
    popularDishes: dishes.map((r) => ({ name: r.name, qty: Number(r.qty), revenue: Number(r.revenue) })),
    waiterPerformance: waiters.map((r) => ({ id: r.id, name: r.name, served: Number(r.served), revenue: Number(r.revenue) })),
    customers: { total: customers.total, returning: customers.returning, new: customers.total - customers.returning },
  };
}

export async function salesReportRows({ tenantId, from, to }) {
  const range = resolveRange({ from, to });
  const ts = await repo.salesTimeseries({ tenantId, ...range });
  return ts.map((r) => ({
    day: dayjs(r.day).format('YYYY-MM-DD'),
    orders: Number(r.orders),
    revenue: Number(r.revenue),
  }));
}
