import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { fmtDateTime } from '@/lib/format';
import { ScrollText, Download, Search } from 'lucide-react';
import api, { request } from '@/lib/api';
import { Card, Button, Select, Badge, EmptyState, Skeleton } from '@/components/ui';

export default function AuditPage() {
  const [filters, setFilters] = useState({ module: '', action: '', search: '' });
  const { data: facets } = useQuery({ queryKey: ['audit-facets'], queryFn: () => request(api.get('/audit-logs/facets')) });

  const qs = new URLSearchParams();
  qs.set('limit', '50');
  if (filters.module) qs.set('module', filters.module);
  if (filters.action) qs.set('action', filters.action);
  if (filters.search) qs.set('search', filters.search);

  const { data, isLoading } = useQuery({ queryKey: ['audit', filters], queryFn: () => request(api.get(`/audit-logs?${qs}`)) });
  const logs = data?.logs || [];

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const exportUrl = (format) => { const p = new URLSearchParams(qs); p.set('format', format); window.open(`/api/v1/audit-logs/export?${p}`, '_blank'); };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold">Audit Logs</h2><p className="text-sm text-zinc-500">Every important action, tracked</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportUrl('csv')}><Download className="h-4 w-4" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportUrl('xlsx')}><Download className="h-4 w-4" /> Excel</Button>
        </div>
      </div>

      <Card className="mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input value={filters.search} onChange={set('search')} placeholder="Search description / employee…" className="h-10 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        <Select value={filters.module} onChange={set('module')} className="w-40"><option value="">All modules</option>{(facets?.modules || []).map((m) => <option key={m}>{m}</option>)}</Select>
        <Select value={filters.action} onChange={set('action')} className="w-44"><option value="">All actions</option>{(facets?.actions || []).map((a) => <option key={a}>{a}</option>)}</Select>
      </Card>

      {isLoading ? <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        : logs.length === 0 ? <Card><EmptyState icon={ScrollText} title="No logs match" /></Card>
          : (
            <div className="overflow-x-auto rounded-2xl glass">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs uppercase text-zinc-500">
                  <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Module</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">By</th><th className="px-4 py-3">Device</th></tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-800/50">
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{fmtDateTime(l.created_at)}</td>
                      <td className="px-4 py-3"><Badge tone="blue">{l.module}</Badge></td>
                      <td className="px-4 py-3 font-medium">{l.action}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{l.description}</td>
                      <td className="px-4 py-3">{l.actor_name || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-400">{[l.browser, l.operating_system].filter((x) => x && x !== 'Unknown').join(' · ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </div>
  );
}
