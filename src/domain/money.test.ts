import { describe, expect, it } from 'vitest';
import { centsToInput, dollarsToCents, formatMoney } from './money';

describe('money helpers', () => {
  it('stores decimal currency as integer cents', () => {
    expect(dollarsToCents('47.82')).toBe(4782);
    expect(dollarsToCents(10.005)).toBe(1001);
  });

  it('rejects invalid and negative spending amounts', () => {
    expect(dollarsToCents('not money')).toBe(0);
    expect(dollarsToCents(-12)).toBe(0);
  });

  it('returns stable values for inputs and display', () => {
    expect(centsToInput(200_000)).toBe('2000.00');
    expect(formatMoney(-2500)).toContain('25');
  });
});
