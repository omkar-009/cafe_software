import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui';

const STATUS_STYLE = {
  PENDING: { ring: 'border-amber-400', head: 'bg-amber-400', label: 'New' },
  ACCEPTED: { ring: 'border-blue-400', head: 'bg-blue-400', label: 'Accepted' },
  PREPARING: { ring: 'border-brand-500', head: 'bg-brand-500', label: 'Preparing' },
  READY: { ring: 'border-emerald-500', head: 'bg-emerald-500', label: 'Ready' },
  DELAYED: { ring: 'border-red-500', head: 'bg-red-500', label: 'Delayed' },
};

const ACTIONS = {
  PENDING: [['Accept', 'ACCEPTED', 'primary'], ['Reject', 'REJECTED', 'danger']],
  ACCEPTED: [['Start Preparing', 'PREPARING', 'primary']],
  PREPARING: [['Mark Ready', 'READY', 'primary'], ['Delay', 'DELAYED', 'outline']],
  DELAYED: [['Mark Ready', 'READY', 'primary']],
  READY: [],
};

function elapsed(from) {
  const mins = Math.floor((Date.now() - new Date(from).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
}

export default function KitchenCard({ order, onAction, busy }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);

  const style = STATUS_STYLE[order.status] || STATUS_STYLE.PENDING;
  const mins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const urgent = mins >= 15 && order.status !== 'READY';

  return (
    <motion.div
      layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      className={`overflow-hidden rounded-2xl border-2 bg-white dark:bg-zinc-900 shadow-glass ${style.ring} ${urgent ? 'animate-pulse-ring' : ''}`}>
      <div className={`flex items-center justify-between px-4 py-2 text-white ${style.head}`}>
        <span className="font-black">{order.order_number}</span>
        <span className="text-xs font-bold uppercase tracking-wide">{style.label}</span>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{order.table_number ? `Table ${order.table_number}` : order.order_type}</span>
          <span className={`flex items-center gap-1 font-semibold ${urgent ? 'text-red-500' : ''}`}><Clock className="h-3.5 w-3.5" />{elapsed(order.created_at)}</span>
        </div>

        <ul className="mt-3 space-y-2">
          {order.items?.map((it) => (
            <li key={it.id} className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2">
              <div className="flex justify-between font-semibold">
                <span>{it.name_snapshot}{it.variant_snapshot ? ` · ${it.variant_snapshot}` : ''}</span>
                <span className="text-brand-600">×{it.quantity}</span>
              </div>
              {it.addons?.length > 0 && <p className="text-xs text-zinc-400">+ {it.addons.map((a) => a.name_snapshot).join(', ')}</p>}
              {it.note && <p className="text-xs italic text-amber-600">📝 {it.note}</p>}
            </li>
          ))}
        </ul>

        {order.customer_note && <p className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">Note: {order.customer_note}</p>}

        {ACTIONS[order.status]?.length > 0 && (
          <div className="mt-4 flex gap-2">
            {ACTIONS[order.status].map(([label, status, variant]) => (
              <Button key={status} variant={variant} size="sm" className="flex-1" disabled={busy} onClick={() => onAction(status)}>{label}</Button>
            ))}
          </div>
        )}
        {order.status === 'READY' && <p className="mt-4 text-center text-sm font-semibold text-emerald-600">✓ Waiting for pickup</p>}
      </div>
    </motion.div>
  );
}
