import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, IndianRupee, Package, Wallet, Download, PieChart, Trophy,
} from 'lucide-react';
import api, { request, apiUrl } from '@/lib/api';
import { money } from '@/lib/cn';
import { rangeFor } from '@/lib/dateRange';
import { Card, Button, EmptyState, Skeleton } from '@/components/ui';
import StatCard from '@/components/admin/StatCard';
import DateFilter from '@/components/DateFilter';

const CAT_COLORS = {
  INGREDIENTS: '#1baf7a', SALARIES: '#2a78d6', RENT: '#4a3aa7', UTILITIES: '#eda100',
  MARKETING: '#f97316', MAINTENANCE: '#898781', EQUIPMENT: '#3987e5', PACKAGING: '#008300',
  TAXES: '#e34948', OTHER: '#898781',
};

export default function FinancePage() {
  const [preset, setPreset] = useState('1m');
  const [custom, setCustom] = useState({});
  const range = rangeFor(preset, custom);
  const qs = `from=${range.from}&to=${range.to}`;

  const { data: pnlData, isLoading } = useQuery({ queryKey: ['pnl', range.from, range.to], queryFn: () => request(api.get(`/finance/pnl?${qs}`)) });
  const { data: prodData } = useQuery({ queryKey: ['product-profit', range.from, range.to], queryFn: () => request(api.get(`/finance/product-profit?${qs}`)) });

  const p = pnlData?.pnl;
  const products = (prodData?.products || []).slice().sort((a, b) => b.profit - a.profit);
  const exportProfit = (fmt) => window.open(apiUrl(`/api/v1/finance/product-profit/export?${qs}&format=${fmt}`), '_blank');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold">Profit &amp; Loss</h2><p className="text-sm text-zinc-500">Revenue, cost of goods, expenses &amp; profit</p></div>
        <DateFilter value={preset} onChange={setPreset} custom={custom} onCustomChange={setCustom} />
      </div>

      {isLoading || !p ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
          <Skeleton className="h-72 rounded-2xl" />
        </>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Net Sales" value={money(p.netSales)} icon={IndianRupee} tone="blue" sub={`${p.ordersCount} orders`} />
            <StatCard label="COGS" value={money(p.cogs)} icon={Package} tone="amber" sub="cost of goods" />
            <StatCard label="Gross Profit" value={money(p.grossProfit)} icon={TrendingUp} tone="green" sub={`${p.grossMargin}% margin`} />
            <StatCard label="Expenses" value={money(p.expensesTotal)} icon={Wallet} tone="red" sub="operating" />
            <StatCard label="Net Profit" value={money(p.netProfit)} icon={p.netProfit >= 0 ? TrendingUp : TrendingDown} tone={p.netProfit >= 0 ? 'green' : 'red'} sub={`${p.netMargin}% margin`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* P&L statement */}
            <Card>
              <h3 className="mb-4 font-bold">P&amp;L statement</h3>
              <div className="space-y-1 text-sm">
                <Line label="Net Sales" value={p.netSales} />
                <Line label="− Cost of Goods Sold" value={-p.cogs} muted />
                <Divider />
                <Line label="Gross Profit" value={p.grossProfit} bold sub={`${p.grossMargin}%`} tone={p.grossProfit >= 0 ? 'green' : 'red'} />
                <Line label="− Operating Expenses" value={-p.expensesTotal} muted />
                <Divider />
                <Line label="Net Profit" value={p.netProfit} bold big sub={`${p.netMargin}%`} tone={p.netProfit >= 0 ? 'green' : 'red'} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-3 text-center text-xs text-zinc-500">
                <div><p className="font-bold text-zinc-800 dark:text-zinc-200">{money(p.taxCollected)}</p>tax collected</div>
                <div><p className="font-bold text-zinc-800 dark:text-zinc-200">{money(p.discounts)}</p>discounts given</div>
                <div><p className="font-bold text-zinc-800 dark:text-zinc-200">{money(p.avgOrderValue)}</p>avg order</div>
              </div>
            </Card>

            {/* Expense breakdown */}
            <Card>
              <h3 className="mb-4 flex items-center gap-2 font-bold"><PieChart className="h-4 w-4 text-brand-500" /> Expense breakdown</h3>
              {(!p.expensesByCategory || p.expensesByCategory.length === 0) ? <EmptyState icon={Wallet} title="No expenses" description="Add expenses to see the breakdown." /> : (
                <div className="space-y-3">
                  {p.expensesByCategory.map((c) => {
                    const share = p.expensesTotal > 0 ? (c.total / p.expensesTotal) * 100 : 0;
                    return (
                      <div key={c.category}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CAT_COLORS[c.category] }} />{c.category}</span>
                          <span className="tabular-nums"><b>{money(c.total)}</b> <span className="text-zinc-400">{Math.round(share)}%</span></span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div className="h-full rounded-full" style={{ width: `${share}%`, background: CAT_COLORS[c.category] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Product profitability */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold"><Trophy className="h-4 w-4 text-amber-500" /> Product profitability</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportProfit('csv')}><Download className="h-4 w-4" /> CSV</Button>
                <Button variant="outline" size="sm" onClick={() => exportProfit('xlsx')}><Download className="h-4 w-4" /> Excel</Button>
              </div>
            </div>
            {products.length === 0 ? <EmptyState icon={Package} title="No sales in this range" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs uppercase text-zinc-500">
                    <tr><th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Revenue</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-right">Profit</th><th className="px-3 py-2 text-right">Margin</th></tr>
                  </thead>
                  <tbody>
                    {products.map((r) => (
                      <tr key={r.name} className="border-b border-zinc-100 dark:border-zinc-800/50">
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.qty}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(r.revenue)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{money(r.cost)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{money(r.profit)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.margin}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {products.some((r) => r.cost === 0) && (
                  <p className="mt-3 text-xs text-zinc-400">Tip: items showing 100% margin have no cost price set. Add cost prices in Menu to get accurate profit.</p>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Line({ label, value, bold, big, muted, sub, tone }) {
  const toneCls = tone === 'green' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'red' ? 'text-red-500' : '';
  return (
    <div className="flex items-center justify-between py-1">
      <span className={`${muted ? 'text-zinc-500' : ''} ${bold ? 'font-bold' : ''}`}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold' : ''} ${big ? 'text-lg' : ''} ${toneCls}`}>
        {money(value)}{sub && <span className="ml-1 text-xs font-normal text-zinc-400">{sub}</span>}
      </span>
    </div>
  );
}
function Divider() { return <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />; }
