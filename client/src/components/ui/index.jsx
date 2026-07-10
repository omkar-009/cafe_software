import { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';

export { default as Button } from './Button';

/* ── Card ── */
export function Card({ className, children, hover = false, ...props }) {
  return (
    <div className={cn('card p-5', hover && 'transition-transform hover:-translate-y-0.5 hover:shadow-glass-lg', className)} {...props}>
      {children}
    </div>
  );
}

/* ── Inputs ── */
export const Input = forwardRef(({ className, label, error, ...props }, ref) => (
  <label className="block">
    {label && <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>}
    <input
      ref={ref}
      className={cn(
        'w-full h-11 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 px-4 text-sm',
        'placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition',
        error && 'border-red-500 focus:ring-red-400', className,
      )}
      {...props}
    />
    {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
  </label>
));
Input.displayName = 'Input';

export const Textarea = forwardRef(({ className, label, ...props }, ref) => (
  <label className="block">
    {label && <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>}
    <textarea
      ref={ref}
      className={cn('w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 transition', className)}
      {...props}
    />
  </label>
));
Textarea.displayName = 'Textarea';

export function Select({ className, label, children, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>}
      <select
        className={cn('w-full h-11 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 transition', className)}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

/* ── Badge ── */
const badgeTones = {
  gray: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
};
export function Badge({ tone = 'gray', className, children }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', badgeTones[tone], className)}>{children}</span>;
}

/* ── Spinner ── */
export function Spinner({ className }) {
  return <div className={cn('h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-brand-500', className)} />;
}

/* ── Skeleton ── */
export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} />;
}

/* ── Empty state ── */
export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
        <Icon className="h-8 w-8 text-zinc-400" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Modal ── */
export function Modal({ open, onClose, title, children, className }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className={cn('glass-strong relative z-10 w-full max-w-lg rounded-2xl p-6', className)}
          >
            {title && (
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">{title}</h2>
                <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
