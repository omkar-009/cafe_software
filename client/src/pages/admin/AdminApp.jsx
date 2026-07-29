import { Routes, Route } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import DashboardPage from './DashboardPage';
import OrdersPage from './OrdersPage';
import MenuPage from './MenuPage';
import TablesPage from './TablesPage';
import CouponsPage from './CouponsPage';
import ExpensesPage from './ExpensesPage';
import FinancePage from './FinancePage';
import StaffPage from './StaffPage';
import BrandingPage from './BrandingPage';
import AuditPage from './AuditPage';

export default function AdminApp() {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<DashboardPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="tables" element={<TablesPage />} />
        <Route path="coupons" element={<CouponsPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="branding" element={<BrandingPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Routes>
    </AdminLayout>
  );
}
