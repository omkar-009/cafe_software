import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, UtensilsCrossed, Tags, X } from 'lucide-react';
import api, { request } from '@/lib/api';
import { money } from '@/lib/cn';
import { Card, Button, Input, Select, Textarea, Modal, Badge, EmptyState, Skeleton } from '@/components/ui';

export default function MenuPage() {
  const qc = useQueryClient();
  const [cat, setCat] = useState('all');
  const [itemModal, setItemModal] = useState(null);
  const [catModal, setCatModal] = useState(false);

  const { data: catData } = useQuery({ queryKey: ['categories', true], queryFn: () => request(api.get('/categories?includeInactive=true')) });
  const { data: itemData, isLoading } = useQuery({ queryKey: ['menu', cat], queryFn: () => request(api.get(`/menu?limit=200${cat !== 'all' ? `&categoryId=${cat}` : ''}`)) });

  const toggle = useMutation({
    mutationFn: ({ id, field, value }) => request(api.patch(`/menu/${id}/toggle`, { [field]: value })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] }),
  });
  const del = useMutation({
    mutationFn: (id) => api.delete(`/menu/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu'] }); toast.success('Item deleted'); },
  });

  const categories = catData?.categories || [];
  const items = itemData?.items || [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div><h2 className="text-xl font-bold">Menu</h2><p className="text-sm text-zinc-500">{items.length} items</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatModal(true)}><Tags className="h-4 w-4" /> Categories</Button>
          <Button onClick={() => setItemModal({ mode: 'create' })}><Plus className="h-4 w-4" /> Add item</Button>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Chip active={cat === 'all'} onClick={() => setCat('all')}>All</Chip>
        {categories.map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</Chip>)}
      </div>

      {isLoading ? <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        : items.length === 0 ? <Card><EmptyState icon={UtensilsCrossed} title="No items" description="Add your first menu item." /></Card>
          : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((it) => (
                <Card key={it.id} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-bold">{it.name}</p>
                      <p className="text-sm text-zinc-500">
                        {money(it.price)}
                        {Number(it.cost_price) > 0 && <span className="ml-1 text-emerald-600 dark:text-emerald-400">· {Math.round(((Number(it.price) - Number(it.cost_price)) / Number(it.price)) * 100)}% margin</span>}
                        {' · '}{it.category_name || 'Uncategorized'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setItemModal({ mode: 'edit', id: it.id })}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => confirm(`Delete ${it.name}?`) && del.mutate(it.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {it.is_bestseller && <Badge tone="amber">Bestseller</Badge>}
                    {it.is_recommended && <Badge tone="brand">Recommended</Badge>}
                    <Badge tone={it.food_type === 'VEG' ? 'green' : 'red'}>{it.food_type}</Badge>
                  </div>
                  <div className="mt-1 flex gap-4 text-sm">
                    <Toggle label="Available" checked={it.is_available} onChange={(v) => toggle.mutate({ id: it.id, field: 'isAvailable', value: v })} />
                    <Toggle label="Out of stock" checked={it.is_out_of_stock} onChange={(v) => toggle.mutate({ id: it.id, field: 'isOutOfStock', value: v })} />
                  </div>
                </Card>
              ))}
            </div>
          )}

      {itemModal && <ItemModal modal={itemModal} categories={categories} onClose={() => setItemModal(null)} />}
      {catModal && <CategoryModal categories={categories} onClose={() => setCatModal(false)} />}
    </div>
  );
}

function Chip({ active, children, ...p }) {
  return <button {...p} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${active ? 'bg-brand-500 text-white' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'}`}>{children}</button>;
}
function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <button type="button" onClick={() => onChange(!checked)} className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-brand-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-4' : 'left-0.5'}`} />
      </button>
      <span className="text-zinc-500">{label}</span>
    </label>
  );
}

