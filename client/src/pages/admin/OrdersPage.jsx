import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { ReceiptText, Download, CreditCard } from 'lucide-react';
import api, { request } from '@/lib/api';
import { money } from '@/lib/cn';
import { useSocketEvents } from '@/hooks/useSocketEvents';
import { Card, Button, Select, Badge, Modal, EmptyState, Skeleton } from '@/components/ui';

const STATUS_TONE = {
  PENDING: 'amber', ACCEPTED: 'blue', PREPARING: 'brand', READY: 'green', SERVED: 'purple',
  COMPLETED: 'green', CANCELLED: 'red', REJECTED: 'red', DELAYED: 'red',
};

export default function OrdersPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [detail, setDetail] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', status],
    queryFn: () => request(api.get(`/orders?limit=50${status ? `&status=${status}` : ''}`)),
    refetchInterval: 20000,
  });
  useSocketEvents({
    'order:new': () => qc.invalidateQueries({ queryKey: ['orders'] }),
    'order:updated': () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });

  const orders = data?.orders || [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold">Orders</h2><p className="text-sm text-zinc-500">Live order feed</p></div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="">All statuses</option>
          {['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {isLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        : orders.length === 0 ? <Card><EmptyState icon={ReceiptText} title="No orders" /></Card>
          : (
            <div className="overflow-hidden rounded-2xl glass">
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
                      <td className="px-4 py-3 text-zinc-400">{dayjs(o.created_at).format('HH:mm')}</td>
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
  const { data, isLoading } = useQuery({ queryKey: ['order', id], queryFn: () => request(api.get(`/orders/${id}`)) });
  const o = data?.order;

  const pay = useMutation({
    mutationFn: (method) => request(api.post(`/billing/orders/${id}/pay`, { method })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['order', id] }); toast.success('Payment completed'); },
    onError: (e) => toast.error(e.message),
  });

  const invoice = () => window.open(`/api/v1/billing/orders/${id}/invoice.pdf`, '_blank');

  return (
    <Modal open onClose={onClose} title={o ? o.order_number : 'Order'} className="max-w-lg">
      {isLoading || !o ? <Skeleton className="h-64" /> : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
            <Badge tone={o.payment_status === 'PAID' ? 'green' : 'gray'}>{o.payment_status}</Badge>
            {o.table_number && <Badge tone="brand">Table {o.table_number}</Badge>}
          </div>
          <div className="space-y-2">
            {o.items.map((it) => (
              <div key={it.id} className="flex justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
                <span>{it.quantity}× {it.name_snapshot}{it.variant_snapshot ? ` · ${it.variant_snapshot}` : ''}</span>
                <span className="font-medium">{money(it.line_total)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1 border-t border-zinc-200 dark:border-zinc-800 pt-3 text-sm">
            <Row label="Subtotal" value={money(o.subtotal)} />
            {Number(o.discount_amount) > 0 && <Row label="Discount" value={`−${money(o.discount_amount)}`} />}
            <Row label="Tax" value={money(o.tax_amount)} />
            {Number(o.service_charge) > 0 && <Row label="Service" value={money(o.service_charge)} />}
            <div className="flex justify-between pt-1 text-lg font-bold"><span>Total</span><span>{money(o.total_amount)}</span></div>
          </div>
          <div className="flex gap-2">
            {o.payment_status !== 'PAID' && o.status !== 'CANCELLED' && (
              <Button className="flex-1" onClick={() => pay.mutate('CASH')} loading={pay.isPending}><CreditCard className="h-4 w-4" /> Mark Paid (Cash)</Button>
            )}
            <Button variant="outline" onClick={invoice}><Download className="h-4 w-4" /> Invoice</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
function Row({ label, value }) { return <div className="flex justify-between"><span className="text-zinc-500">{label}</span><span>{value}</span></div>; }
