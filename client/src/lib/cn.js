import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional + Tailwind classes without conflicts. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const money = (n, symbol = '₹') =>
  `${symbol}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
