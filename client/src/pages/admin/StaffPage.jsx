import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UserPlus, Trash2, Pencil, KeyRound, Users } from 'lucide-react';
import api, { request } from '@/lib/api';
import { Card, Button, Input, Select, Modal, Badge, EmptyState, Skeleton } from '@/components/ui';

const ROLE_TONE = { RESTAURANT_ADMIN: 'purple', KITCHEN: 'amber', WAITER: 'blue' };

export default function StaffPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // { mode, staff }
  const { data, isLoading } = useQuery({ queryKey: ['staff'], queryFn: () => request(api.get('/staff?limit=100')) });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/staff/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); toast.success('Staff removed'); },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed'),
  });

  const staff = data?.staff || [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div><h2 className="text-xl font-bold">Staff</h2><p className="text-sm text-zinc-500">{staff.length} team members</p></div>
        <Button onClick={() => setModal({ mode: 'create' })}><UserPlus className="h-4 w-4" /> Add staff</Button>
      </div>

      {isLoading ? <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        : staff.length === 0 ? <Card><EmptyState icon={Users} title="No staff yet" description="Add kitchen and waiter accounts." /></Card>
          : (
            <div className="grid gap-3">
              {staff.map((s) => (
                <Card key={s.id} className="flex items-center gap-4 py-4">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-500 font-bold text-white">{s.full_name[0]}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.full_name} {!s.is_active && <Badge tone="red">Disabled</Badge>}</p>
                    <p className="text-sm text-zinc-500">{s.email}</p>
                  </div>
                  <Badge tone={ROLE_TONE[s.role]}>{s.role.replace('RESTAURANT_', '').replace('_', ' ')}</Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setModal({ mode: 'edit', staff: s })}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setModal({ mode: 'password', staff: s })}><KeyRound className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => confirm(`Remove ${s.full_name}?`) && del.mutate(s.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

      {modal && <StaffModal modal={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function StaffModal({ modal, onClose }) {
  const qc = useQueryClient();
  const { mode, staff } = modal;
  const [form, setForm] = useState(
    mode === 'password' ? { password: '' }
      : { role: staff?.role || 'WAITER', fullName: staff?.full_name || '', email: staff?.email || '', phone: staff?.phone || '', password: '', monthlySalary: staff?.monthly_salary ?? '', isActive: staff?.is_active ?? true },
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target?.type === 'checkbox' ? e.target.checked : e.target.value }));

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === 'password') return request(api.post(`/staff/${staff.id}/reset-password`, { password: form.password }));
      const salary = form.monthlySalary === '' ? undefined : Number(form.monthlySalary);
      if (mode === 'create') return request(api.post('/staff', { ...form, monthlySalary: salary }));
      const { email, password, monthlySalary, ...rest } = form;
      return request(api.patch(`/staff/${staff.id}`, { ...rest, monthlySalary: salary }));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); toast.success('Saved'); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const title = mode === 'create' ? 'Add staff' : mode === 'password' ? `Reset password` : 'Edit staff';

  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
        {mode === 'password' ? (
          <Input label="New password" type="password" required minLength={8} value={form.password} onChange={set('password')} />
        ) : (
          <>
            <Input label="Full name" required value={form.fullName} onChange={set('fullName')} />
            <Select label="Role" value={form.role} onChange={set('role')}>
              <option value="WAITER">Waiter</option>
              <option value="KITCHEN">Kitchen</option>
              <option value="RESTAURANT_ADMIN">Admin</option>
            </Select>
            {mode === 'create' && <>
              <Input label="Email" type="email" required value={form.email} onChange={set('email')} />
              <Input label="Password" type="password" required minLength={8} value={form.password} onChange={set('password')} />
            </>}
            <Input label="Phone" value={form.phone} onChange={set('phone')} />
            <Input label="Monthly salary (₹)" type="number" value={form.monthlySalary} onChange={set('monthlySalary')} placeholder="for payroll (optional)" />
            {mode === 'edit' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={set('isActive')} /> Active</label>}
          </>
        )}
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={mutation.isPending}>Save</Button></div>
      </form>
    </Modal>
  );
}
