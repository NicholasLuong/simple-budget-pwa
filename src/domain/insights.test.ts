import { describe, expect, it } from 'vitest';
import type { BudgetTransaction, Category, MonthlyPlan } from '../db/database';
import { calculateInsights } from './insights';

const eating: Category = { id: 'eating', name: 'Eating', defaultAllocationCents: 40_000, color: '#000', sortOrder: 0, archived: false };
const misc: Category = { id: 'misc', name: 'Misc', defaultAllocationCents: 30_000, color: '#111', sortOrder: 1, archived: false };
const plan: MonthlyPlan = { month: '2026-08', budgetCents: 200_000, allocations: { eating: 40_000, misc: 30_000 }, createdAt: 1, updatedAt: 1 };

function purchase(id: number, amountCents: number, categoryId: string, date: string): BudgetTransaction {
  return { id, amountCents, categoryId, merchant: '', note: '', date, month: date.slice(0, 7), createdAt: id, updatedAt: id };
}

describe('spending insights', () => {
  it('projects MTD spending and produces a concrete category adjustment', () => {
    const current = [
      purchase(1, 10_000, 'eating', '2026-08-04'),
      purchase(2, 25_000, 'eating', '2026-08-12'),
      purchase(3, 25_000, 'misc', '2026-08-14')
    ];
    const previous = [purchase(4, 45_000, 'misc', '2026-07-14')];
    const result = calculateInsights(plan, [eating, misc], current, previous, new Date(2026, 7, 15));

    expect(result.spentCents).toBe(60_000);
    expect(result.projectedCents).toBe(124_000);
    expect(result.suggestedWeeklyCents).toBe(61_250);
    expect(result.comparisonCents).toBe(15_000);
    expect(result.categoryInsights[0].category.name).toBe('Eating');
    expect(result.message).toContain('Eating');
    expect(result.message).toContain('Aim for');
  });

  it('waits until day five before presenting a projection', () => {
    const result = calculateInsights(plan, [eating], [purchase(1, 5_000, 'eating', '2026-08-03')], [], new Date(2026, 7, 3));
    expect(result.projectedCents).toBeNull();
    expect(result.message).toContain('after day five');
  });

  it('uses reflection language for a completed month', () => {
    const result = calculateInsights(plan, [eating], [purchase(1, 190_000, 'eating', '2026-08-20')], [], new Date(2026, 8, 10));
    expect(result.mode).toBe('historical');
    expect(result.projectedCents).toBe(190_000);
    expect(result.message).toContain('finished the month');
    expect(result.message).toContain('under budget');
  });
});
