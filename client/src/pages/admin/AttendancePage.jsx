import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { fmtTime } from '@/lib/format';
import { CalendarCheck, Download, Wallet, Clock } from 'lucide-react';
import api, { request } from '@/lib/api';
import { money } from '@/lib/cn';
import { Card, Button, Select, Badge, EmptyState, Skeleton } from '@/components/ui';
import StatCard from '@/components/admin/StatCard';
import EmployeeCalendarModal from '@/components/admin/EmployeeCalendarModal';

const STATUSES = ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'WEEKLY_OFF'];
const TONE = { PRESENT: 'green', ABSENT: 'red', HALF_DAY: 'amber', LEAVE: 'blue', WEEKLY_OFF: 'gray' };
const time = fmtTime;

export default function AttendancePage() {
  const [view, setView] = useState('register');
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold">Attendance</h2><p className="text-sm text-zinc-500">Daily register &amp; monthly payroll</p></div>
        <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-800 p-1">
          {['register', 'summary'].map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize ${view === v ? 'bg-brand-500 text-white' : 'text-zinc-500'}`}>
              {v === 'register' ? 'Daily register' : 'Monthly summary'}
            </button>
          ))}
        </div>
      </div>
      {view === 'register' ? <Register /> : <Summary />}
    </div>
  );
}

function Register() {
  const qc = useQueryClient();
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [calendar, setCalendar] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['attendance-register', date], queryFn: () => request(api.get(`/attendance/register?date=${date}`)) });

  const mark = useMutation({
    mutationFn: ({ userId, status }) => request(api.post('/attendance/mark', { userId, workDate: date, status })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance-register', date] }); toast.success('Marked'); },
    onError: (e) => toast.error(e.message),
  });

  const rows = data?.register || [];
  const present = rows.filter((r) => r.status === 'PRESENT').length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={dayjs().format('YYYY-MM-DD')}
          className="h-10 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm" />
        <span className="text-sm text-zinc-500">{present}/{rows.length} present</span>
      </div>
      {isLoading ? <Skeleton className="h-64 rounded-2xl" />
        : rows.length === 0 ? <Card><EmptyState icon={CalendarCheck} title="No staff" /></Card>
          : (
            <div className="overflow-x-auto rounded-2xl glass">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs uppercase text-zinc-500">
                  <tr><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">In</th><th className="px-4 py-3">Out</th><th className="px-4 py-3">Hours</th><th className="px-4 py-3">Status</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.user_id} className="border-b border-zinc-100 dark:border-zinc-800/50">
                      <td className="px-4 py-3 font-medium">
                        <button onClick={() => setCalendar({ id: r.user_id, fullName: r.full_name })} className="hover:text-brand-500 hover:underline">{r.full_name}</button>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{r.role.replace('RESTAURANT_', '')}</td>
                      <td className="px-4 py-3 tabular-nums">{time(r.check_in)}</td>
                      <td className="px-4 py-3 tabular-nums">{time(r.check_out)}</td>
                      <td className="px-4 py-3 tabular-nums">{r.worked_minutes ? `${Math.floor(r.worked_minutes / 60)}h ${r.worked_minutes % 60}m` : '—'}</td>
                      <td className="px-4 py-3">
                        <select value={r.status || ''} onChange={(e) => mark.mutate({ userId: r.user_id, status: e.target.value })}
                          className={`rounded-lg border-0 bg-transparent px-2 py-1 text-xs font-bold focus:ring-2 focus:ring-brand-400 ${r.status ? '' : 'text-zinc-400'}`}>
                          <option value="" disabled>Mark…</option>
                          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                        {r.status && <Badge tone={TONE[r.status]} className="ml-1">{r.status.replace('_', ' ')}</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      {calendar && <EmployeeCalendarModal user={calendar} initialMonth={dayjs(date).format('YYYY-MM')} onClose={() => setCalendar(null)} />}
    </div>
  );
}

function Summary() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [calendar, setCalendar] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['attendance-summary', month], queryFn: () => request(api.get(`/attendance/summary?month=${month}`)) });

  const post = useMutation({
    mutationFn: () => request(api.post('/attendance/post-salaries', { month })),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success(`Posted ${money(d.totalPayroll)} to Expenses`); },
    onError: (e) => toast.error(e.message),
  });

  const staff = data?.staff || [];
  const exportUrl = (fmt) => window.open(`/api/v1/attendance/summary/export?month=${month}&format=${fmt}`, '_blank');

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} max={dayjs().format('YYYY-MM')}
          className="h-10 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm" />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportUrl('xlsx')}><Download className="h-4 w-4" /> Excel</Button>
          <Button size="sm" onClick={() => confirm(`Post ${money(data?.totalPayroll || 0)} payroll for ${data?.month} to Expenses?`) && post.mutate()} loading={post.isPending}>
            <Wallet className="h-4 w-4" /> Post payroll to Expenses
          </Button>
        </div>
      </div>

      {isLoading ? <Skeleton className="h-64 rounded-2xl" /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Staff" value={staff.length} icon={CalendarCheck} tone="blue" />
            <StatCard label="Total present days" value={staff.reduce((s, r) => s + r.present, 0)} icon={CalendarCheck} tone="green" />
            <StatCard label="Total hours" value={`${Math.round(staff.reduce((s, r) => s + r.worked_hours, 0))}h`} icon={Clock} tone="amber" />
            <StatCard label="Est. payroll" value={money(data?.totalPayroll || 0)} icon={Wallet} tone="brand" sub={data?.month} />
          </div>
          <div className="overflow-x-auto rounded-2xl glass">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs uppercase text-zinc-500">
                <tr><th className="px-4 py-3">Staff</th><th className="px-3 py-3 text-center">Present</th><th className="px-3 py-3 text-center">Absent</th><th className="px-3 py-3 text-center">Half</th><th className="px-3 py-3 text-center">Leave</th><th className="px-3 py-3 text-center">Off</th><th className="px-3 py-3 text-right">Hours</th><th className="px-3 py-3 text-right">Salary</th><th className="px-4 py-3 text-right">Est. pay</th></tr>
              </thead>
              <tbody>
                {staff.map((r) => (
                  <tr key={r.user_id} onClick={() => setCalendar({ id: r.user_id, fullName: r.full_name })}
                    className="cursor-pointer border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-medium">{r.full_name} <span className="text-xs text-zinc-400">{r.role.replace('RESTAURANT_', '')}</span></td>
                    <td className="px-3 py-3 text-center font-semibold text-emerald-600">{r.present}</td>
                    <td className="px-3 py-3 text-center text-red-500">{r.absent}</td>
                    <td className="px-3 py-3 text-center">{r.half_day}</td>
                    <td className="px-3 py-3 text-center">{r.leave}</td>
                    <td className="px-3 py-3 text-center text-zinc-400">{r.weekly_off}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.worked_hours}h</td>
                    <td className="px-3 py-3 text-right tabular-nums text-zinc-500">{r.monthly_salary > 0 ? money(r.monthly_salary) : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(r.estimated_pay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-400">Tip: click any staff row to open their calendar and mark/fix days in bulk. Estimated pay = monthly salary × (present + ½·half-days) ÷ days in month.</p>
        </>
      )}
      {calendar && <EmployeeCalendarModal user={calendar} initialMonth={month} onClose={() => setCalendar(null)} />}
    </div>
  );
}
