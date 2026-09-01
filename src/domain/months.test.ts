import { describe, expect, it } from 'vitest';
import { canUseTransactionDate, maxTransactionDate, monthProgress, shiftMonth } from './months';

describe('month helpers', () => {
  it('moves safely across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('uses the correct number of days in leap-year February', () => {
    expect(monthProgress('2028-02', new Date(2028, 1, 15))).toEqual({ elapsedRatio: 15 / 29, daysRemaining: 14 });
  });

  it('does not apply pacing to historical months', () => {
    expect(monthProgress('2025-01', new Date(2026, 1, 15))).toBeNull();
  });

  it('allows transaction dates only through the end of the third future month', () => {
    const now = new Date(2026, 7, 31);
    expect(maxTransactionDate(now)).toBe('2026-11-30');
    expect(canUseTransactionDate('2026-11-30', now)).toBe(true);
    expect(canUseTransactionDate('2026-12-01', now)).toBe(false);
  });

  it('handles the future-date limit across a year boundary', () => {
    expect(maxTransactionDate(new Date(2026, 11, 20))).toBe('2027-03-31');
  });
});
