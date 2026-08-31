import { describe, expect, it } from 'vitest';
import { monthProgress, shiftMonth } from './months';

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
});
