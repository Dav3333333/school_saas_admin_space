export function formatFinanceMoney(value: unknown, currency = 'USD'): string {
  if (typeof value === 'string' && value.trim() === '') return '—';
  const amount = typeof value === 'number' || typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(amount)) return '—';

  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
