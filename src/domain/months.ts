export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthFromDate(date: string): string {
  return date.slice(0, 7);
}

export function todayKey(date = new Date()): string {
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
}

export function shiftMonth(month: string, offset: number): string {
  const [year, index] = month.split('-').map(Number);
  return monthKey(new Date(year, index - 1 + offset, 1));
}

export function maxTransactionDate(now = new Date()): string {
  const nextMonth = shiftMonth(monthKey(now), 1);
  const [year, month] = nextMonth.split('-').map(Number);
  return todayKey(new Date(year, month, 0));
}

export function canUseTransactionDate(date: string, now = new Date()): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= maxTransactionDate(now);
}

export function formatMonth(month: string): string {
  const [year, index] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    new Date(year, index - 1, 1)
  );
}

export function formatTransactionDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(year, month - 1, day);
  const today = todayKey();
  if (date === today) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === todayKey(yesterday)) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: year === new Date().getFullYear() ? undefined : 'numeric' }).format(value);
}

export function monthProgress(month: string, now = new Date()) {
  if (month !== monthKey(now)) return null;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return {
    elapsedRatio: now.getDate() / daysInMonth,
    daysRemaining: daysInMonth - now.getDate()
  };
}
