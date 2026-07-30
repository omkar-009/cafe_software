import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, UtensilsCrossed, LayoutGrid, Users, Ticket, ReceiptText,
  Palette, ScrollText, Menu as MenuIcon, X, LogOut, Store, Wallet, TrendingUp, CalendarCheck,
} from 'lucide-react';
import { useAuth } from '@/store/auth';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationBell from './NotificationBell';

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/orders', label: 'Orders', icon: ReceiptText },
  { to: '/admin/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/admin/tables', label: 'Tables & QR', icon: LayoutGrid },
  { to: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { to: '/admin/expenses', label: 'Expenses', icon: Wallet },
  { to: '/admin/finance', label: 'Profit & Loss', icon: TrendingUp },
  { to: '/admin/staff', label: 'Staff', icon: Users },
  { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/admin/branding', label: 'Branding', icon: Palette },
  { to: '/admin/audit', label: 'Audit Logs', icon: ScrollText },
];

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  const SidebarContent = (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 shadow-glow"><Store className="h-5 w-5 text-white" /></div>
        <div className="min-w-0">
          <p className="truncate font-extrabold leading-none">{user?.tenantName}</p>
          <p className="text-xs text-zinc-500">Admin Console</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-brand-500 text-white shadow-glow' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
            <item.icon className="h-[18px] w-[18px]" /> {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3">
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
          <LogOut className="h-[18px] w-[18px]" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl lg:flex">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col glass-strong lg:hidden">
              {SidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden" onClick={() => setOpen(true)}><MenuIcon className="h-5 w-5" /></button>
          <h1 className="hidden text-lg font-bold capitalize sm:block">{loc.pathname.split('/')[2] || 'Dashboard'}</h1>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <div className="ml-1 hidden items-center gap-2 rounded-xl glass px-3 py-1.5 sm:flex">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-xs font-bold text-white">{user?.fullName?.[0]}</div>
              <span className="text-sm font-medium">{user?.fullName?.split(' ')[0]}</span>
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
