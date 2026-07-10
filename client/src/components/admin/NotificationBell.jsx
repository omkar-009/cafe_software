import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import api, { request } from '@/lib/api';
import { useSocketEvents } from '@/hooks/useSocketEvents';

dayjs.extend(relativeTime);

export default function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => request(api.get('/notifications?limit=15')),
    refetchInterval: 60000,
  });

  useSocketEvents({
    'notification:new': () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: () => request(api.post('/notifications/read-all')),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = data?.unreadCount || 0;
  const items = data?.notifications || [];

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative grid h-10 w-10 place-items-center rounded-xl glass hover:scale-105 transition">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="glass-strong absolute right-0 top-12 z-40 w-80 overflow-hidden rounded-2xl">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
                <span className="font-bold">Notifications</span>
                {unread > 0 && <button onClick={() => markAll.mutate()} className="flex items-center gap-1 text-xs text-brand-600"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="py-10 text-center text-sm text-zinc-400">You're all caught up</p>
                ) : items.map((n) => (
                  <div key={n.id} className={`border-b border-zinc-100 dark:border-zinc-800/50 px-4 py-3 ${!n.is_read ? 'bg-brand-50/50 dark:bg-brand-500/5' : ''}`}>
                    <div className="flex items-start gap-2">
                      {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{n.title}</p>
                        {n.body && <p className="text-xs text-zinc-500">{n.body}</p>}
                        <p className="mt-0.5 text-[11px] text-zinc-400">{dayjs(n.created_at).fromNow()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
