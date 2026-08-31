import { CalendarDays } from 'lucide-react';
import type { ReturnTypeOfSummary } from '../types';
import { formatMoney } from '../domain/money';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';

const paceCopy = {
  ahead: { text: 'On pace', variant: 'success' as const },
  watch: { text: 'Watch spending', variant: 'warning' as const },
  over: { text: 'Over budget', variant: 'destructive' as const },
  complete: { text: 'Past month', variant: 'outline' as const }
};

export function BudgetSummary({ summary, budgetCents }: { summary: ReturnTypeOfSummary; budgetCents: number }) {
  const pace = paceCopy[summary.pace];
  return (
    <section className="budget-summary" aria-labelledby="budget-summary-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id="budget-summary-heading" className="eyebrow">Monthly spending</p>
          <p className={`money-display ${summary.remainingCents < 0 ? 'text-destructive' : ''}`}>
            {formatMoney(summary.remainingCents)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">remaining</p>
        </div>
        <Badge variant={pace.variant}>{pace.text}</Badge>
      </div>

      <div className="mt-7 space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>{formatMoney(summary.spentCents)} spent</span>
          <span className="text-muted-foreground">of {formatMoney(budgetCents)}</span>
        </div>
        <Progress value={summary.usagePercent} label={`${Math.round(summary.usagePercent)} percent of monthly budget used`} indicatorClassName={summary.remainingCents < 0 ? 'bg-destructive' : summary.pace === 'watch' ? 'bg-warning' : undefined} />
      </div>

      <Separator className="my-5" />
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span className="tabular-nums">{Math.round(summary.usagePercent)}% used</span>
        {summary.progress ? (
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{summary.progress.daysRemaining} days left</span>
        ) : <span>Calendar month</span>}
      </div>
    </section>
  );
}
