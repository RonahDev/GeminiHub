import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency according to vi-VN locale (e.g. 23.000 đ)
 */
export function formatVnd(amount: number | bigint | null | undefined): string {
  if (amount === null || amount === undefined) return '0 đ';
  const num = typeof amount === 'bigint' ? Number(amount) : amount;
  return `${num.toLocaleString('vi-VN')} đ`;
}

/**
 * Format date time to Vietnamese standard
 */
export function formatDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
