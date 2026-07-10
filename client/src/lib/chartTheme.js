import { useTheme } from '@/store/theme';

/**
 * Chart color tokens. Single-series charts use one hue (magnitude); the only
 * multi-category chart (customers donut) uses a CVD-validated blue+orange pair
 * (ΔE ~97 — validated via the dataviz palette script for both modes).
 */
export function useChartTokens() {
  const dark = useTheme((s) => s.theme) === 'dark';
  return {
    dark,
    brand: '#f97316',            // headline magnitude (sales)
    blue: dark ? '#3987e5' : '#2a78d6',
    orange: dark ? '#d95926' : '#eb6834',
    aqua: dark ? '#199e70' : '#1baf7a',
    grid: dark ? '#2c2c2a' : '#e1e0d9',
    axis: '#898781',
    surface: dark ? '#1a1a19' : '#fcfcfb',
    text: dark ? '#ffffff' : '#0b0b0b',
    muted: '#898781',
  };
}
