/**
 * Domain constants: roles, permissions, and enum-like value sets.
 * Kept in one place so backend + validators + RBAC stay in sync.
 */

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  RESTAURANT_ADMIN: 'RESTAURANT_ADMIN',
  KITCHEN: 'KITCHEN',
  WAITER: 'WAITER',
  CUSTOMER: 'CUSTOMER',
});

export const ROLE_LIST = Object.values(ROLES);

/** Roles that belong to a tenant (everything except the platform owner). */
export const TENANT_ROLES = [
  ROLES.RESTAURANT_ADMIN,
  ROLES.KITCHEN,
  ROLES.WAITER,
];

/**
 * Fine-grained permissions. Routes are guarded by these; each role maps to a
 * default permission set (see ROLE_PERMISSIONS). Restaurant Admin can later
 * override per-user permissions.
 */
export const PERMISSIONS = Object.freeze({
  // Platform
  PLATFORM_MANAGE: 'platform:manage',
  TENANT_MANAGE: 'tenant:manage',
  SUBSCRIPTION_MANAGE: 'subscription:manage',

  // Menu / catalog
  MENU_VIEW: 'menu:view',
  MENU_MANAGE: 'menu:manage',
  CATEGORY_MANAGE: 'category:manage',

  // Tables / QR
  TABLE_VIEW: 'table:view',
  TABLE_MANAGE: 'table:manage',
  QR_GENERATE: 'qr:generate',

  // Orders
  ORDER_VIEW: 'order:view',
  ORDER_CREATE: 'order:create',
  ORDER_UPDATE_STATUS: 'order:update_status',
  ORDER_SERVE: 'order:serve',
  ORDER_CANCEL: 'order:cancel',

  // Billing
  BILL_VIEW: 'bill:view',
  BILL_GENERATE: 'bill:generate',
  PAYMENT_COMPLETE: 'payment:complete',

  // Coupons
  COUPON_VIEW: 'coupon:view',
  COUPON_MANAGE: 'coupon:manage',

  // Staff / users
  STAFF_VIEW: 'staff:view',
  STAFF_MANAGE: 'staff:manage',

  // Analytics / reports
  ANALYTICS_VIEW: 'analytics:view',
  REPORT_EXPORT: 'report:export',

  // Audit / settings / notifications
  AUDIT_VIEW: 'audit:view',
  SETTINGS_MANAGE: 'settings:manage',
  NOTIFICATION_VIEW: 'notification:view',
});

const P = PERMISSIONS;

export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.SUPER_ADMIN]: [
    P.PLATFORM_MANAGE,
    P.TENANT_MANAGE,
    P.SUBSCRIPTION_MANAGE,
    P.ANALYTICS_VIEW,
    P.AUDIT_VIEW,
    P.SETTINGS_MANAGE,
  ],
  [ROLES.RESTAURANT_ADMIN]: Object.values(P).filter(
    (p) => ![P.PLATFORM_MANAGE, P.TENANT_MANAGE, P.SUBSCRIPTION_MANAGE].includes(p),
  ),
  [ROLES.KITCHEN]: [P.ORDER_VIEW, P.ORDER_UPDATE_STATUS, P.NOTIFICATION_VIEW, P.MENU_VIEW],
  [ROLES.WAITER]: [
    P.ORDER_VIEW,
    P.ORDER_SERVE,
    P.ORDER_CANCEL,
    P.BILL_VIEW,
    P.BILL_GENERATE,
    P.PAYMENT_COMPLETE,
    P.TABLE_VIEW,
    P.NOTIFICATION_VIEW,
    P.MENU_VIEW,
  ],
  [ROLES.CUSTOMER]: [P.MENU_VIEW, P.ORDER_CREATE, P.ORDER_VIEW, P.BILL_VIEW],
});

export const ORDER_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  DELAYED: 'DELAYED',
  CANCELLED: 'CANCELLED',
});

export const PAYMENT_STATUS = Object.freeze({
  UNPAID: 'UNPAID',
  PENDING: 'PENDING',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
});

export const PAYMENT_METHOD = Object.freeze({
  CASH: 'CASH',
  CARD: 'CARD',
  UPI: 'UPI',
  ONLINE: 'ONLINE',
});

export const TABLE_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  OCCUPIED: 'OCCUPIED',
  RESERVED: 'RESERVED',
  BILLED: 'BILLED',
  INACTIVE: 'INACTIVE',
});

export const TENANT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DISABLED: 'DISABLED',
  TRIAL: 'TRIAL',
});

export const COUPON_TYPE = Object.freeze({
  PERCENTAGE: 'PERCENTAGE',
  FLAT: 'FLAT',
});

export const FOOD_TYPE = Object.freeze({
  VEG: 'VEG',
  NON_VEG: 'NON_VEG',
  EGG: 'EGG',
  VEGAN: 'VEGAN',
});

/** Audit modules — used for filtering audit logs. */
export const AUDIT_MODULE = Object.freeze({
  AUTH: 'AUTH',
  MENU: 'MENU',
  CATEGORY: 'CATEGORY',
  TABLE: 'TABLE',
  QR: 'QR',
  ORDER: 'ORDER',
  PAYMENT: 'PAYMENT',
  COUPON: 'COUPON',
  STAFF: 'STAFF',
  SETTINGS: 'SETTINGS',
  TENANT: 'TENANT',
  SUBSCRIPTION: 'SUBSCRIPTION',
});
