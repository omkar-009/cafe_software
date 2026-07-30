import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Maximize, Volume2, VolumeX, LogOut, ChefHat, ArrowDownUp, User, Clock,
} from 'lucide-react';
import api, { request } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useSocketEvents, playBeep } from '@/hooks/useSocketEvents';
import { rangeFor } from '@/lib/dateRange';
import { Button, EmptyState, Spinner, Badge } from '@/components/ui';
import ThemeToggle from '@/components/ThemeToggle';
import CheckInOutButton from '@/components/CheckInOutButton';
import DateFilter from '@/components/DateFilter';
import ProfileModal from '@/components/ProfileModal';

const STATUS_TONE = {
  PENDING: 'amber', ACCEPTED: 'blue', PREPARING: 'brand', READY: 'green',
  DELAYED: 'red', SERVED: 'purple', COMPLETED: 'green', CANCELLED: 'red', REJECTED: 'red',
};
const BORDER = {
  PENDING: 'border-l-amber-500', ACCEPTED: 'border-l-blue-500', PREPARING: 'border-l-brand-500',
  READY: 'border-l-emerald-500', DELAYED: 'border-l-red-500',
};
// Kitchen-actionable next steps.
const ACTIONS = {
  PENDING: [{ label: 'Accept', status: 'ACCEPTED' }, { label: 'Reject', status: 'REJECTED', variant: 'ghost' }],
  ACCEPTED: [{ label: 'Start preparing', status: 'PREPARING' }],
  PREPARING: [{ label: 'Mark ready', status: 'READY' }, { label: 'Delay', status: 'DELAYED', variant: 'ghost' }],
  DELAYED: [{ label: 'Mark ready', status: 'READY' }],
};

const minsAgo = (t) => Math.max(0, Math.floor((Date.now() - new Date(t)) / 60000));

export default function KitchenDisplay() {
  const qc = useQueryClient();
  const { user, logout } = useAuth();
  const [sound, setSound] = useState(true);
  const [sortByPriority, setSortByPriority] = useState(false);
  const [preset, setPreset] = useState('live');
  const [custom, setCustom] = useState({});
  const [profile, setProfile] = useState(false);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const live = preset === 'live';
  const range = live ? null : rangeFor(preset, custom);

  const { data, isLoading } = useQuery({
    queryKey: ['kitchen', preset, custom],
    queryFn: () => live
      ? request(api.get('/orders/kitchen/queue'))
      : request(api.get(`/orders?limit=100&from=${range.from}&to=${range.to}`)),
    refetchInterval: live ? 15000 : false,
  });

  useSocketEvents({
    'order:new': () => { if (soundRef.current && live) playBeep(); qc.invalidateQueries({ queryKey: ['kitchen'] }); },
    'order:updated': () => qc.invalidateQueries({ queryKey: ['kitchen'] }),
    'orders:changed': () => qc.invalidateQueries({ queryKey: ['kitchen'] }),
  });

  const mutate = useMutation({
    mutationFn: ({ id, status }) => request(api.patch(`/orders/${id}/status`, { status })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kitchen'] }),
    onError: (e) => toast.error(e.message),
  });

  const orders = useMemo(() => (data?.orders || []).slice().sort((a, b) =>
    sortByPriority ? (b.priority - a.priority) || (new Date(a.created_at) - new Date(b.created_at))
      : new Date(a.created_at) - new Date(b.created_at)), [data, sortByPriority]);

  const counts = useMemo(() => orders.reduce((m, o) => ({ ...m, [o.status]: (m[o.status] || 0) + 1 }), {}), [orders]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500"><ChefHat className="h-5 w-5 text-white" /></div>
          <div>
            <h1 className="font-extrabold leading-none">Kitchen Display</h1>
            <p className="text-xs text-zinc-500">{orders.length} orders · {user?.tenantName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CheckInOutButton />
          <DateFilter value={preset} onChange={setPreset} custom={custom} onCustomChange={setCustom}
            extraOptions={[{ key: 'live', label: 'Live queue' }]} />
          <Button variant="ghost" size="icon" onClick={() => setSortByPriority((v) => !v)} title="Sort by priority"
            className={sortByPriority ? 'text-brand-500' : ''}><ArrowDownUp className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setSound((s) => !s)}>{sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-zinc-400" />}</Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen}><Maximize className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setProfile(true)}><User className="h-5 w-5" /></Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={logout}><LogOut className="h-5 w-5" /></Button>
        </div>
      </header>

      {/* Status summary strip */}
      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELAYED'].filter((s) => counts[s]).map((s) => (
          <Badge key={s} tone={STATUS_TONE[s]}>{s} · {counts[s]}</Badge>
        ))}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-32"><Spinner className="h-8 w-8" /></div>
      ) : orders.length === 0 ? (
        <EmptyState icon={ChefHat} title={live ? 'All caught up! 🎉' : 'No orders in this range'}
          description={live ? 'New orders will appear here automatically.' : 'Try a different date range.'} />
      ) : (
        <div className="space-y-2 p-4">
          {orders.map((order) => {
            const actions = ACTIONS[order.status] || [];
            const mins = minsAgo(order.created_at);
            return (
              <div key={order.id}
                className={`flex flex-col gap-3 rounded-2xl border border-l-4 border-zinc-200 dark:border-zinc-800 ${BORDER[order.status] || 'border-l-zinc-400'} bg-white dark:bg-zinc-900 p-4 lg:flex-row lg:items-center`}>
                {/* Left: identity */}
                <div className="flex w-full items-center gap-3 lg:w-56 lg:shrink-0">
                  <div>
                    <p className="font-extrabold">{order.order_number}</p>
                    <p className="text-sm text-zinc-500">{order.table_number ? `Table ${order.table_number}` : order.order_type}</p>
                  </div>
                  <span className={`ml-auto flex items-center gap-1 text-sm lg:ml-0 ${mins >= 15 ? 'font-bold text-red-500' : 'text-zinc-400'}`}>
                    <Clock className="h-3.5 w-3.5" />{mins}m
                  </span>
                </div>

                {/* Middle: items */}
                <div className="flex flex-1 flex-wrap gap-x-4 gap-y-1">
                  {(order.items || []).map((it) => (
                    <span key={it.id} className="text-sm">
                      <b className="text-brand-600">{it.quantity}×</b> {it.name_snapshot}
                      {it.variant_snapshot ? <span className="text-zinc-400"> · {it.variant_snapshot}</span> : ''}
                      {it.note ? <span className="italic text-amber-600"> ({it.note})</span> : ''}
                    </span>
                  ))}
                  {order.customer_note && <span className="w-full text-xs italic text-amber-600">Note: {order.customer_note}</span>}
                </div>

                {/* Right: status + actions */}
                <div className="flex items-center gap-2 lg:w-auto">
                  <Badge tone={STATUS_TONE[order.status]}>{order.status}</Badge>
                  {actions.map((a) => (
                    <Button key={a.status} size="sm" variant={a.variant || 'primary'} disabled={mutate.isPending}
                      onClick={() => mutate.mutate({ id: order.id, status: a.status })}>{a.label}</Button>
                  ))}
                  {order.status === 'READY' && <span className="text-sm font-medium text-emerald-600">✓ Waiting pickup</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProfileModal open={profile} onClose={() => setProfile(false)} />
    </div>
  );
}
