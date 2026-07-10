import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { Users, LogOut, Utensils, CreditCard, Download, Bell, Clock } from 'lucide-react';
import api, { request } from '@/lib/api';
import { money } from '@/lib/cn';
import { useAuth } from '@/store/auth';
import { useSocketEvents, playBeep } from '@/hooks/useSocketEvents';
import { Button, Badge, EmptyState, Spinner } from '@/components/ui';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationBell from '@/components/admin/NotificationBell';

const TABS = [
  { key: 'active', label: 'Active', statuses: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELAYED'] },
  { key: 'ready', label: 'Ready to serve', statuses: ['READY'] },
  { key: 'payment', label: 'Payment pending', statuses: ['SERVED'] },
];

export default function WaiterPanel() {
  const qc = useQueryClient();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('active');

  const { data, isLoading } = useQuery({
    queryKey: ['waiter-orders'],
    queryFn: () => request(api.get('/orders?limit=100')),
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

  const active = TABS.find((t) => t.key === tab);
  const orders = (data?.orders || []).filter((o) => active.statuses.includes(o.status) && (tab !== 'payment' || o.payment_status !== 'PAID'));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500"><Users className="h-5 w-5 text-white" /></div>
          <div><h1 className="font-extrabold leading-none">Waiter</h1><p className="text-xs text-zinc-500">{user?.fullName}</p></div>
        </div>
        <div className="flex items-center gap-2"><NotificationBell /><ThemeToggle /><Button variant="ghost" size="icon" onClick={logout}><LogOut className="h-5 w-5" /></Button></div>
      </header>

      <div className="sticky top-[57px] z-10 flex gap-2 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-950/90 px-4 py-2 backdrop-blur">
        {TABS.map((t) => {
          const cnt = (data?.orders || []).filter((o) => t.statuses.includes(o.status) && (t.key !== 'payment' || o.payment_status !== 'PAID')).length;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t.key ? 'bg-brand-500 text-white' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'}`}>
              {t.label} {cnt > 0 && <span className={`ml-1 rounded-full px-1.5 text-xs ${tab === t.key ? 'bg-white/25' : 'bg-brand-100 text-brand-700'}`}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      {isLoading ? <div className="grid place-items-center py-32"><Spinner className="h-8 w-8" /></div>
        : orders.length === 0 ? <EmptyState icon={Bell} title="Nothing here" description="Orders will appear as they progress." />
          : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {orders.map((o) => (
                <div key={o.id} className="card">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{o.order_number}</span>
                    <Badge tone={o.status === 'READY' ? 'green' : o.status === 'SERVED' ? 'purple' : 'amber'}>{o.status}</Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm text-zinc-500">
                    <span>{o.table_number ? `Table ${o.table_number}` : o.order_type}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{dayjs(o.created_at).format('HH:mm')}</span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">{o.item_count} items</p>
                  <p className="text-lg font-bold">{money(o.total_amount)}</p>
                  <div className="mt-3 flex gap-2">
                    {o.status === 'READY' && <Button size="sm" className="flex-1" onClick={() => serve.mutate(o.id)} loading={serve.isPending}><Utensils className="h-4 w-4" /> Serve</Button>}
                    {o.status === 'SERVED' && o.payment_status !== 'PAID' && <Button size="sm" className="flex-1" onClick={() => pay.mutate(o.id)} loading={pay.isPending}><CreditCard className="h-4 w-4" /> Take Payment</Button>}
                    <Button variant="outline" size="sm" onClick={() => window.open(`/api/v1/billing/orders/${o.id}/invoice.pdf`, '_blank')}><Download className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
    </div>
  );
}
