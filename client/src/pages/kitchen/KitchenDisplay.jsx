import { useRef, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Maximize, Minimize, Volume2, VolumeX, LogOut, ChefHat, ArrowDownUp } from 'lucide-react';
import api, { request } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useSocketEvents, playBeep } from '@/hooks/useSocketEvents';
import { Button, EmptyState, Spinner } from '@/components/ui';
import ThemeToggle from '@/components/ThemeToggle';
import KitchenCard from './KitchenCard';

export default function KitchenDisplay() {
  const qc = useQueryClient();
  const { user, logout } = useAuth();
  const [sound, setSound] = useState(true);
  const [sortByPriority, setSortByPriority] = useState(false);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const { data, isLoading } = useQuery({
    queryKey: ['kitchen-queue'],
    queryFn: () => request(api.get('/orders/kitchen/queue')),
    refetchInterval: 15000,
  });

  useSocketEvents({
    'order:new': () => { if (soundRef.current) playBeep(); qc.invalidateQueries({ queryKey: ['kitchen-queue'] }); },
    'order:updated': () => qc.invalidateQueries({ queryKey: ['kitchen-queue'] }),
    'orders:changed': () => qc.invalidateQueries({ queryKey: ['kitchen-queue'] }),
  });

  const mutate = useMutation({
    mutationFn: ({ id, status }) => request(api.patch(`/orders/${id}/status`, { status })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kitchen-queue'] }),
    onError: (e) => toast.error(e.message),
  });

  const orders = (data?.orders || []).slice().sort((a, b) =>
    sortByPriority ? (b.priority - a.priority) || (new Date(a.created_at) - new Date(b.created_at))
      : new Date(a.created_at) - new Date(b.created_at));

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500"><ChefHat className="h-5 w-5 text-white" /></div>
          <div>
            <h1 className="font-extrabold leading-none">Kitchen Display</h1>
            <p className="text-xs text-zinc-500">{orders.length} active · {user?.tenantName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSortByPriority((v) => !v)} title="Sort by priority"
            className={sortByPriority ? 'text-brand-500' : ''}><ArrowDownUp className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setSound((s) => !s)}>{sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-zinc-400" />}</Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen}><Maximize className="h-5 w-5" /></Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={logout}><LogOut className="h-5 w-5" /></Button>
        </div>
      </header>

      {isLoading ? (
        <div className="grid place-items-center py-32"><Spinner className="h-8 w-8" /></div>
      ) : orders.length === 0 ? (
        <EmptyState icon={ChefHat} title="All caught up! 🎉" description="New orders will appear here automatically." />
      ) : (
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {orders.map((order) => (
              <KitchenCard key={order.id} order={order} onAction={(status) => mutate.mutate({ id: order.id, status })} busy={mutate.isPending} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
