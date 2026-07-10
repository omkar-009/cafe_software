import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Ticket, Plus, Trash2, Pencil } from 'lucide-react';
import dayjs from 'dayjs';
import api, { request } from '@/lib/api';
import { Card, Button, Input, Select, Modal, Badge, EmptyState, Skeleton } from '@/components/ui';

export default function CouponsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['coupons'], queryFn: () => request(api.get('/coupons')) });
  const del = useMutation({
    mutationFn: (id) => api.delete(`/coupons/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons'] }); toast.success('Coupon deleted'); },
  });
  const coupons = data?.coupons || [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div><h2 className="text-xl font-bold">Coupons</h2><p className="text-sm text-zinc-500">{coupons.length} coupons</p></div>
        <Button onClick={() => setModal({ mode: 'create' })}><Plus className="h-4 w-4" /> New coupon</Button>
      </div>
      {isLoading ? <Skeleton className="h-40 rounded-2xl" />
        : coupons.length === 0 ? <Card><EmptyState icon={Ticket} title="No coupons" description="Create discount codes for your customers." /></Card>
          : (
            <div className="grid gap-3 sm:grid-cols-2">
              {coupons.map((c) => {
                const expired = c.expires_at && dayjs(c.expires_at).isBefore(dayjs());
                return (
                  <Card key={c.id} className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg border-2 border-dashed border-brand-400 px-2.5 py-1 font-mono font-bold text-brand-600">{c.code}</span>
                        {!c.is_active ? <Badge tone="gray">Off</Badge> : expired ? <Badge tone="red">Expired</Badge> : <Badge tone="green">Active</Badge>}
                      </div>
                      <p className="mt-2 text-sm text-zinc-500">
                        {c.type === 'PERCENTAGE' ? `${c.value}% off` : `₹${c.value} off`}
                        {Number(c.min_order_amount) > 0 && ` · min ₹${c.min_order_amount}`}
                      </p>
                      <p className="text-xs text-zinc-400">Used {c.used_count}{c.usage_limit ? `/${c.usage_limit}` : ''}{c.expires_at ? ` · expires ${dayjs(c.expires_at).format('DD MMM')}` : ''}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setModal({ mode: 'edit', coupon: c })}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => confirm(`Delete ${c.code}?`) && del.mutate(c.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
      {modal && <CouponModal modal={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function CouponModal({ modal, onClose }) {
  const qc = useQueryClient();
  const { mode, coupon } = modal;
  const [form, setForm] = useState({
    code: coupon?.code || '', type: coupon?.type || 'PERCENTAGE', value: coupon?.value || 10,
    minOrderAmount: coupon?.min_order_amount || 0, maxDiscount: coupon?.max_discount || '',
    usageLimit: coupon?.usage_limit || '', expiresAt: coupon?.expires_at ? dayjs(coupon.expires_at).format('YYYY-MM-DD') : '',
    isActive: coupon?.is_active ?? true,
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target?.type === 'checkbox' ? e.target.checked : e.target.value }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        type: form.type, value: Number(form.value), minOrderAmount: Number(form.minOrderAmount) || 0,
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        expiresAt: form.expiresAt || undefined, isActive: form.isActive,
      };
      if (mode === 'create') return request(api.post('/coupons', { code: form.code, ...payload }));
      return request(api.patch(`/coupons/${coupon.id}`, payload));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons'] }); toast.success('Saved'); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title={mode === 'create' ? 'New coupon' : 'Edit coupon'}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
        {mode === 'create' && <Input label="Code" required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="WELCOME10" />}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type" value={form.type} onChange={set('type')}><option value="PERCENTAGE">Percentage</option><option value="FLAT">Flat</option></Select>
          <Input label={form.type === 'PERCENTAGE' ? 'Percent (%)' : 'Amount (₹)'} type="number" value={form.value} onChange={set('value')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Min order (₹)" type="number" value={form.minOrderAmount} onChange={set('minOrderAmount')} />
          <Input label="Max discount (₹)" type="number" value={form.maxDiscount} onChange={set('maxDiscount')} placeholder="optional" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Usage limit" type="number" value={form.usageLimit} onChange={set('usageLimit')} placeholder="unlimited" />
          <Input label="Expires" type="date" value={form.expiresAt} onChange={set('expiresAt')} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={set('isActive')} /> Active</label>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={mutation.isPending}>Save</Button></div>
      </form>
    </Modal>
  );
}
