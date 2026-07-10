import { Flame, Star, Plus } from 'lucide-react';
import { Badge } from '@/components/ui';

const FOOD_MARK = {
  VEG: 'border-emerald-500', NON_VEG: 'border-red-500', EGG: 'border-amber-500', VEGAN: 'border-emerald-600',
};
const FOOD_DOT = {
  VEG: 'bg-emerald-500', NON_VEG: 'bg-red-500', EGG: 'bg-amber-500', VEGAN: 'bg-emerald-600',
};

export default function MenuItemCard({ item, symbol, onClick }) {
  const out = item.is_out_of_stock || !item.is_available;
  const hasOptions = item.variants?.length || item.addonGroups?.length;

  return (
    <div className={`card flex gap-4 p-4 ${out ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`grid h-4 w-4 place-items-center rounded-sm border-2 ${FOOD_MARK[item.food_type]}`}>
            <span className={`h-2 w-2 rounded-full ${FOOD_DOT[item.food_type]}`} />
          </span>
          {item.is_bestseller && <Badge tone="amber"><Star className="h-3 w-3" /> Bestseller</Badge>}
          {item.is_recommended && <Badge tone="brand">Recommended</Badge>}
        </div>
        <h3 className="mt-1.5 font-bold leading-tight">{item.name}</h3>
        <p className="mt-0.5 font-semibold text-zinc-700 dark:text-zinc-300">{symbol}{Number(item.price).toFixed(2)}</p>
        {item.description && <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{item.description}</p>}
        <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-400">
          {item.spicy_level > 0 && <span className="flex items-center gap-0.5 text-red-400">{Array.from({ length: item.spicy_level }).map((_, i) => <Flame key={i} className="h-3 w-3" />)}</span>}
          {item.prep_time_mins ? <span>{item.prep_time_mins} min</span> : null}
        </div>
      </div>

      <div className="flex w-28 flex-col items-center justify-center">
        <div className="relative">
          {item.images?.[0]?.url
            ? <img src={item.images[0].url} alt="" className="h-24 w-28 rounded-xl object-cover" />
            : <div className="grid h-24 w-28 place-items-center rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 dark:from-zinc-800 dark:to-zinc-700 text-2xl">🍽️</div>}
          {out ? (
            <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/50 text-xs font-bold text-white">Out of stock</span>
          ) : (
            <button onClick={onClick}
              className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-white dark:bg-zinc-800 px-4 py-1.5 text-sm font-bold text-brand-600 shadow-glass border border-zinc-200 dark:border-zinc-700">
              ADD <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {hasOptions && !out && <span className="mt-3 text-[10px] text-zinc-400">customizable</span>}
      </div>
    </div>
  );
}
