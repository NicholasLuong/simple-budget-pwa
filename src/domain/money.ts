export function dollarsToCents(value: string | number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric * 100));
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatMoney(cents: number, options: { sign?: boolean } = {}): string {
  const formatted = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Math.abs(cents) / 100);

  if (!options.sign) return cents < 0 ? `-${formatted}` : formatted;
  if (cents === 0) return formatted;
  return `${cents > 0 ? '+' : '−'}${formatted}`;
}
