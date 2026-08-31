import { describe, expect, it } from 'vitest';
import type { BudgetTransaction, Category, MonthlyPlan } from '../db/database';
import { summarizeBudget } from './budget';

const category: Category = { id: 'food', name: 'Food', defaultAllocationCents: 50_000, color: '#000', sortOrder: 0, archived: false };
const plan: MonthlyPlan = { month: '2025-01', budgetCents: 200_000, allocations: { food: 50_000 }, createdAt: 1, updatedAt: 1 };

describe('budget summary', () => {
  it('calculates overall and category availability independently', () => {
    const transactions: BudgetTransaction[] = [
      { id: 1, amountCents: 12_345, categoryId: 'food', merchant: '', note: '', date: '2025-01-10', month: '2025-01', createdAt: 1, updatedAt: 1 }
    ];
    const result = summarizeBudget(plan, [category], transactions);
    expect(result.spentCents).toBe(12_345);
    expect(result.remainingCents).toBe(187_655);
    expect(result.categorySummaries[0].remainingCents).toBe(37_655);
  });

  it('reports category and overall overspending', () => {
    const transactions: BudgetTransaction[] = [
      { id: 1, amountCents: 210_000, categoryId: 'food', merchant: '', note: '', date: '2025-01-10', month: '2025-01', createdAt: 1, updatedAt: 1 }
    ];
    const result = summarizeBudget(plan, [category], transactions);
    expect(result.remainingCents).toBe(-10_000);
    expect(result.categorySummaries[0].remainingCents).toBe(-160_000);
    expect(result.pace).toBe('over');
  });
});
