import { ArrowDown, ArrowUp, Lightbulb, Minus } from 'lucide-react';
import type { BudgetTransaction, Category, MonthlyPlan } from '../db/database';
import { calculateInsights } from '../domain/insights';
import { formatMoney } from '../domain/money';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Separator } from '../components/ui/separator';

export function InsightsView({ plan, categories, transactions, previousMonthTransactions }: {
  plan: MonthlyPlan;
  categories: Category[];
  transactions: BudgetTransaction[];
  previousMonthTransactions: BudgetTransaction[];
}) {
  const insights = calculateInsights(plan, categories, transactions, previousMonthTransactions);
  const projectionStatus = insights.projectedDifferenceCents === null
    ? { label: 'Building trend', variant: 'outline' as const }
    : insights.projectedDifferenceCents >= 0
      ? { label: 'On track', variant: 'success' as const }
      : { label: 'Adjust pace', variant: 'warning' as const };
  const maxWeek = Math.max(...insights.weeks.map((week) => week.spentCents), 1);

  return (
    <div className="space-y-10">
      <section className="budget-summary" aria-labelledby="insights-heading">
        <div className="flex items-start justify-between gap-4">
          <div><p className="eyebrow">MTD direction</p><h2 id="insights-heading">Month outlook</h2></div>
          <Badge variant={projectionStatus.variant}>{projectionStatus.label}</Badge>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">Projected month end</p>
        <p className="mt-1 text-4xl font-bold tracking-[-0.045em] tabular-nums">{insights.projectedCents === null ? '—' : formatMoney(insights.projectedCents)}</p>
        {insights.suggestedWeeklyCents !== null && <p className="mt-2 text-sm text-muted-foreground">Suggested total this week: <strong className="text-foreground">{formatMoney(insights.suggestedWeeklyCents)}</strong></p>}
        <div className="mt-6 flex gap-3 rounded-xl bg-muted p-4 text-sm leading-6"><Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" /><p>{insights.message}</p></div>
      </section>

      <section aria-labelledby="weekly-heading">
        <div className="section-heading"><div><p className="eyebrow">Spending rhythm</p><h2 id="weekly-heading">Week by week</h2></div></div>
        <Separator />
        {!insights.weeks.length ? <p className="empty-state">Weekly trends will appear when the month begins.</p> : <div className="space-y-4 py-4">{insights.weeks.map((week) => (
          <div key={week.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2"><p className="text-sm font-medium">{week.label}</p>{week.isCurrent && <Badge>Current</Badge>}</div>
            <p className="text-sm font-semibold tabular-nums">{formatMoney(week.spentCents)}</p>
            <Progress className="col-span-2 h-1.5" value={(week.spentCents / maxWeek) * 100} label={`${week.label}: ${formatMoney(week.spentCents)}`} />
          </div>
        ))}</div>}
      </section>

      <section aria-labelledby="category-watch-heading">
        <div className="section-heading"><div><p className="eyebrow">Habit signal</p><h2 id="category-watch-heading">Category watch</h2></div><p className="text-xs text-muted-foreground">Top 3</p></div>
        <Separator />
        {!insights.categoryInsights.length ? <p className="empty-state">No category trend yet.</p> : <div>{insights.categoryInsights.map((item, index) => (
          <div key={item.category.id}>
            <div className="flex min-h-16 items-center gap-3 py-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.category.color }} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.category.name}</p><p className="text-xs text-muted-foreground">{formatMoney(item.spentCents)} MTD · {formatMoney(item.recentCents)} last 7 days</p></div>{item.projectedCents !== null && <div className="text-right"><p className="text-sm font-semibold tabular-nums">{formatMoney(item.projectedCents)}</p><p className="text-xs text-muted-foreground">projected</p></div>}</div>
            {index < insights.categoryInsights.length - 1 && <Separator />}
          </div>
        ))}</div>}
      </section>

      <section aria-labelledby="comparison-heading">
        <div><p className="eyebrow">Context</p><h2 id="comparison-heading">Compared with last month</h2></div><Separator className="my-4" />
        {insights.comparisonDay === 0 ? <p className="text-sm text-muted-foreground">Comparison will appear when the month begins.</p> : (
          insights.comparisonCents === 0
            ? <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-secondary text-muted-foreground"><Minus className="size-4" /></span><p className="text-sm leading-6">You have spent the <strong>same amount</strong> through day {insights.comparisonDay}.</p></div>
            : <div className="flex items-center gap-3"><span className={`grid size-9 place-items-center rounded-full ${insights.comparisonCents > 0 ? 'bg-warning-muted text-warning' : 'bg-success-muted text-success'}`}>{insights.comparisonCents > 0 ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}</span><p className="text-sm leading-6">You have spent <strong>{formatMoney(Math.abs(insights.comparisonCents))} {insights.comparisonCents > 0 ? 'more' : 'less'}</strong> through day {insights.comparisonDay}.</p></div>
        )}
      </section>
    </div>
  );
}
