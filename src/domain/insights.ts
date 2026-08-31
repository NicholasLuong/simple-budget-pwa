import type { BudgetTransaction, Category, MonthlyPlan } from '../db/database';
import { monthKey } from './months';

export interface WeeklyInsight {
  label: string;
  spentCents: number;
  isCurrent: boolean;
}

export interface CategoryInsight {
  category: Category;
  spentCents: number;
  recentCents: number;
  projectedCents: number | null;
  remainingWeeklyCents: number | null;
  projectedOverageCents: number;
}

export interface SpendingInsights {
  mode: 'current' | 'historical' | 'future';
  spentCents: number;
  projectedCents: number | null;
  projectedDifferenceCents: number | null;
  suggestedWeeklyCents: number | null;
  weeks: WeeklyInsight[];
  categoryInsights: CategoryInsight[];
  previousMtdCents: number;
  comparisonCents: number;
  comparisonDay: number;
  message: string;
}

export function calculateInsights(
  plan: MonthlyPlan,
  categories: Category[],
  transactions: BudgetTransaction[],
  previousMonthTransactions: BudgetTransaction[],
  now = new Date()
): SpendingInsights {
  const [year, monthNumber] = plan.month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const currentMonth = monthKey(now);
  const mode = plan.month === currentMonth ? 'current' : plan.month < currentMonth ? 'historical' : 'future';
  const elapsedDays = mode === 'current' ? now.getDate() : mode === 'historical' ? daysInMonth : 0;
  const throughDate = `${plan.month}-${String(elapsedDays).padStart(2, '0')}`;
  const includedTransactions = mode === 'current'
    ? transactions.filter((transaction) => transaction.date <= throughDate)
    : mode === 'future' ? [] : transactions;
  const spentCents = sumTransactions(includedTransactions);
  const remainingDays = Math.max(0, daysInMonth - elapsedDays);
  const projectedCents = mode === 'historical'
    ? spentCents
    : mode === 'current' && elapsedDays >= 5
      ? Math.round((spentCents / elapsedDays) * daysInMonth)
      : null;
  const projectedDifferenceCents = projectedCents === null ? null : plan.budgetCents - projectedCents;
  const remainingBudgetCents = Math.max(0, plan.budgetCents - spentCents);
  const suggestedWeeklyCents = mode === 'current' && remainingDays > 0
    ? Math.min(remainingBudgetCents, Math.round((remainingBudgetCents / remainingDays) * 7))
    : null;

  const comparisonDay = Math.max(0, elapsedDays);
  const previousMtdCents = sumTransactions(
    previousMonthTransactions.filter((transaction) => Number(transaction.date.slice(8, 10)) <= comparisonDay)
  );

  const categoryInsights = categories
    .map((category) => {
      const categoryTransactions = includedTransactions.filter((transaction) => transaction.categoryId === category.id);
      const categorySpent = sumTransactions(categoryTransactions);
      const allocation = plan.allocations[category.id] ?? 0;
      const recentStartDay = Math.max(1, elapsedDays - 6);
      const recentCents = sumTransactions(categoryTransactions.filter((transaction) => Number(transaction.date.slice(8, 10)) >= recentStartDay));
      const categoryProjection = mode === 'current' && elapsedDays >= 5
        ? Math.round((categorySpent / elapsedDays) * daysInMonth)
        : mode === 'historical' ? categorySpent : null;
      const categoryRemaining = Math.max(0, allocation - categorySpent);
      const remainingWeekly = mode === 'current' && remainingDays > 0
        ? Math.min(categoryRemaining, Math.round((categoryRemaining / remainingDays) * 7))
        : null;
      return {
        category,
        spentCents: categorySpent,
        recentCents,
        projectedCents: categoryProjection,
        remainingWeeklyCents: remainingWeekly,
        projectedOverageCents: Math.max(0, (categoryProjection ?? 0) - allocation)
      };
    })
    .filter((item) => item.spentCents > 0)
    .sort((a, b) => b.projectedOverageCents - a.projectedOverageCents || b.spentCents - a.spentCents)
    .slice(0, 3);

  return {
    mode,
    spentCents,
    projectedCents,
    projectedDifferenceCents,
    suggestedWeeklyCents,
    weeks: buildWeeks(plan.month, includedTransactions, elapsedDays, mode),
    categoryInsights,
    previousMtdCents,
    comparisonCents: spentCents - previousMtdCents,
    comparisonDay,
    message: buildMessage(mode, plan, spentCents, projectedDifferenceCents, suggestedWeeklyCents, categoryInsights)
  };
}

function buildWeeks(month: string, transactions: BudgetTransaction[], elapsedDays: number, mode: SpendingInsights['mode']): WeeklyInsight[] {
  if (mode === 'future') return [];
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const visibleThrough = mode === 'current' ? elapsedDays : daysInMonth;
  const weeks: WeeklyInsight[] = [];
  let startDay = 1;

  while (startDay <= visibleThrough) {
    const startDate = new Date(year, monthNumber - 1, startDay);
    const endDay = Math.min(daysInMonth, startDay + (6 - startDate.getDay()));
    const visibleEndDay = Math.min(endDay, visibleThrough);
    const spentCents = sumTransactions(transactions.filter((transaction) => {
      const day = Number(transaction.date.slice(8, 10));
      return day >= startDay && day <= visibleEndDay;
    }));
    const startLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(startDate);
    const endLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(year, monthNumber - 1, visibleEndDay));
    weeks.push({ label: `${startLabel}–${endLabel}`, spentCents, isCurrent: mode === 'current' && elapsedDays >= startDay && elapsedDays <= endDay });
    startDay = endDay + 1;
  }
  return weeks;
}

function buildMessage(
  mode: SpendingInsights['mode'],
  plan: MonthlyPlan,
  spentCents: number,
  projectedDifferenceCents: number | null,
  suggestedWeeklyCents: number | null,
  categories: CategoryInsight[]
) {
  if (mode === 'future') return 'This month has not started yet.';
  if (mode === 'historical') {
    const difference = plan.budgetCents - spentCents;
    return difference >= 0
      ? `You finished the month ${moneyWords(difference)} under budget.`
      : `You finished the month ${moneyWords(Math.abs(difference))} over budget.`;
  }
  if (projectedDifferenceCents === null) return 'Keep logging purchases. A useful month-end trend will appear after day five.';

  const categoryRisk = categories.find((category) => category.projectedOverageCents > 0);
  if (categoryRisk && categoryRisk.remainingWeeklyCents !== null) {
    return `${categoryRisk.category.name} is trending ${moneyWords(categoryRisk.projectedOverageCents)} over its limit. Aim for about ${moneyWords(categoryRisk.remainingWeeklyCents)} this week.`;
  }
  if (projectedDifferenceCents < 0 && suggestedWeeklyCents !== null) {
    return `You are trending ${moneyWords(Math.abs(projectedDifferenceCents))} over budget. Aim for about ${moneyWords(suggestedWeeklyCents)} this week.`;
  }
  return `You are on track. You have ${moneyWords(Math.max(0, plan.budgetCents - spentCents))} left this month.`;
}

function moneyWords(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

function sumTransactions(transactions: BudgetTransaction[]) {
  return transactions.reduce((sum, transaction) => sum + transaction.amountCents, 0);
}
