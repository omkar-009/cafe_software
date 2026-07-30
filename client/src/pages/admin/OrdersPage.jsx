import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { fmtDateTime } from '@/lib/format';
import { ReceiptText, Download, CreditCard, Pencil, Trash2, Minus, Plus, Save } from 'lucide-react';
import api, { request } from '@/lib/api';
import { money } from '@/lib/cn';
import { rangeFor } from '@/lib/dateRange';
import { useSocketEvents } from '@/hooks/useSocketEvents';
import { Card, Button, Select, Badge, Modal, EmptyState, Skeleton } from '@/components/ui';
import DateFilter from '@/components/DateFilter';

const STATUSES = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'REJECTED', 'DELAYED', 'CANCELLED'];
const STATUS_TONE = {
  PENDING: 'amber', ACCEPTED: 'blue', PREPARING: 'brand', READY: 'green', SERVED: 'purple',
  COMPLETED: 'green', CANCELLED: 'red', REJECTED: 'red', DELAYED: 'red',
};

export default function OrdersPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [preset, setPreset] = useState('today');
  const [custom, setCustom] = useState({});
  const [detail, setDetail] = useState(null);

  const range = rangeFor(preset, custom);
  const { data, isLoading } = useQuery({
    queryKey: ['orders', status, preset, custom],
    queryFn: () => request(api.get(`/orders?limit=100&from=${range.from}&to=${range.to}${status ? `&status=${status}` : ''}`)),
    refetchInterval: 20000,
  });
  useSocketEvents({
    'order:new': () => qc.invalidateQueries({ queryKey: ['orders'] }),
    'order:updated': () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });

  const orders = data?.orders || [];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold">Orders</h2><p className="text-sm text-zinc-500">{orders.length} orders</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <DateFilter value={preset} onChange={setPreset} custom={custom} onCustomChange={setCustom} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Button variant="outline" size="sm" onClick={() => {
            const p = new URLSearchParams({ from: range.from, to: range.to, format: 'xlsx' });
            if (status) p.set('status', status);
            window.open(`/api/v1/orders/export?${p}`, '_blank');
          }}><Download className="h-4 w-4" /> Export</Button>
        </div>
      </div>

      {isLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        : orders.length === 0 ? <Card><EmptyState icon={ReceiptText} title="No orders in this range" /></Card>
          : (
            <div className="overflow-x-auto rounded-2xl glass">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs uppercase text-zinc-500">
                  <tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Table</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Time</th><th /></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="px-4 py-3 font-semibold">{o.order_number}</td>
                      <td className="px-4 py-3">{o.table_number || '—'}</td>
                      <td className="px-4 py-3 text-zinc-500">{o.item_count}</td>
                      <td className="px-4 py-3 font-medium">{money(o.total_amount)}</td>
                      <td className="px-4 py-3"><Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge></td>
                      <td className="px-4 py-3"><Badge tone={o.payment_status === 'PAID' ? 'green' : 'gray'}>{o.payment_status}</Badge></td>
                      <td className="px-4 py-3 text-zinc-400">{fmtDateTime(o.created_at)}</td>
                      <td className="px-4 py-3"><Button variant="ghost" size="sm" onClick={() => setDetail(o.id)}>View</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

      {detail && <OrderDetail id={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function OrderDetail({ id, onClose }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null); // { status, qtys:{itemId:qty}, removed:Set }

  const { data, isLoading } = useQuery({ queryKey: ['order', id], queryFn: () => request(api.get(`/orders/${id}`)) });
  const o = data?.order;

  const startEdit = () => {
    setDraft({ status: o.status, qtys: Object.fromEntries(o.items.map((i) => [i.id, i.quantity])), removed: new Set() });
    setEditing(true);
  };

  const pay = useMutation({
    mutationFn: (method) => request(api.post(`/billing/orders/${id}/pay`, { method })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['order', id] }); toast.success('Payment completed'); },
    onError: (e) => toast.error(e.message),
  });
  const saveEdit = useMutation({
    mutationFn: () => {
      const items = o.items
        .filter((i) => !draft.removed.has(i.id) && draft.qtys[i.id] !== i.quantity)
        .map((i) => ({ id: i.id, quantity: draft.qtys[i.id] }));
      const removeItemIds = [...draft.removed];
      return request(api.patch(`/orders/${id}`, {
        status: draft.status !== o.status ? draft.status : undefined,
        items: items.length ? items : undefined,
        removeItemIds: removeItemIds.length ? removeItemIds : undefined,
      }));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['order', id] }); toast.success('Order updated'); setEditing(false); },
    onError: (e) => toast.error(e.message),
  });

  const invoice = () => window.open(`/api/v1/billing/orders/${id}/invoice.pdf`, '_blank');
  const setQty = (itemId, q) => setDraft((d) => ({ ...d, qtys: { ...d.qtys, [itemId]: Math.max(1, q) } }));
  const toggleRemove = (itemId) => setDraft((d) => { const r = new Set(d.removed); r.has(itemId) ? r.delete(itemId) : r.add(itemId); return { ...d, removed: r }; });

  return (
    <Modal open onClose={onClose} title={o ? o.order_number : 'Order'} className="max-w-lg">
      {isLoading || !o ? <Skeleton className="h-64" /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
            <Badge tone={o.payment_status === 'PAID' ? 'green' : 'gray'}>{o.payment_status}</Badge>
            {o.table_number && <Badge tone="brand">Table {o.table_number}</Badge>}
            {!editing && <Button variant="outline" size="sm" className="ml-auto" onClick={startEdit}><Pencil className="h-4 w-4" /> Edit</Button>}
          </div>

          {editing && (
            <div className="rounded-xl border border-brand-200 dark:border-brand-500/30 bg-brand-50/50 dark:bg-brand-500/5 p-3">
              <label className="text-xs font-semibold text-zinc-500">Override status</label>
              <Select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} className="mt-1">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          )}

          <div className="space-y-2">
            {o.items.map((it) => {
              const removed = editing && draft.removed.has(it.id);
              return (
                <div key={it.id} className={`flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 ${removed ? 'opacity-40 line-through' : ''}`}>
                  <span className="min-w-0 flex-1">{editing ? draft.qtys[it.id] : it.quantity}× {it.name_snapshot}{it.variant_snapshot ? ` · ${it.variant_snapshot}` : ''}</span>
                  {editing ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setQty(it.id, draft.qtys[it.id] - 1)} disabled={removed} className="grid h-7 w-7 place-items-center rounded border border-zinc-300 dark:border-zinc-700"><Minus className="h-3 w-3" /></button>
                      <span className="w-6 text-center text-sm font-bold">{draft.qtys[it.id]}</span>
                      <button onClick={() => setQty(it.id, draft.qtys[it.id] + 1)} disabled={removed} className="grid h-7 w-7 place-items-center rounded border border-zinc-300 dark:border-zinc-700"><Plus className="h-3 w-3" /></button>
                      <button onClick={() => toggleRemove(it.id)} className="ml-1 text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ) : <span className="font-medium">{money(it.line_total)}</span>}
                </div>
              );
            })}
          </div>

          {!editing && (
            <div className="space-y-1 border-t border-zinc-200 dark:border-zinc-800 pt-3 text-sm">
              <Row label="Subtotal" value={money(o.subtotal)} />
              {Number(o.discount_amount) > 0 && <Row label="Discount" value={`−${money(o.discount_amount)}`} />}
              <Row label="Tax" value={money(o.tax_amount)} />
              {Number(o.service_charge) > 0 && <Row label="Service" value={money(o.service_charge)} />}
              <div className="flex justify-between pt-1 text-lg font-bold"><span>Total</span><span>{money(o.total_amount)}</span></div>
            </div>
          )}

          <div className="flex gap-2">
            {editing ? (
              <>
                <Button className="flex-1" onClick={() => saveEdit.mutate()} loading={saveEdit.isPending}><Save className="h-4 w-4" /> Save changes</Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </>
            ) : (
              <>
                {o.payment_status !== 'PAID' && o.status !== 'CANCELLED' && (
                  <Button className="flex-1" onClick={() => pay.mutate('CASH')} loading={pay.isPending}><CreditCard className="h-4 w-4" /> Mark Paid (Cash)</Button>
                )}
                <Button variant="outline" onClick={invoice}><Download className="h-4 w-4" /> Invoice</Button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
function Row({ label, value }) { return <div className="flex justify-between"><span className="text-zinc-500">{label}</span><span>{value}</span></div>; }
