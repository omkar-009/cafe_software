import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Users, LogOut, Utensils, CreditCard, Download, Clock, User, IndianRupee, CircleDollarSign, CheckCircle2,
} from 'lucide-react';
import api, { request } from '@/lib/api';
import { money } from '@/lib/cn';
import { useAuth } from '@/store/auth';
import { useSocketEvents, playBeep } from '@/hooks/useSocketEvents';
import { rangeFor } from '@/lib/dateRange';
import { Button, Badge, EmptyState, Spinner } from '@/components/ui';
import ThemeToggle from '@/components/ThemeToggle';
import DateFilter from '@/components/DateFilter';
import ProfileModal from '@/components/ProfileModal';
import CheckInOutButton from '@/components/CheckInOutButton';
import NotificationBell from '@/components/admin/NotificationBell';

const TABS = [
  { key: 'active', label: 'Active', match: (o) => ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELAYED'].includes(o.status) },
  { key: 'ready', label: 'Ready to serve', match: (o) => o.status === 'READY' },
  { key: 'payment', label: 'Payment pending', match: (o) => o.status === 'SERVED' && o.payment_status !== 'PAID' },
  { key: 'paid', label: 'Paid', match: (o) => o.payment_status === 'PAID' },
  { key: 'all', label: 'All', match: () => true },
];
const STATUS_TONE = {
  PENDING: 'amber', ACCEPTED: 'blue', PREPARING: 'brand', READY: 'green', SERVED: 'purple',
  COMPLETED: 'green', CANCELLED: 'red', REJECTED: 'red', DELAYED: 'red',
};
const minsAgo = (t) => Math.max(0, Math.floor((Date.now() - new Date(t)) / 60000));

export default function WaiterPanel() {
  const qc = useQueryClient();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('active');
  const [preset, setPreset] = useState('today');
  const [custom, setCustom] = useState({});
  const [profile, setProfile] = useState(false);

  const range = rangeFor(preset, custom);
  const { data, isLoading } = useQuery({
    queryKey: ['waiter-orders', preset, custom],
    queryFn: () => request(api.get(`/orders?limit=200&from=${range.from}&to=${range.to}`)),
    refetchInterval: 15000,
  });
  useSocketEvents({
    'order:new': () => qc.invalidateQueries({ queryKey: ['waiter-orders'] }),
    'order:updated': () => qc.invalidateQueries({ queryKey: ['waiter-orders'] }),
    'notification:new': (n) => { if (n?.type === 'ORDER_READY') { playBeep(); toast(n.title, { icon: '🔔' }); } },
  });

  const serve = useMutation({
    mutationFn: (id) => request(api.post(`/orders/${id}/serve`)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['waiter-orders'] }); toast.success('Served'); },
    onError: (e) => toast.error(e.message),
  });
  const pay = useMutation({
    mutationFn: (id) => request(api.post(`/billing/orders/${id}/pay`, { method: 'CASH' })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['waiter-orders'] }); toast.success('Payment done'); },
    onError: (e) => toast.error(e.message),
  });

  const all = data?.orders || [];
  const orders = useMemo(() => all.filter(TABS.find((t) => t.key === tab).match), [all, tab]);

  // Mini dashboard stats for the selected range (follows the date filter).
  const ACTIVE = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELAYED'];
  const stats = useMemo(() => ({
    total: all.length,
    pending: all.filter((o) => ACTIVE.includes(o.status)).length,
    served: all.filter((o) => o.served_at || ['SERVED', 'COMPLETED'].includes(o.status)).length,
    pendingPay: all.filter((o) => o.status !== 'CANCELLED' && o.payment_status !== 'PAID').length,
    collected: all.filter((o) => o.payment_status === 'PAID').reduce((s, o) => s + Number(o.total_amount), 0),
  }), [all]);
  const isToday = preset === 'today';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500"><Users className="h-5 w-5 text-white" /></div>
          <div><h1 className="font-extrabold leading-none">Waiter</h1><p className="text-xs text-zinc-500">{user?.fullName}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <CheckInOutButton />
          <DateFilter value={preset} onChange={setPreset} custom={custom} onCustomChange={setCustom} />
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={() => setProfile(true)}><User className="h-5 w-5" /></Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={logout}><LogOut className="h-5 w-5" /></Button>
        </div>
      </header>

      {/* Mini dashboard — reflects the selected date range */}
      <div className="px-4 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{isToday ? "Today's stats" : 'Stats for selected range'}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Users} label={isToday ? 'New today' : 'Orders'} value={stats.total} tone="text-blue-500" />
          <Stat icon={Clock} label="Pending" value={stats.pending} tone="text-amber-500" />
          <Stat icon={CheckCircle2} label="Served" value={stats.served} tone="text-purple-500" />
          <Stat icon={IndianRupee} label="Collected" value={money(stats.collected)} tone="text-emerald-500" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {TABS.map((t) => {
          const cnt = all.filter(t.match).length;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t.key ? 'bg-brand-500 text-white' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'}`}>
              {t.label} {cnt > 0 && <span className={`ml-1 rounded-full px-1.5 text-xs ${tab === t.key ? 'bg-white/25' : 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'}`}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      {isLoading ? <div className="grid place-items-center py-32"><Spinner className="h-8 w-8" /></div>
        : orders.length === 0 ? <EmptyState icon={Utensils} title="Nothing here" description="Orders appear as they progress." />
          : (
            <div className="space-y-2 p-4 pt-0">
              {orders.map((o) => (
                <div key={o.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3 sm:w-52 sm:shrink-0">
                    <div>
                      <p className="font-bold">{o.order_number}</p>
                      <p className="text-sm text-zinc-500">{o.table_number ? `Table ${o.table_number}` : o.order_type}</p>
                    </div>
                    <span className="ml-auto flex items-center gap-1 text-sm text-zinc-400 sm:ml-0"><Clock className="h-3.5 w-3.5" />{minsAgo(o.created_at)}m</span>
                  </div>
                  <div className="flex-1 text-sm text-zinc-500">{o.item_count} items · <b className="text-zinc-800 dark:text-zinc-200">{money(o.total_amount)}</b></div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
                    <Badge tone={o.payment_status === 'PAID' ? 'green' : 'gray'}>{o.payment_status}</Badge>
                    {o.status === 'READY' && <Button size="sm" onClick={() => serve.mutate(o.id)} disabled={serve.isPending}><Utensils className="h-4 w-4" /> Serve</Button>}
                    {o.status === 'SERVED' && o.payment_status !== 'PAID' && <Button size="sm" onClick={() => pay.mutate(o.id)} disabled={pay.isPending}><CreditCard className="h-4 w-4" /> Payment</Button>}
                    <Button variant="outline" size="icon" onClick={() => window.open(`/api/v1/billing/orders/${o.id}/invoice.pdf`, '_blank')}><Download className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}

      <ProfileModal open={profile} onClose={() => setProfile(false)} />
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <Icon className={`h-6 w-6 ${tone}`} />
      <div><p className="text-xs text-zinc-500">{label}</p><p className="text-lg font-bold">{value}</p></div>
    </div>
  );
}
