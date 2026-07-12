import { User, Mail, Phone, Shield, Building2 } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { Modal, Badge } from '@/components/ui';

/** Read-only profile for staff (kitchen / waiter). Not editable by design. */
export default function ProfileModal({ open, onClose }) {
  const { user } = useAuth();
  if (!user) return null;
  const rows = [
    { icon: Shield, label: 'Role', value: user.role?.replace('RESTAURANT_', '').replace('_', ' ') },
    { icon: Mail, label: 'Email', value: user.email || '—' },
    { icon: Phone, label: 'Phone', value: user.phone || '—' },
    { icon: Building2, label: 'Restaurant', value: user.tenantName || '—' },
  ];
  return (
    <Modal open={open} onClose={onClose} title="My Profile">
      <div className="flex flex-col items-center pb-2">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-brand-500 text-2xl font-black text-white">
          {user.fullName?.[0]}
        </div>
        <p className="mt-3 text-lg font-bold">{user.fullName}</p>
        <Badge tone="brand" className="mt-1">{user.role?.replace('RESTAURANT_', '').replace('_', ' ')}</Badge>
      </div>
      <div className="mt-4 space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
            <r.icon className="h-4 w-4 text-zinc-400" />
            <span className="text-sm text-zinc-500">{r.label}</span>
            <span className="ml-auto text-sm font-medium capitalize">{r.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-center text-xs text-zinc-400">
        <User className="h-3.5 w-3.5" /> Profile details are managed by your restaurant admin.
      </p>
    </Modal>
  );
}
