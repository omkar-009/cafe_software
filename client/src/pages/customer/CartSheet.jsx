import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { X, Trash2, Tag, Minus, Plus } from 'lucide-react';
import api, { request } from '@/lib/api';
import { useCart } from '@/store/cart';
import { Button } from '@/components/ui';

export default function CartSheet({ open, onClose, d, restaurant, onPlaced }) {
  const { lines, setQty, remove, subtotal, toApiCart, clear } = useCart();
  const symbol = restaurant.currencySymbol || '₹';
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [placing, setPlacing] = useState(false);

  const sub = subtotal();
  const discount = applied?.discount || 0;
  const total = Math.max(0, sub - discount);

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      const res = await request(api.post('/public/coupon/preview', { d, code: coupon.trim(), subtotal: sub }));
      setApplied(res);
      toast.success(`Coupon applied — ${symbol}${res.discount} off`);
    } catch (err) {
      setApplied(null);
      toast.error(err.message || 'Invalid coupon');
    }
  };

  const place = async () => {
    setPlacing(true);
    try {
      const res = await request(api.post('/public/orders', {
        d, cart: toApiCart(),
        couponCode: applied ? coupon.trim() : undefined,
        customer: (name || phone) ? { name: name.trim() || undefined, phone: phone.trim() || undefined } : undefined,
      }));
      clear();
      toast.success(`Order ${res.orderNumber} placed!`);
      onPlaced(res.orderId);
    } catch (err) {
      toast.error(err.message || 'Could not place order');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="glass-strong absolute inset-x-0 bottom-0 z-10 max-h-[90vh] overflow-y-auto rounded-t-3xl p-5">
            <div className="mx-auto max-w-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">Your Order</h2>
                <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
              </div>

              {lines.length === 0 ? (
                <p className="py-10 text-center text-zinc-500">Your cart is empty.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {lines.map((l) => (
                      <div key={l.key} className="flex items-start gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{l.name}{l.variantName ? ` · ${l.variantName}` : ''}</p>
                          {l.addons?.length > 0 && <p className="text-xs text-zinc-400">{l.addons.map((a) => a.name).join(', ')}</p>}
                          {l.note && <p className="text-xs italic text-zinc-400">"{l.note}"</p>}
                          <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                            {symbol}{((l.unitPrice + (l.addons || []).reduce((a, x) => a + x.price, 0)) * l.quantity).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700">
                          <button onClick={() => setQty(l.key, l.quantity - 1)} className="grid h-8 w-8 place-items-center"><Minus className="h-3.5 w-3.5" /></button>
                          <span className="w-6 text-center text-sm font-bold">{l.quantity}</span>
                          <button onClick={() => setQty(l.key, l.quantity + 1)} className="grid h-8 w-8 place-items-center"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                        <button onClick={() => remove(l.key)} className="p-1 text-zinc-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>

                  {/* Coupon */}
                  <div className="mt-4 flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code"
                        className="h-11 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent pl-9 pr-3 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    </div>
                    <Button variant="outline" onClick={applyCoupon}>Apply</Button>
                  </div>

                  {/* Optional contact */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)"
                      className="h-11 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)"
                      className="h-11 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </div>

                  {/* Totals */}
                  <div className="mt-4 space-y-1.5 border-t border-zinc-200 dark:border-zinc-800 pt-4 text-sm">
                    <Row label="Subtotal" value={`${symbol}${sub.toFixed(2)}`} />
                    {discount > 0 && <Row label="Discount" value={`−${symbol}${discount.toFixed(2)}`} tone="text-emerald-600" />}
                    <p className="text-xs text-zinc-400">Taxes &amp; charges calculated at the restaurant.</p>
                    <div className="flex justify-between pt-1 text-lg font-bold"><span>Total</span><span>{symbol}{total.toFixed(2)}</span></div>
                  </div>

                  <Button size="lg" className="mt-4 w-full" loading={placing} onClick={place}>Place Order</Button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value, tone }) {
  return <div className="flex justify-between"><span className="text-zinc-500">{label}</span><span className={tone}>{value}</span></div>;
}
