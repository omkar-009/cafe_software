import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Palette, Image as ImageIcon, Store } from 'lucide-react';
import api, { request } from '@/lib/api';
import { Card, Input, Textarea, Button, Skeleton } from '@/components/ui';

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
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (payload) => request(api.patch('/tenants/me', payload)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant-me'] }); toast.success('Branding saved'); },
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Restaurant name" value={form.name} onChange={set('name')} />
            <Input label="Brand color" type="text" value={form.brandColor} onChange={set('brandColor')} placeholder="#f97316" />
            <Input label="Logo image URL" value={form.logoUrl} onChange={set('logoUrl')} placeholder="https://…/logo.png" />
            <Input label="Cover image URL" value={form.coverUrl} onChange={set('coverUrl')} placeholder="https://…/cover.jpg" />
            <Input label="GST number" value={form.gstNumber} onChange={set('gstNumber')} />
            <Input label="Currency" value={form.currency} onChange={set('currency')} maxLength={3} />
          </div>
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
