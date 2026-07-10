import { create } from 'zustand';
import api, { request } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';

export const useAuth = create((set, get) => ({
  user: null,
  status: 'loading', // 'loading' | 'authenticated' | 'unauthenticated'

  /** Restore session on app load. */
  bootstrap: async () => {
    try {
      const { user } = await request(api.get('/auth/me'));
      set({ user, status: 'authenticated' });
      connectSocket();
    } catch {
      set({ user: null, status: 'unauthenticated' });
    }
  },

  login: async ({ email, password, tenantSlug }) => {
    const { user } = await request(api.post('/auth/login', { email, password, tenantSlug }));
    set({ user, status: 'authenticated' });
    connectSocket();
    return user;
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    disconnectSocket();
    set({ user: null, status: 'unauthenticated' });
  },

  hasPermission: (perm) => {
    const u = get().user;
    if (!u) return false;
    if (u.role === 'SUPER_ADMIN') return true;
    return (u.permissions || []).includes(perm);
  },
}));

// Global logout on refresh failure (dispatched from the api interceptor).
if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => {
    useAuth.setState({ user: null, status: 'unauthenticated' });
  });
}
