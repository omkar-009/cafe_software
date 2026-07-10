import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { Shield, LogOut, Search, Store, Users, Ban, CheckCircle2, Power } from 'lucide-react';
import api, { request } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Card, Button, Select, Badge, EmptyState, Skeleton } from '@/components/ui';
import StatCard from '@/components/admin/StatCard';
import ThemeToggle from '@/components/ThemeToggle';

const STATUS_TONE = { ACTIVE: 'green', TRIAL: 'blue', SUSPENDED: 'amber', DISABLED: 'red' };

export default function SuperAdminApp() {
  const qc = useQueryClient();
  const { user, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const qs = new URLSearchParams({ limit: '50' });
  if (search) qs.set('search', search);
  if (status) qs.set('status', status);

  const { data, isLoading } = useQuery({ queryKey: ['tenants', search, status], queryFn: () => request(api.get(`/tenants?${qs}`)) });

  const setTenantStatus = useMutation({
    mutationFn: ({ id, status }) => request(api.patch(`/tenants/${id}/status`, { status })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); toast.success('Status updated'); },
    onError: (e) => toast.error(e.message),
  });

  const tenants = data?.tenants || [];
  const counts = tenants.reduce((a, t) => { a[t.status] = (a[t.status] || 0) + 1; return a; }, {});

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-900 dark:bg-white"><Shield className="h-5 w-5 text-white dark:text-zinc-900" /></div>
          <div><h1 className="font-extrabold leading-none">Platform Admin</h1><p className="text-xs text-zinc-500">{user?.fullName}</p></div>
        </div>
        <div className="flex items-center gap-2"><ThemeToggle /><Button variant="ghost" size="icon" onClick={logout}><LogOut className="h-5 w-5" /></Button></div>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total restaurants" value={data?.meta?.pagination?.total ?? tenants.length} icon={Store} tone="brand" />
          <StatCard label="Active" value={counts.ACTIVE || 0} icon={CheckCircle2} tone="green" />
          <StatCard label="Trial" value={counts.TRIAL || 0} icon={Users} tone="blue" />
          <StatCard label="Suspended" value={(counts.SUSPENDED || 0) + (counts.DISABLED || 0)} icon={Ban} tone="red" />
        </div>

        <Card className="mb-4 flex flex-wrap gap-3 p-4">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search restaurants…" className="h-10 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option value="">All statuses</option>{['ACTIVE', 'TRIAL', 'SUSPENDED', 'DISABLED'].map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Card>

        {isLoading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
          : tenants.length === 0 ? <Card><EmptyState icon={Store} title="No restaurants" /></Card>
            : (
              <div className="grid gap-3">
                {tenants.map((t) => (
                  <Card key={t.id} className="flex flex-wrap items-center gap-4">
                    {t.logo_url ? <img src={t.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-xl text-lg font-black text-white" style={{ background: t.brand_color || '#f97316' }}>{t.name[0]}</div>}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{t.name} <span className="text-xs font-normal text-zinc-400">/{t.slug}</span></p>
                      <p className="text-sm text-zinc-500">{t.email || '—'} · {t.staff_count} staff · joined {dayjs(t.created_at).format('DD MMM YYYY')}</p>
                    </div>
                    <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
                    <Select value="" onChange={(e) => e.target.value && setTenantStatus.mutate({ id: t.id, status: e.target.value })} className="w-36">
                      <option value="">Change status…</option>
                      <option value="ACTIVE">Activate</option>
                      <option value="SUSPENDED">Suspend</option>
                      <option value="DISABLED">Disable</option>
                    </Select>
                  </Card>
                ))}
              </div>
            )}
      </main>
    </div>
  );
}
