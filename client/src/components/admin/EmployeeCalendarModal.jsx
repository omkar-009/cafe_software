import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import api, { request } from '@/lib/api';
import { Modal, Button, Spinner, Input } from '@/components/ui';

const STATUSES = [
  { key: 'PRESENT', label: 'Present', color: '#16a34a' },
  { key: 'ABSENT', label: 'Absent', color: '#ef4444' },
  { key: 'HALF_DAY', label: 'Half day', color: '#f59e0b' },
  { key: 'LEAVE', label: 'Leave', color: '#3b82f6' },
  { key: 'WEEKLY_OFF', label: 'Weekly off', color: '#a1a1aa' },
];
const COLOR = Object.fromEntries(STATUSES.map((s) => [s.key, s.color]));
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const hhmm = (t) => (t ? dayjs(t).format('HH:mm') : '');

/**
 * Per-employee monthly attendance calendar. Select one or many days, then apply
 * a status (bulk). With a single day selected you can also fix check-in/out
 * times for a forgotten punch.
 */
export default function EmployeeCalendarModal({ user, initialMonth, onClose }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(initialMonth || dayjs().format('YYYY-MM'));
  const [selected, setSelected] = useState(new Set());
  const [times, setTimes] = useState({ checkIn: '', checkOut: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['staff-month', user.id, month],
    queryFn: () => request(api.get(`/attendance/staff/${user.id}?month=${month}`)),
  });

  const byDate = useMemo(() => {
    const m = new Map();
    (data?.days || []).forEach((d) => m.set(dayjs(d.work_date).format('YYYY-MM-DD'), d));
    return m;
  }, [data]);

  const start = dayjs(`${month}-01`);
  const daysInMonth = start.daysInMonth();
  const lead = start.day();
  const today = dayjs().format('YYYY-MM-DD');
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const changeMonth = (delta) => { setMonth(start.add(delta, 'month').format('YYYY-MM')); setSelected(new Set()); };

  const toggleDay = (dateStr) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr);
      // when exactly one day is selected, prefill its times for editing
      const arr = [...next];
      if (arr.length === 1) { const rec = byDate.get(arr[0]); setTimes({ checkIn: hhmm(rec?.check_in), checkOut: hhmm(rec?.check_out) }); }
      else setTimes({ checkIn: '', checkOut: '' });
      return next;
    });
  };

  const apply = useMutation({
    mutationFn: (status) => {
      const dates = [...selected];
      const single = dates.length === 1;
      if (single && (times.checkIn || times.checkOut)) {
        const d = dates[0];
        const toIso = (t) => (t ? new Date(`${d}T${t}:00`).toISOString() : undefined);
        return request(api.post('/attendance/mark', {
          userId: user.id, workDate: d, status,
          checkIn: toIso(times.checkIn), checkOut: toIso(times.checkOut),
        }));
      }
      return request(api.post('/attendance/mark-bulk', { userId: user.id, dates, status }));
    },
    onSuccess: (_r, status) => {
      qc.invalidateQueries({ queryKey: ['staff-month', user.id, month] });
      qc.invalidateQueries({ queryKey: ['attendance-summary'] });
      qc.invalidateQueries({ queryKey: ['attendance-register'] });
      toast.success(`Marked ${selected.size} day(s) ${status.replace('_', ' ').toLowerCase()}`);
      setSelected(new Set()); setTimes({ checkIn: '', checkOut: '' });
    },
    onError: (e) => toast.error(e.message),
  });

  const selectWorkingDays = () => {
    const s = new Set();
    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = start.date(d);
      if (date.day() !== 0 && date.isAfter(dayjs()) === false) s.add(date.format('YYYY-MM-DD')); // Mon–Sat up to today
    }
    setSelected(s); setTimes({ checkIn: '', checkOut: '' });
  };

  const onlyOne = selected.size === 1;

  return (
    <Modal open onClose={onClose} title={`Attendance · ${user.fullName}`} className="max-w-xl">
      {/* Month nav */}
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)}><ChevronLeft className="h-5 w-5" /></Button>
        <span className="font-bold">{start.format('MMMM YYYY')}</span>
        <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} disabled={start.add(1, 'month').isAfter(dayjs(), 'month')}><ChevronRight className="h-5 w-5" /></Button>
      </div>

      {isLoading ? <div className="grid h-64 place-items-center"><Spinner className="h-8 w-8" /></div> : (
        <>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => <div key={w} className="py-1 text-xs font-semibold text-zinc-400">{w}</div>)}
            {cells.map((day, i) => {
              if (!day) return <div key={`b${i}`} />;
              const dateStr = start.date(day).format('YYYY-MM-DD');
              const rec = byDate.get(dateStr);
              const isSel = selected.has(dateStr);
              const isFuture = start.date(day).isAfter(dayjs(), 'day');
              const color = rec ? COLOR[rec.status] : null;
              return (
                <button key={dateStr} disabled={isFuture} onClick={() => toggleDay(dateStr)}
                  className={`relative aspect-square rounded-lg border text-sm transition
                    ${isSel ? 'border-brand-500 ring-2 ring-brand-400' : 'border-zinc-200 dark:border-zinc-800'}
                    ${isFuture ? 'opacity-30' : 'hover:border-brand-400'}
                    ${dateStr === today ? 'font-extrabold' : ''}`}
                  style={color ? { background: `${color}22` } : undefined}>
                  <span className="absolute left-1 top-0.5 text-xs">{day}</span>
                  {color && <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full" style={{ background: color }} />}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
            {STATUSES.map((s) => <span key={s.key} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>)}
          </div>

          {/* Action bar */}
          <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
            {selected.size === 0 ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">Tap days to select, then choose a status.</p>
                <Button variant="outline" size="sm" onClick={selectWorkingDays}>Select Mon–Sat</Button>
              </div>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">{selected.size} day{selected.size > 1 ? 's' : ''} selected</span>
                  <button onClick={() => { setSelected(new Set()); setTimes({ checkIn: '', checkOut: '' }); }} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-red-500"><X className="h-3.5 w-3.5" /> Clear</button>
                </div>
                {onlyOne && (
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <label className="text-xs text-zinc-500">Check-in<Input type="time" value={times.checkIn} onChange={(e) => setTimes((t) => ({ ...t, checkIn: e.target.value }))} className="mt-1" /></label>
                    <label className="text-xs text-zinc-500">Check-out<Input type="time" value={times.checkOut} onChange={(e) => setTimes((t) => ({ ...t, checkOut: e.target.value }))} className="mt-1" /></label>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <button key={s.key} onClick={() => apply.mutate(s.key)} disabled={apply.isPending}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: s.color }}>
                      {s.key === 'PRESENT' && onlyOne && (times.checkIn || times.checkOut) ? <Clock className="h-3.5 w-3.5" /> : null}
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
