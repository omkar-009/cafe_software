import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, Cell as PieCell,
} from 'recharts';
import dayjs from 'dayjs';
import {
  IndianRupee, ShoppingBag, Ban, Timer, Users, TrendingUp, Download,
} from 'lucide-react';
import api, { request } from '@/lib/api';
import { money } from '@/lib/cn';
import { useChartTokens } from '@/lib/chartTheme';
import { Card, Skeleton, EmptyState, Button } from '@/components/ui';
import StatCard from '@/components/admin/StatCard';

export default function DashboardPage() {
  const t = useChartTokens();
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => request(api.get('/analytics/dashboard')),
  });

  if (isLoading) return <DashSkeleton />;
  const k = data.kpis;
  const sym = '₹';

  const sales = data.salesTimeseries.map((r) => ({ ...r, label: dayjs(r.day).format('DD MMM') }));
  const hours = data.peakHours.map((r) => ({ hour: `${String(r.hour).padStart(2, '0')}:00`, orders: r.orders }));
  const custData = [
    { name: 'Returning', value: data.customers.returning },
    { name: 'New', value: data.customers.new },
  ];

  const exportSales = () => window.open('/api/v1/analytics/reports/sales?format=xlsx', '_blank');

  return (
    <div className="space-y-6">
      {/* Period sales */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today" value={money(data.periodSales.today, sym)} icon={IndianRupee} tone="brand" delay={0} />
        <StatCard label="This Week" value={money(data.periodSales.week, sym)} icon={TrendingUp} tone="blue" delay={0.05} />
        <StatCard label="This Month" value={money(data.periodSales.month, sym)} icon={TrendingUp} tone="green" delay={0.1} />
        <StatCard label="This Year" value={money(data.periodSales.year, sym)} icon={TrendingUp} tone="amber" delay={0.15} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Orders (30d)" value={k.totalOrders} icon={ShoppingBag} tone="brand" />
        <StatCard label="Avg Bill" value={money(k.avgBillValue, sym)} icon={IndianRupee} tone="blue" />
        <StatCard label="Cancelled" value={k.cancelledOrders} icon={Ban} tone="red" />
        <StatCard label="Avg Prep" value={`${k.avgPrepMins} min`} icon={Timer} tone="green" />
      </div>

      {/* Sales trend (single-series area, brand hue) */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold">Sales trend</h3>
            <p className="text-sm text-zinc-500">Revenue over the last 30 days</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportSales}><Download className="h-4 w-4" /> Export</Button>
        </div>
        {sales.length === 0 ? <EmptyState icon={TrendingUp} title="No sales yet" description="Data appears once you take orders." /> : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={sales} margin={{ left: -12, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.brand} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={t.brand} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: t.grid }} />
              <YAxis tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} width={56}
                tickFormatter={(v) => `${sym}${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
              <Tooltip content={<ChartTip t={t} prefix={sym} />} cursor={{ stroke: t.brand, strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area type="monotone" dataKey="revenue" stroke={t.brand} strokeWidth={2} fill="url(#revFill)" dot={false} activeDot={{ r: 5, fill: t.brand }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Peak hours (single-series bar, blue) */}
        <Card>
          <h3 className="mb-1 font-bold">Peak hours</h3>
          <p className="mb-4 text-sm text-zinc-500">Order volume by hour</p>
          {hours.length === 0 ? <EmptyState title="No data" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={hours} margin={{ left: -18, right: 8 }}>
                <CartesianGrid stroke={t.grid} vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: t.grid }} interval={2} />
                <YAxis tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                <Tooltip content={<ChartTip t={t} suffix=" orders" />} cursor={{ fill: t.blue, fillOpacity: 0.08 }} />
                <Bar dataKey="orders" fill={t.blue} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Popular dishes (single-series horizontal bar, brand) */}
        <Card>
          <h3 className="mb-1 font-bold">Popular dishes</h3>
          <p className="mb-4 text-sm text-zinc-500">Top sellers by quantity</p>
          {data.popularDishes.length === 0 ? <EmptyState title="No data" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.popularDishes.slice(0, 6)} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid stroke={t.grid} horizontal={false} />
                <XAxis type="number" tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: t.axis, fontSize: 12 }} tickLine={false} axisLine={false} width={90} />
                <Tooltip content={<ChartTip t={t} suffix=" sold" />} cursor={{ fill: t.brand, fillOpacity: 0.08 }} />
                <Bar dataKey="qty" fill={t.brand} radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Customers (2-category donut, validated blue+orange) */}
        <Card>
          <h3 className="mb-1 font-bold">Customers</h3>
          <p className="mb-4 text-sm text-zinc-500">New vs returning</p>
          {data.customers.total === 0 ? <EmptyState icon={Users} title="No customers yet" /> : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={custData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} stroke={t.surface} strokeWidth={2}>
                    <Cell fill={t.blue} /><PieCell fill={t.orange} />
                  </Pie>
                  <Tooltip content={<ChartTip t={t} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                <Legend color={t.blue} label="Returning" value={data.customers.returning} />
                <Legend color={t.orange} label="New" value={data.customers.new} />
                <Legend color={t.axis} label="Total" value={data.customers.total} />
              </div>
            </div>
          )}
        </Card>

        {/* Waiter performance */}
        <Card>
          <h3 className="mb-1 font-bold">Waiter performance</h3>
          <p className="mb-4 text-sm text-zinc-500">Orders served (30d)</p>
          {data.waiterPerformance.length === 0 ? <EmptyState title="No waiters" /> : (
            <div className="space-y-2">
              {data.waiterPerformance.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5">
                  <span className="flex items-center gap-2.5 font-medium">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-xs font-bold text-white">{w.name[0]}</span>
                    {w.name}
                  </span>
                  <span className="text-sm"><b className="tabular-nums">{w.served}</b> served · {money(w.revenue, sym)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Legend({ color, label, value }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-3 w-3 rounded-sm" style={{ background: color }} />
      <span className="text-zinc-500">{label}</span>
      <b className="tabular-nums">{value}</b>
    </div>
  );
}

function ChartTip({ active, payload, label, t, prefix = '', suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border px-3 py-2 text-sm shadow-glass" style={{ background: t.surface, borderColor: t.grid, color: t.text }}>
      {label && <p className="mb-0.5 font-semibold">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="tabular-nums">{p.name}: <b>{prefix}{typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}{suffix}</b></p>
      ))}
    </div>
  );
}

function DashSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      <Skeleton className="h-80 rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
    </div>
  );
}
