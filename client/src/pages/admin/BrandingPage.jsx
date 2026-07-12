import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Palette, Image as ImageIcon, Store, ChefHat } from 'lucide-react';
import api, { request } from '@/lib/api';
import { Card, Input, Textarea, Button, Skeleton } from '@/components/ui';
import ImageUpload from '@/components/ImageUpload';

export default function BrandingPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['tenant-me'], queryFn: () => request(api.get('/tenants/me')) });
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (data?.tenant) {
      const t = data.tenant;
      setForm({
        name: t.name || '', logoUrl: t.logo_url || '', coverUrl: t.cover_url || '',
        brandColor: t.brand_color || '#f97316', menuHeader: t.menu_header || '', menuFooter: t.menu_footer || '',
        gstNumber: t.gst_number || '', currency: t.currency || 'INR',
        // Preserve the full settings object so saving doesn't wipe other keys.
        settings: t.settings || {},
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (payload) => request(api.patch('/tenants/me', payload)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant-me'] }); toast.success('Settings saved'); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !form) return <div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-96 rounded-2xl lg:col-span-2" /><Skeleton className="h-96 rounded-2xl" /></div>;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => { e.preventDefault(); save.mutate(form); };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <h3 className="mb-4 flex items-center gap-2 font-bold"><Store className="h-5 w-5 text-brand-500" /> Restaurant identity</h3>
          <div className="mb-4 flex flex-wrap gap-6">
            <ImageUpload label="Cafe logo" value={form.logoUrl} onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))} />
            <ImageUpload label="Cover image" aspect="wide" value={form.coverUrl} onChange={(url) => setForm((f) => ({ ...f, coverUrl: url }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Restaurant name" value={form.name} onChange={set('name')} />
            <Input label="Brand color" type="text" value={form.brandColor} onChange={set('brandColor')} placeholder="#f97316" />
            <Input label="Logo image URL (optional)" value={form.logoUrl} onChange={set('logoUrl')} placeholder="or paste a URL" />
            <Input label="Cover image URL (optional)" value={form.coverUrl} onChange={set('coverUrl')} placeholder="or paste a URL" />
            <Input label="GST number" value={form.gstNumber} onChange={set('gstNumber')} />
            <Input label="Currency" value={form.currency} onChange={set('currency')} maxLength={3} />
          </div>
        </Card>

        <Card>
          <h3 className="mb-1 flex items-center gap-2 font-bold"><ChefHat className="h-5 w-5 text-brand-500" /> Order flow</h3>
          <p className="mb-4 text-sm text-zinc-500">Choose how new customer orders enter the kitchen.</p>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div>
              <p className="font-semibold">Auto-start in “Preparing”</p>
              <p className="text-sm text-zinc-500">Skip the manual “Accept” step — new orders go straight to the kitchen as Preparing.</p>
            </div>
            <button type="button"
              onClick={() => setForm((f) => ({ ...f, settings: { ...f.settings, autoStartPreparing: !f.settings?.autoStartPreparing } }))}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${form.settings?.autoStartPreparing ? 'bg-brand-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${form.settings?.autoStartPreparing ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </label>
          <p className="mt-3 text-xs text-zinc-400">When off: kitchen manually moves orders Accepted → Preparing → Ready.</p>
        </Card>

        <Card>
          <h3 className="mb-4 flex items-center gap-2 font-bold"><Palette className="h-5 w-5 text-brand-500" /> Menu header &amp; footer</h3>
          <p className="mb-4 text-sm text-zinc-500">Shown at the top and bottom of your QR menu for customers.</p>
          <div className="space-y-4">
            <Textarea label="Menu header" rows={3} value={form.menuHeader} onChange={set('menuHeader')} placeholder="Welcome to our cafe ☕" />
            <Textarea label="Menu footer" rows={3} value={form.menuFooter} onChange={set('menuFooter')} placeholder="Thank you for dining with us!" />
          </div>
          <div className="mt-5 flex justify-end">
            <Button type="submit" loading={save.isPending}>Save changes</Button>
          </div>
        </Card>
      </div>

      {/* Live preview */}
      <div className="lg:col-span-1">
        <p className="mb-2 text-sm font-medium text-zinc-500">Live menu preview</p>
        <div className="card overflow-hidden p-0">
          <div className="aurora p-5">
            <div className="flex items-center gap-3">
              {form.logoUrl
                ? <img src={form.logoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                : <div className="grid h-14 w-14 place-items-center rounded-2xl text-xl font-black text-white" style={{ background: form.brandColor }}>{form.name?.[0] || 'R'}</div>}
              <div><p className="text-lg font-extrabold">{form.name || 'Restaurant name'}</p><span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: form.brandColor }}>Table 08</span></div>
            </div>
            {form.menuHeader && <p className="mt-3 rounded-xl glass px-3 py-2 text-sm">{form.menuHeader}</p>}
          </div>
          <div className="space-y-2 p-5">
            <div className="flex items-center gap-2"><ImageIcon className="h-8 w-8 text-zinc-300" /><div><p className="text-sm font-bold">Sample Dish</p><p className="text-xs text-zinc-400">₹220</p></div></div>
            {form.menuFooter && <p className="pt-4 text-center text-xs text-zinc-400">{form.menuFooter}</p>}
          </div>
        </div>
      </div>
    </form>
  );
}
