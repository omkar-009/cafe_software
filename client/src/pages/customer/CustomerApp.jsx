import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import { fmtDateTime } from '@/lib/format';
import toast from 'react-hot-toast';
import { Search, Leaf, ShoppingBag, AlertTriangle, ReceiptText, X, ChevronRight, Ticket } from 'lucide-react';
import api, { request } from '@/lib/api';
import { useCart } from '@/store/cart';
import { useOrderHistory } from '@/store/orders';
import { Spinner, Badge, EmptyState, Skeleton } from '@/components/ui';
import ThemeToggle from '@/components/ThemeToggle';
import MenuItemCard from './MenuItemCard';
import ItemModal from './ItemModal';
import CartSheet from './CartSheet';
import OrderTracking from './OrderTracking';

export default function CustomerApp() {
  const [params] = useSearchParams();
  const d = params.get('d');
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [viewOrderId, setViewOrderId] = useState(null);
  const [ordersOpen, setOrdersOpen] = useState(false);

  const count = useCart((s) => s.count());
  const subtotal = useCart((s) => s.subtotal());
  const addHistory = useOrderHistory((s) => s.add);
  const allOrders = useOrderHistory((s) => s.orders);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['resolve', d],
    queryFn: () => request(api.get(`/public/resolve?d=${encodeURIComponent(d)}`)),
    enabled: !!d,
    retry: false,
  });

  const symbol = data?.restaurant?.currencySymbol || '₹';

  const filtered = useMemo(() => {
    let items = data?.items || [];
    if (activeCat !== 'all') items = items.filter((i) => i.category_id === activeCat);
    if (vegOnly) items = items.filter((i) => i.food_type === 'VEG' || i.food_type === 'VEGAN');
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q));
    }
    return items;
  }, [data, activeCat, vegOnly, search]);

  if (!d) return <CenterMessage icon={AlertTriangle} title="Invalid QR code" text="Please scan the QR code on your table." />;
  if (isLoading) return <MenuSkeleton />;
  if (isError) return <CenterMessage icon={AlertTriangle} title="Couldn't load menu" text={error?.message || 'This QR may have expired.'} />;

  const { restaurant, table, categories } = data;
  const myOrders = allOrders.filter((o) => o.tenantSlug === restaurant.slug);

  // A specific order's live tracking view.
  if (viewOrderId) {
    const entry = myOrders.find((o) => o.orderId === viewOrderId);
    return (
      <OrderTracking
        d={entry?.d || d}
        orderId={viewOrderId}
        restaurant={restaurant}
        onBack={() => setViewOrderId(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-28">
      {/* Header / branding */}
      <div className="relative aurora">
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          {myOrders.length > 0 && (
            <button onClick={() => setOrdersOpen(true)}
              className="flex items-center gap-1.5 rounded-xl glass px-3 py-2 text-sm font-semibold shadow-glass">
              <ReceiptText className="h-4 w-4" /> My Orders
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-[11px] text-white">{myOrders.length}</span>
            </button>
          )}
          <ThemeToggle />
        </div>
        <div className="mx-auto max-w-2xl px-5 pb-6 pt-8">
          <div className="flex items-center gap-4">
            {restaurant.logoUrl
              ? <img src={restaurant.logoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover shadow-glass" />
              : <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-500 text-2xl font-black text-white shadow-glow">{restaurant.name[0]}</div>}
            <div>
              <h1 className="text-2xl font-extrabold leading-tight">{restaurant.name}</h1>
              {table?.tableNumber && <Badge tone="brand" className="mt-1">Table {table.tableNumber}</Badge>}
            </div>
          </div>
          {restaurant.menuHeader && (
            <p className="mt-4 rounded-xl glass px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-300">{restaurant.menuHeader}</p>
          )}
        </div>
      </div>

      {/* Available offers (active, non-expired coupons) */}
      {data.offers?.length > 0 && (
        <div className="mx-auto max-w-2xl px-5 pt-4">
          <p className="mb-2 text-sm font-bold">Available offers</p>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {data.offers.map((o) => {
              const off = o.type === 'PERCENTAGE' ? `${Number(o.value)}% OFF` : `${symbol}${Number(o.value)} OFF`;
              const bits = [];
              if (o.type === 'PERCENTAGE' && Number(o.max_discount) > 0) bits.push(`up to ${symbol}${Number(o.max_discount)}`);
              if (Number(o.min_order_amount) > 0) bits.push(`min ${symbol}${Number(o.min_order_amount)}`);
              return (
                <button key={o.code}
                  onClick={() => { navigator.clipboard?.writeText(o.code); toast.success(`Copied “${o.code}”`); }}
                  className="flex min-w-[220px] shrink-0 items-center gap-3 rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/60 dark:bg-brand-500/10 p-3 text-left">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500 text-white"><Ticket className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-brand-600 dark:text-brand-400">{off}</p>
                    {bits.length > 0 && <p className="text-xs text-zinc-500">{bits.join(' · ')}</p>}
                    <p className="mt-0.5 font-mono text-xs font-bold">{o.code} · tap to copy</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search + filters (sticky) */}
      <div className="sticky top-0 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-5 py-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dishes…"
                className="h-11 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <button onClick={() => setVegOnly((v) => !v)}
              className={`flex h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition ${vegOnly ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'border-zinc-300 dark:border-zinc-700'}`}>
              <Leaf className="h-4 w-4" /> Veg
            </button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip active={activeCat === 'all'} onClick={() => setActiveCat('all')}>All</Chip>
            {categories.map((c) => (
              <Chip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>{c.name}</Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Menu grid */}
      <div className="mx-auto max-w-2xl px-5 py-5">
        {filtered.length === 0 ? (
          <EmptyState icon={Search} title="No dishes found" description="Try a different search or category." />
        ) : (
          <div className="grid gap-3">
            {filtered.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <MenuItemCard item={item} symbol={symbol} onClick={() => setSelectedItem(item)} />
              </motion.div>
            ))}
          </div>
        )}
        {restaurant.menuFooter && <p className="mt-8 text-center text-xs text-zinc-400">{restaurant.menuFooter}</p>}
      </div>

      {/* Floating cart bar */}
      {count > 0 && (
        <motion.button initial={{ y: 80 }} animate={{ y: 0 }} onClick={() => setCartOpen(true)}
          className="fixed inset-x-0 bottom-4 z-30 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-brand-500 px-5 py-3.5 text-white shadow-glass-lg mx-5">
          <span className="flex items-center gap-2 font-semibold"><ShoppingBag className="h-5 w-5" /> {count} item{count > 1 ? 's' : ''}</span>
          <span className="font-bold">{symbol}{subtotal.toFixed(2)} · View Cart →</span>
        </motion.button>
      )}

      <ItemModal item={selectedItem} symbol={symbol} onClose={() => setSelectedItem(null)} />
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} d={d} restaurant={restaurant}
        onPlaced={(res) => {
          setCartOpen(false);
          addHistory({ orderId: res.orderId, orderNumber: res.orderNumber, tenantSlug: restaurant.slug, tenantName: restaurant.name, d });
          setViewOrderId(res.orderId);
        }} />

      <OrdersDrawer open={ordersOpen} onClose={() => setOrdersOpen(false)} orders={myOrders}
        onOpen={(id) => { setOrdersOpen(false); setViewOrderId(id); }} />
    </div>
  );
}

function OrdersDrawer({ open, onClose, orders, onOpen }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="glass-strong absolute inset-x-0 bottom-0 z-10 max-h-[80vh] overflow-y-auto rounded-t-3xl p-5">
            <div className="mx-auto max-w-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">My Orders</h2>
                <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-2">
                {orders.map((o) => (
                  <button key={o.orderId} onClick={() => onOpen(o.orderId)}
                    className="flex w-full items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <div>
                      <p className="font-bold">{o.orderNumber}</p>
                      <p className="text-xs text-zinc-400">{fmtDateTime(o.placedAt)}</p>
                    </div>
                    <span className="flex items-center gap-1 text-sm text-brand-600">Track <ChevronRight className="h-4 w-4" /></span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Chip({ active, children, ...props }) {
  return (
    <button {...props} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${active ? 'bg-brand-500 text-white shadow-glow' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'}`}>
      {children}
    </button>
  );
}

function CenterMessage({ icon: Icon, title, text }) {
  return (
    <div className="grid min-h-screen place-items-center aurora p-6 text-center">
      <div>
        <Icon className="mx-auto h-12 w-12 text-brand-500" />
        <h1 className="mt-4 text-xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{text}</p>
      </div>
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div className="mx-auto max-w-2xl p-5">
      <div className="flex items-center gap-4"><Skeleton className="h-16 w-16 rounded-2xl" /><div className="space-y-2"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-20" /></div></div>
      <div className="mt-8 grid gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
    </div>
  );
}
