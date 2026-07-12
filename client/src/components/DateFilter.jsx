import { DATE_PRESETS } from '@/lib/dateRange';
import { Select } from '@/components/ui';

/**
 * Date-range filter: a preset dropdown plus two date inputs when "Custom" is
 * chosen. Controlled via `value` (preset key) + `custom` ({from,to} strings).
 *
 *   extraOptions: optional [{ key, label }] prepended (e.g. a "Live queue" mode)
 */
export default function DateFilter({ value, onChange, custom = {}, onCustomChange, extraOptions = [], className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-40">
        {extraOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        {DATE_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </Select>
      {value === 'custom' && (
        <div className="flex items-center gap-1.5">
          <input type="date" value={custom.from || ''} onChange={(e) => onCustomChange({ ...custom, from: e.target.value })}
            className="h-10 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 text-sm" />
          <span className="text-zinc-400">→</span>
          <input type="date" value={custom.to || ''} onChange={(e) => onCustomChange({ ...custom, to: e.target.value })}
            className="h-10 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 text-sm" />
        </div>
      )}
    </div>
  );
}
