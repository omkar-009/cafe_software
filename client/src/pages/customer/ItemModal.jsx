import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Modal, Button } from '@/components/ui';
import { useCart } from '@/store/cart';

export default function ItemModal({ item, symbol, onClose }) {
  const add = useCart((s) => s.add);
  const [variantId, setVariantId] = useState(null);
  const [addonIds, setAddonIds] = useState([]);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!item) return;
    const def = item.variants?.find((v) => v.is_default) || item.variants?.[0];
    setVariantId(def?.id || null);
    setAddonIds([]); setQty(1); setNote('');
  }, [item]);

  const options = useMemo(() => {
    const opts = [];
    (item?.addonGroups || []).forEach((g) => g.options.forEach((o) => opts.push(o)));
    return opts;
  }, [item]);

  if (!item) return null;

  const variant = item.variants?.find((v) => v.id === variantId);
  const unitPrice = Number(item.price) + Number(variant?.price_delta || 0);
  const addonsTotal = addonIds.reduce((s, id) => s + Number(options.find((o) => o.id === id)?.price || 0), 0);
  const total = (unitPrice + addonsTotal) * qty;

  const toggleAddon = (group, optId) => {
    setAddonIds((prev) => {
      if (prev.includes(optId)) return prev.filter((x) => x !== optId);
      const inGroup = group.options.filter((o) => prev.includes(o.id));
      if (group.max_select === 1) return [...prev.filter((x) => !group.options.some((o) => o.id === x)), optId];
      if (inGroup.length >= group.max_select) { toast.error(`Choose up to ${group.max_select}`); return prev; }
      return [...prev, optId];
    });
  };

  const submit = () => {
    // Validate required groups
    for (const g of item.addonGroups || []) {
      const chosen = g.options.filter((o) => addonIds.includes(o.id)).length;
      if (g.is_required && chosen < (g.min_select || 1)) return toast.error(`Select ${g.name}`);
    }
    add({
      menuItemId: item.id, name: item.name, variantId: variantId || null,
      variantName: variant?.name || null, addonOptionIds: addonIds,
      addons: addonIds.map((id) => { const o = options.find((x) => x.id === id); return { name: o.name, price: Number(o.price) }; }),
      unitPrice, quantity: qty, note: note.trim(),
    });
    toast.success(`${item.name} added`);
    onClose();
  };

  return (
    <Modal open={!!item} onClose={onClose} title={item.name} className="max-h-[85vh] overflow-y-auto">
      {item.description && <p className="mb-4 text-sm text-zinc-500">{item.description}</p>}

      {item.variants?.length > 0 && (
        <Group title="Choose size">
          {item.variants.map((v) => (
            <Row key={v.id} active={variantId === v.id} onClick={() => setVariantId(v.id)}
              label={v.name} price={v.price_delta > 0 ? `+${symbol}${Number(v.price_delta).toFixed(2)}` : 'Included'} radio />
          ))}
        </Group>
      )}

      {(item.addonGroups || []).map((g) => (
        <Group key={g.id} title={g.name} hint={g.max_select > 1 ? `up to ${g.max_select}` : null}>
          {g.options.map((o) => (
            <Row key={o.id} active={addonIds.includes(o.id)} onClick={() => toggleAddon(g, o.id)}
              label={o.name} price={`+${symbol}${Number(o.price).toFixed(2)}`} />
          ))}
        </Group>
      ))}

      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)…"
        className="mt-2 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" rows={2} />

      <div className="mt-5 flex items-center gap-3">
        <div className="flex items-center rounded-xl border border-zinc-300 dark:border-zinc-700">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-11 w-11 text-lg font-bold">−</button>
          <span className="w-8 text-center font-bold">{qty}</span>
          <button onClick={() => setQty((q) => q + 1)} className="h-11 w-11 text-lg font-bold">+</button>
        </div>
        <Button onClick={submit} size="lg" className="flex-1">Add · {symbol}{total.toFixed(2)}</Button>
      </div>
    </Modal>
  );
}

function Group({ title, hint, children }) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="font-semibold">{title}</h4>
        {hint && <span className="text-xs text-zinc-400">{hint}</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ active, label, price, radio, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${active ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-zinc-200 dark:border-zinc-800'}`}>
      <span className="flex items-center gap-2.5">
        <span className={`grid h-5 w-5 place-items-center ${radio ? 'rounded-full' : 'rounded-md'} border-2 ${active ? 'border-brand-500 bg-brand-500' : 'border-zinc-300 dark:border-zinc-600'}`}>
          {active && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>
        {label}
      </span>
      <span className="text-zinc-500">{price}</span>
    </button>
  );
}
