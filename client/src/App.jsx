import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { Spinner } from '@/components/ui';

// Code-split each app so, e.g., customers never download the charts bundle.
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const CustomerApp = lazy(() => import('@/pages/customer/CustomerApp'));
const KitchenDisplay = lazy(() => import('@/pages/kitchen/KitchenDisplay'));
const WaiterPanel = lazy(() => import('@/pages/waiter/WaiterPanel'));
const AdminApp = lazy(() => import('@/pages/admin/AdminApp'));
const SuperAdminApp = lazy(() => import('@/pages/superadmin/SuperAdminApp'));

const HOME_BY_ROLE = {
  SUPER_ADMIN: '/super',
  RESTAURANT_ADMIN: '/admin',
  KITCHEN: '/kitchen',
  WAITER: '/waiter',
};

function RoleRoute({ roles, children }) {
  const { user, status } = useAuth();
  if (status === 'loading') return <FullscreenLoader />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role] || '/login'} replace />;
  return children;
}

function FullscreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center aurora">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

function LandingRedirect() {
  const { user, status } = useAuth();
  if (status === 'loading') return <FullscreenLoader />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  return <Navigate to={HOME_BY_ROLE[user.role] || '/login'} replace />;
}

export default function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  const navigate = useNavigate();

  useEffect(() => { bootstrap(); }, [bootstrap]);
  useEffect(() => {
    const onLogout = () => navigate('/login');
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [navigate]);

  return (
    <Suspense fallback={<FullscreenLoader />}>
    <Routes>
      {/* Customer QR ordering — public, no auth */}
      <Route path="/order" element={<CustomerApp />} />

      {/* Staff auth */}
      <Route path="/login" element={<LoginPage />} />

      {/* Role-gated apps */}
      <Route path="/super/*" element={<RoleRoute roles={['SUPER_ADMIN']}><SuperAdminApp /></RoleRoute>} />
      <Route path="/admin/*" element={<RoleRoute roles={['RESTAURANT_ADMIN']}><AdminApp /></RoleRoute>} />
      <Route path="/kitchen/*" element={<RoleRoute roles={['KITCHEN', 'RESTAURANT_ADMIN']}><KitchenDisplay /></RoleRoute>} />
      <Route path="/waiter/*" element={<RoleRoute roles={['WAITER', 'RESTAURANT_ADMIN']}><WaiterPanel /></RoleRoute>} />

      <Route path="/" element={<LandingRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
