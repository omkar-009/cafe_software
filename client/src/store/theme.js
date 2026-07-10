import { create } from 'zustand';

function apply(theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
}

const stored = localStorage.getItem('rs_theme');
const initial = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
apply(initial);

export const useTheme = create((set, get) => ({
  theme: initial,
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('rs_theme', next);
    apply(next);
    set({ theme: next });
  },
  setTheme: (theme) => {
    localStorage.setItem('rs_theme', theme);
    apply(theme);
    set({ theme });
  },
}));
