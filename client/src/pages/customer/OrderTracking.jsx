import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, ChefHat, Bell, Utensils, Clock, CheckCircle2, XCircle } from 'lucide-react';
import api, { request } from '@/lib/api';
import { Button, Spinner } from '@/components/ui';
import ThemeToggle from '@/components/ThemeToggle';

const STEPS = [
  { key: 'PENDING', label: 'Order placed', icon: Check },
  { key: 'ACCEPTED', label: 'Accepted', icon: Check },
  { key: 'PREPARING', label: 'Preparing', icon: ChefHat },
  { key: 'READY', label: 'Ready', icon: Bell },
  { key: 'SERVED', label: 'Served', icon: Utensils },
];
const ORDER = STEPS.map((s) => s.key);

export default function OrderTracking({ d, orderId, restaurant, onNewOrder }) {
  const symbol = restaurant.currencySymbol || '₹';
  const { data, isLoading } = useQuery({
    queryKey: ['track', orderId],
    queryFn: () => request(api.get(`/public/orders/${orderId}?d=${encodeURIComponent(d)}`)),
    refetchInterval: 5000,
  });

  if (isLoading) return <div className="grid min-h-screen place-items-center aurora"><Spinner className="h-8 w-8" /></div>;

  const status = data?.status || 'PENDING';
  const cancelled = status === 'CANCELLED' || status === 'REJECTED';
  const completed = status === 'COMPLETED';
  const currentIdx = ORDER.indexOf(status);

  return (
    <div className="min-h-screen aurora">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="mx-auto max-w-md px-5 py-10">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <div className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${cancelled ? 'bg-red-500' : 'bg-brand-500'} shadow-glow ${!completed && !cancelled ? 'animate-pulse-ring' : ''}`}>
            {cancelled ? <XCircle className="h-10 w-10 text-white" /> : completed ? <CheckCircle2 className="h-10 w-10 text-white" /> : <Clock className="h-10 w-10 text-white" />}
          </div>
          <h1 className="mt-4 text-2xl font-extrabold">{data?.orderNumber}</h1>
          <p className="mt-1 text-zinc-500">
            {cancelled ? 'This order was cancelled' : completed ? 'Enjoy your meal! 🎉' : 'We\'re on it — hang tight'}
          </p>
        </motion.div>

        {!cancelled && (
          <div className="mt-10 space-y-1">
            {STEPS.map((step, i) => {
              const done = i <= currentIdx;
              const active = i === currentIdx;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`grid h-11 w-11 place-items-center rounded-full transition ${done ? 'bg-brand-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'} ${active ? 'ring-4 ring-brand-500/30' : ''}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {i < STEPS.length - 1 && <div className={`h-8 w-0.5 ${i < currentIdx ? 'bg-brand-500' : 'bg-zinc-200 dark:bg-zinc-800'}`} />}
                  </div>
                  <span className={`font-semibold ${done ? '' : 'text-zinc-400'}`}>{step.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Items */}
        <div className="card mt-8 p-5">
          <h3 className="mb-3 font-bold">Order summary</h3>
          <div className="space-y-2 text-sm">
            {data?.items?.map((it, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-300">{it.quantity}× {it.name}</span>
                <span className="text-zinc-400">{it.status?.toLowerCase()}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-zinc-200 dark:border-zinc-800 pt-3 font-bold">
            <span>Total</span><span>{symbol}{Number(data?.totalAmount || 0).toFixed(2)}</span>
          </div>
          <p className="mt-2 text-xs text-zinc-400">Payment: {data?.paymentStatus?.toLowerCase()}</p>
        </div>

        <Button variant="outline" className="mt-6 w-full" onClick={onNewOrder}>Order more items</Button>
      </div>
    </div>
  );
}
