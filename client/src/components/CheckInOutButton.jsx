import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { fmtTime } from '@/lib/format';
import { LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import api, { request } from '@/lib/api';
import { Button } from '@/components/ui';

/**
 * Self attendance control for staff (waiter / kitchen). Shows "Check in", then
 * the check-in time + "Check out", then a done state — driven by /attendance/me.
 */
export default function CheckInOutButton() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['my-attendance'], queryFn: () => request(api.get('/attendance/me')) });
  const today = data?.today;

  const checkIn = useMutation({
    mutationFn: () => request(api.post('/attendance/check-in')),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-attendance'] }); toast.success('Checked in'); },
    onError: (e) => toast.error(e.message),
  });
  const checkOut = useMutation({
    mutationFn: () => request(api.post('/attendance/check-out')),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-attendance'] }); toast.success('Checked out'); },
    onError: (e) => toast.error(e.message),
  });

  if (today?.check_in && today?.check_out) {
    return (
      <span className="flex items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" /> Shift done · {fmtTime(today.check_in)}–{fmtTime(today.check_out)}
      </span>
    );
  }
  if (today?.check_in) {
    return (
      <Button variant="outline" size="sm" onClick={() => checkOut.mutate()} loading={checkOut.isPending}>
        <LogOut className="h-4 w-4" /> Check out <span className="ml-1 text-zinc-400">· in {fmtTime(today.check_in)}</span>
      </Button>
    );
  }
  return (
    <Button size="sm" onClick={() => checkIn.mutate()} loading={checkIn.isPending}>
      <LogIn className="h-4 w-4" /> Check in
    </Button>
  );
}
