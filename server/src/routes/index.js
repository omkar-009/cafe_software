/**
 * API v1 router aggregator. Feature modules register their routers here.
 * New modules are added incrementally as they are implemented.
 */
import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import tenantRoutes from '../modules/tenants/tenants.routes.js';
import staffRoutes from '../modules/staff/staff.routes.js';
import categoryRoutes from '../modules/categories/categories.routes.js';
import menuRoutes from '../modules/menu/menu.routes.js';
import tableRoutes from '../modules/tables/tables.routes.js';
import couponRoutes from '../modules/coupons/coupons.routes.js';
import orderRoutes from '../modules/orders/orders.routes.js';
import billingRoutes from '../modules/billing/billing.routes.js';
import publicRoutes from '../modules/public/public.routes.js';
import notificationRoutes from '../modules/notifications/notifications.routes.js';
import auditRoutes from '../modules/audit/audit.routes.js';
import analyticsRoutes from '../modules/analytics/analytics.routes.js';
import uploadRoutes from '../modules/uploads/uploads.routes.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    name: 'RestroSaaS API',
    version: 'v1',
    docs: '/api/v1 — see module routes',
  });
});

router.use('/auth', authRoutes);
router.use('/tenants', tenantRoutes);
router.use('/staff', staffRoutes);
router.use('/categories', categoryRoutes);
router.use('/menu', menuRoutes);
router.use('/tables', tableRoutes);
router.use('/coupons', couponRoutes);
router.use('/orders', orderRoutes);
router.use('/billing', billingRoutes);
router.use('/public', publicRoutes); // customer QR flow (no auth)
router.use('/notifications', notificationRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/uploads', uploadRoutes);

export default router;
