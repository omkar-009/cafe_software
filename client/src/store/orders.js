import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Customer order history — persisted to localStorage so a guest keeps their
 * placed orders across page reloads (and can re-open live tracking). Each entry
 * stores the signed QR payload `d` so the public track endpoint stays authorized.
 */
export const useOrderHistory = create(
  persist(
    (set, get) => ({
      orders: [], // { orderId, orderNumber, tenantSlug, tenantName, d, placedAt }
      profile: {}, // { name, phone } — remembered so returning guests are prefilled

      add: (o) =>
        set((s) => ({
          orders: [
            { ...o, placedAt: o.placedAt || Date.now() },
            ...s.orders.filter((x) => x.orderId !== o.orderId),
          ].slice(0, 50),
        })),

      setProfile: (p) =>
        set((s) => ({ profile: { ...s.profile, ...p } })),

      forTenant: (slug) => get().orders.filter((o) => o.tenantSlug === slug),

      remove: (orderId) => set((s) => ({ orders: s.orders.filter((o) => o.orderId !== orderId) })),
      clear: () => set({ orders: [] }),
    }),
    { name: 'restrosaas-order-history' },
  ),
);
