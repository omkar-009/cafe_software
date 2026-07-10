import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

/** KPI stat tile — big number + label + optional icon/trend. */
export default function StatCard({ label, value, icon: Icon, tone = 'brand', sub, delay = 0 }) {
  const tones = {
    brand: 'from-brand-500/15 to-brand-500/5 text-brand-600 dark:text-brand-400',
    blue: 'from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400',
    green: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    amber: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400',
    red: 'from-red-500/15 to-red-500/5 text-red-600 dark:text-red-400',
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="card flex items-center gap-4 p-5">
      {Icon && <div className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br', tones[tone])}><Icon className="h-6 w-6" /></div>}
      <div className="min-w-0">
        <p className="text-sm text-zinc-500">{label}</p>
        <p className="truncate text-2xl font-extrabold tabular-nums">{value}</p>
        {sub && <p className="text-xs text-zinc-400">{sub}</p>}
      </div>
    </motion.div>
  );
}
