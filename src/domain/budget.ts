import type { BudgetTransaction, Category, MonthlyPlan } from '../db/database';
import { monthKey, monthProgress } from './months';

export interface CategorySummary {
  category: Category;
  allocatedCents: number;
  spentCents: number;
  remainingCents: number;
  usagePercent: number;
}

export function summarizeBudget(plan: MonthlyPlan, categories: Category[], transactions: BudgetTransaction[]) {
  const spentCents = transactions.reduce((total, item) => total + item.amountCents, 0);
  const remainingCents = plan.budgetCents - spentCents;
  const usagePercent = plan.budgetCents > 0 ? (spentCents / plan.budgetCents) * 100 : 0;
  const progress = monthProgress(plan.month);

  let pace: 'ahead' | 'watch' | 'over' | 'complete' | 'upcoming' = plan.month > monthKey() ? 'upcoming' : 'complete';
  if (remainingCents < 0) pace = 'over';
  else if (progress) pace = usagePercent / 100 > progress.elapsedRatio + 0.08 ? 'watch' : 'ahead';

  const categorySummaries: CategorySummary[] = categories
    .map((category) => {
      const allocatedCents = plan.allocations[category.id] ?? 0;
      const categorySpent = transactions
        .filter((transaction) => transaction.categoryId === category.id)
        .reduce((total, transaction) => total + transaction.amountCents, 0);
      return {
        category,
        allocatedCents,
        spentCents: categorySpent,
        remainingCents: allocatedCents - categorySpent,
        usagePercent: allocatedCents > 0 ? (categorySpent / allocatedCents) * 100 : 0
      };
    })
    .sort((a, b) => a.category.sortOrder - b.category.sortOrder);

  return { spentCents, remainingCents, usagePercent, pace, progress, categorySummaries };
}
