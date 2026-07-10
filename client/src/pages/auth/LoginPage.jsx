import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { UtensilsCrossed, Store, Mail, Lock } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { Button, Input } from '@/components/ui';
import ThemeToggle from '@/components/ThemeToggle';

const HOME_BY_ROLE = {
  SUPER_ADMIN: '/super', RESTAURANT_ADMIN: '/admin', KITCHEN: '/kitchen', WAITER: '/waiter',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [form, setForm] = useState({ email: '', password: '', tenantSlug: '' });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login({
        email: form.email.trim(),
        password: form.password,
        tenantSlug: form.tenantSlug.trim() || undefined,
      });
      toast.success(`Welcome back, ${user.fullName.split(' ')[0]}!`);
      navigate(HOME_BY_ROLE[user.role] || '/');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden aurora p-4">
      <div className="absolute right-5 top-5"><ThemeToggle /></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="glass-strong w-full max-w-md rounded-3xl p-8"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 shadow-glow">
            <UtensilsCrossed className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold">RestroSaaS</h1>
          <p className="mt-1 text-sm text-zinc-500">Sign in to your dashboard</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <Store className="pointer-events-none absolute left-3 top-[38px] h-4 w-4 text-zinc-400" />
            <Input label="Restaurant handle" placeholder="demo-cafe (blank for Super Admin)"
              value={form.tenantSlug} onChange={set('tenantSlug')} className="pl-9" autoComplete="organization" />
          </div>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-[38px] h-4 w-4 text-zinc-400" />
            <Input label="Email" type="email" required placeholder="you@restaurant.com"
              value={form.email} onChange={set('email')} className="pl-9" autoComplete="username" />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-[38px] h-4 w-4 text-zinc-400" />
            <Input label="Password" type="password" required placeholder="••••••••"
              value={form.password} onChange={set('password')} className="pl-9" autoComplete="current-password" />
          </div>

          <Button type="submit" size="lg" loading={loading} className="w-full">Sign In</Button>
        </form>

        <div className="mt-6 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/50 p-3 text-xs text-zinc-500">
          <p className="font-semibold text-zinc-600 dark:text-zinc-400">Demo accounts (password: Password123!)</p>
          <p className="mt-1">owner@demo.com · kitchen@demo.com · waiter@demo.com — handle <b>demo-cafe</b></p>
          <p>superadmin@restrosaas.com — leave handle blank</p>
        </div>
      </motion.div>
    </div>
  );
}