/** Map an API item onto the flat form shape the modal edits. */
function formFromItem(it) {
  return {
    name: it.name, price: it.price, costPrice: it.cost_price ?? 0, categoryId: it.category_id || '', taxRate: it.tax_rate,
    foodType: it.food_type, spicyLevel: it.spicy_level, prepTimeMins: it.prep_time_mins,
    description: it.description || '', isRecommended: it.is_recommended, isBestseller: it.is_bestseller,
    variants: (it.variants || []).map((v) => ({ name: v.name, priceDelta: Number(v.price_delta), isDefault: v.is_default })),
    addonGroups: (it.addonGroups || []).map((g) => ({ name: g.name, minSelect: g.min_select, maxSelect: g.max_select, isRequired: g.is_required, options: (g.options || []).map((o) => ({ name: o.name, price: Number(o.price) })) })),
  };
}
function blankForm(categories) {
  return {
    name: '', price: '', costPrice: '', categoryId: categories[0]?.id || '', taxRate: 5, foodType: 'VEG', spicyLevel: 0, prepTimeMins: 15,
    description: '', isRecommended: false, isBestseller: false, variants: [], addonGroups: [],
  };
}

function ItemModal({ modal, categories, onClose }) {
  const qc = useQueryClient();
  const editing = modal.mode === 'edit';
  const { data, error, isError } = useQuery({ queryKey: ['menu-item', modal.id], queryFn: () => request(api.get(`/menu/${modal.id}`)), enabled: editing });
  const it = data?.item;

  // null while an edit's item is still loading; every hook below must still run.
  const [form, setForm] = useState(() => (editing ? null : blankForm(categories)));
  useEffect(() => { if (it) setForm(formFromItem(it)); }, [it]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target?.type === 'checkbox' ? e.target.checked : e.target.value }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name, price: Number(form.price), costPrice: Number(form.costPrice) || 0, categoryId: form.categoryId || undefined,
        taxRate: Number(form.taxRate), foodType: form.foodType, spicyLevel: Number(form.spicyLevel),
        prepTimeMins: Number(form.prepTimeMins), description: form.description || undefined,
        isRecommended: form.isRecommended, isBestseller: form.isBestseller,
        variants: form.variants.map((v) => ({ ...v, priceDelta: Number(v.priceDelta) })),
        addonGroups: form.addonGroups.map((g) => ({ ...g, minSelect: Number(g.minSelect) || 0, maxSelect: Number(g.maxSelect) || 1, options: g.options.map((o) => ({ ...o, price: Number(o.price) })) })),
      };
      return editing ? request(api.patch(`/menu/${modal.id}`, payload)) : request(api.post('/menu', payload));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu'] }); toast.success('Saved'); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const addVariant = () => setForm((f) => ({ ...f, variants: [...f.variants, { name: '', priceDelta: 0, isDefault: f.variants.length === 0 }] }));
  const addGroup = () => setForm((f) => ({ ...f, addonGroups: [...f.addonGroups, { name: '', minSelect: 0, maxSelect: 1, isRequired: false, options: [] }] }));

  // Safe: every hook above has already run, so these returns can't change hook order.
  if (isError) {
    return (
      <Modal open onClose={onClose} title="Couldn't load item">
        <p className="text-sm text-zinc-500">{error?.message || 'Something went wrong.'}</p>
        <div className="mt-4 flex justify-end"><Button variant="ghost" onClick={onClose}>Close</Button></div>
      </Modal>
    );
  }
  if (!form) return <Modal open onClose={onClose} title="Loading…"><Skeleton className="h-40" /></Modal>;

  return (
    <Modal open onClose={onClose} title={editing ? 'Edit item' : 'Add item'} className="max-h-[88vh] overflow-y-auto max-w-2xl">
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name" required value={form.name} onChange={set('name')} className="col-span-2" />
          <Input label="Sell price (₹)" type="number" required value={form.price} onChange={set('price')} />
          <Input label="Cost price (₹)" type="number" value={form.costPrice} onChange={set('costPrice')} placeholder="0" />
          <Input label="Tax %" type="number" value={form.taxRate} onChange={set('taxRate')} />
          {Number(form.price) > 0 && Number(form.costPrice) > 0 && (
            <div className="col-span-2 -mt-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              Margin: <b>₹{(Number(form.price) - Number(form.costPrice)).toFixed(2)}</b> per unit
              {' '}({Math.round(((Number(form.price) - Number(form.costPrice)) / Number(form.price)) * 100)}%)
            </div>
          )}
          <Select label="Category" value={form.categoryId} onChange={set('categoryId')}>
            <option value="">Uncategorized</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Food type" value={form.foodType} onChange={set('foodType')}>
            <option value="VEG">Veg</option><option value="NON_VEG">Non-veg</option><option value="EGG">Egg</option><option value="VEGAN">Vegan</option>
          </Select>
          <Input label="Spicy (0-3)" type="number" min={0} max={3} value={form.spicyLevel} onChange={set('spicyLevel')} />
          <Input label="Prep (min)" type="number" value={form.prepTimeMins} onChange={set('prepTimeMins')} />
        </div>
        <Textarea label="Description" rows={2} value={form.description} onChange={set('description')} />
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isRecommended} onChange={set('isRecommended')} /> Recommended</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isBestseller} onChange={set('isBestseller')} /> Bestseller</label>
        </div>

        {/* Variants */}
        <Repeater title="Variants (Small / Large …)" onAdd={addVariant}>
          {form.variants.map((v, i) => (
            <div key={i} className="flex gap-2">
              <input placeholder="Name" value={v.name} onChange={(e) => setForm((f) => { const a = [...f.variants]; a[i].name = e.target.value; return { ...f, variants: a }; })} className="h-10 flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm" />
              <input placeholder="+₹" type="number" value={v.priceDelta} onChange={(e) => setForm((f) => { const a = [...f.variants]; a[i].priceDelta = e.target.value; return { ...f, variants: a }; })} className="h-10 w-20 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm" />
              <button type="button" onClick={() => setForm((f) => ({ ...f, variants: f.variants.filter((_, x) => x !== i) }))} className="px-2 text-red-500"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </Repeater>

        {/* Add-on groups */}
        <Repeater title="Add-on groups" onAdd={addGroup}>
          {form.addonGroups.map((g, gi) => (
            <div key={gi} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
              <div className="flex gap-2">
                <input placeholder="Group name (e.g. Toppings)" value={g.name} onChange={(e) => setForm((f) => { const a = [...f.addonGroups]; a[gi].name = e.target.value; return { ...f, addonGroups: a }; })} className="h-10 flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm" />
                <input placeholder="max" type="number" value={g.maxSelect} onChange={(e) => setForm((f) => { const a = [...f.addonGroups]; a[gi].maxSelect = e.target.value; return { ...f, addonGroups: a }; })} className="h-10 w-16 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 text-sm" />
                <button type="button" onClick={() => setForm((f) => ({ ...f, addonGroups: f.addonGroups.filter((_, x) => x !== gi) }))} className="px-2 text-red-500"><X className="h-4 w-4" /></button>
              </div>
              {g.options.map((o, oi) => (
                <div key={oi} className="flex gap-2 pl-4">
                  <input placeholder="Option" value={o.name} onChange={(e) => setForm((f) => { const a = [...f.addonGroups]; a[gi].options[oi].name = e.target.value; return { ...f, addonGroups: a }; })} className="h-9 flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm" />
                  <input placeholder="₹" type="number" value={o.price} onChange={(e) => setForm((f) => { const a = [...f.addonGroups]; a[gi].options[oi].price = e.target.value; return { ...f, addonGroups: a }; })} className="h-9 w-16 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 text-sm" />
                  <button type="button" onClick={() => setForm((f) => { const a = [...f.addonGroups]; a[gi].options = a[gi].options.filter((_, x) => x !== oi); return { ...f, addonGroups: a }; })} className="px-1 text-red-500"><X className="h-4 w-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => setForm((f) => { const a = [...f.addonGroups]; a[gi].options.push({ name: '', price: 0 }); return { ...f, addonGroups: a }; })} className="ml-4 text-xs text-brand-600">+ add option</button>
            </div>
          ))}
        </Repeater>

        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={mutation.isPending}>Save</Button></div>
      </form>
    </Modal>
  );
}

function Repeater({ title, onAdd, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">{title}</span><button type="button" onClick={onAdd} className="text-sm text-brand-600">+ Add</button></div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function CategoryModal({ categories, onClose }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const create = useMutation({ mutationFn: () => request(api.post('/categories', { name })), onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setName(''); toast.success('Added'); } });
  const del = useMutation({ mutationFn: (id) => api.delete(`/categories/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Deleted'); } });
  return (
    <Modal open onClose={onClose} title="Manage categories">
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" className="flex-1" />
        <Button onClick={() => name.trim() && create.mutate()} loading={create.isPending}>Add</Button>
      </div>
      <div className="mt-4 space-y-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5">
            <span>{c.name} <span className="text-xs text-zinc-400">({c.item_count} items)</span></span>
            <button onClick={() => del.mutate(c.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
