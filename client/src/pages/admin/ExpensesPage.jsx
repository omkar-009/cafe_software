import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { Plus, Pencil, Trash2, Wallet, Download, Search } from 'lucide-react';
import api, { request } from '@/lib/api';
import { money } from '@/lib/cn';
import { rangeFor } from '@/lib/dateRange';
import { Card, Button, Input, Select, Textarea, Modal, Badge, EmptyState, Skeleton } from '@/components/ui';
import DateFilter from '@/components/DateFilter';

const CATEGORIES = ['INGREDIENTS', 'SALARIES', 'RENT', 'UTILITIES', 'MARKETING', 'MAINTENANCE', 'EQUIPMENT', 'PACKAGING', 'TAXES', 'OTHER'];
const METHODS = ['CASH', 'CARD', 'UPI', 'BANK', 'OTHER'];
const CAT_TONE = {
  INGREDIENTS: 'green', SALARIES: 'blue', RENT: 'purple', UTILITIES: 'amber',
  MARKETING: 'brand', MAINTENANCE: 'gray', EQUIPMENT: 'blue', PACKAGING: 'green', TAXES: 'red', OTHER: 'gray',
};

export default function ExpensesPage() {
  const qc = useQueryClient();
  const [preset, setPreset] = useState('1m');
  const [custom, setCustom] = useState({});
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);

  const range = rangeFor(preset, custom);
  const from = range.from.slice(0, 10);
  const to = range.to.slice(0, 10);

  const qs = new URLSearchParams({ from, to, limit: '200' });
  if (category) qs.set('category', category);
  if (search) qs.set('search', search);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', from, to, category, search],
    queryFn: () => request(api.get(`/finance/expenses?${qs}`)),
  });
  const del = useMutation({
    mutationFn: (id) => api.delete(`/finance/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense deleted'); },
  });

  const expenses = data?.expenses || [];
  const total = data?.totalAmount || 0;
  const exportUrl = (fmt) => { const p = new URLSearchParams({ from, to, format: fmt }); if (category) p.set('category', category); window.open(`/api/v1/finance/expenses/export?${p}`, '_blank'); };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Expenses</h2>
          <p className="text-sm text-zinc-500">{expenses.length} entries · <b className="text-red-500">{money(total)}</b> total</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateFilter value={preset} onChange={setPreset} custom={custom} onCustomChange={setCustom} />
          <Button variant="outline" size="sm" onClick={() => exportUrl('xlsx')}><Download className="h-4 w-4" /> Excel</Button>
          <Button onClick={() => setModal({ mode: 'create' })}><Plus className="h-4 w-4" /> Add expense</Button>
        </div>
      </div>

      <Card className="mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title / vendor…" className="h-10 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-44"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
      </Card>

      {isLoading ? <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        : expenses.length === 0 ? <Card><EmptyState icon={Wallet} title="No expenses in this range" description="Record rent, salaries, supplies and more." /></Card>
          : (
            <div className="overflow-x-auto rounded-2xl glass">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs uppercase text-zinc-500">
                  <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Title</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Method</th><th className="px-4 py-3 text-right">Amount</th><th /></tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{dayjs(e.expense_date).format('DD MMM YY')}</td>
                      <td className="px-4 py-3"><Badge tone={CAT_TONE[e.category]}>{e.category}</Badge></td>
                      <td className="px-4 py-3 font-medium">{e.title}</td>
                      <td className="px-4 py-3 text-zinc-500">{e.vendor || '—'}</td>
                      <td className="px-4 py-3 text-zinc-500">{e.payment_method}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-500">{money(e.amount)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <button onClick={() => setModal({ mode: 'edit', expense: e })} className="mr-1 text-zinc-400 hover:text-brand-500"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => confirm(`Delete "${e.title}"?`) && del.mutate(e.id)} className="text-zinc-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

      {modal && <ExpenseModal modal={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function ExpenseModal({ modal, onClose }) {
  const qc = useQueryClient();
  const { mode, expense } = modal;
  const [form, setForm] = useState({
    category: expense?.category || 'INGREDIENTS',
    title: expense?.title || '',
    amount: expense?.amount || '',
    vendor: expense?.vendor || '',
    paymentMethod: expense?.payment_method || 'CASH',
    expenseDate: expense?.expense_date ? dayjs(expense.expense_date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
    note: expense?.note || '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        category: form.category, title: form.title, amount: Number(form.amount),
        vendor: form.vendor || undefined, paymentMethod: form.paymentMethod,
        expenseDate: form.expenseDate, note: form.note || undefined,
      };
      return mode === 'create' ? request(api.post('/finance/expenses', payload)) : request(api.patch(`/finance/expenses/${expense.id}`, payload));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Saved'); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title={mode === 'create' ? 'Add expense' : 'Edit expense'}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
        <Input label="Title" required value={form.title} onChange={set('title')} placeholder="e.g. Vegetables supplier" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Category" value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
          <Input label="Amount (₹)" type="number" required value={form.amount} onChange={set('amount')} />
          <Select label="Payment method" value={form.paymentMethod} onChange={set('paymentMethod')}>{METHODS.map((m) => <option key={m}>{m}</option>)}</Select>
          <Input label="Date" type="date" value={form.expenseDate} onChange={set('expenseDate')} />
        </div>
        <Input label="Vendor (optional)" value={form.vendor} onChange={set('vendor')} />
        <Textarea label="Note (optional)" rows={2} value={form.note} onChange={set('note')} />
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={mutation.isPending}>Save</Button></div>
      </form>
    </Modal>
  );
}
