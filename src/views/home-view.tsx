import { ArrowLeftRight, ArrowRight, Plus } from 'lucide-react';
import type { BudgetTransaction, Category, MonthlyPlan } from '../db/database';
import type { ReturnTypeOfSummary } from '../types';
import { formatTransactionDate } from '../domain/months';
import { BudgetSummary } from '../components/budget-summary';
import { CategoryList } from '../components/category-list';
import { TransactionRow } from '../components/transaction-row';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';

export function HomeView({ plan, summary, transactions, categories, onAdd, onEdit, onViewActivity, onMoveBudget }: {
  plan: MonthlyPlan;
  summary: ReturnTypeOfSummary;
  transactions: BudgetTransaction[];
  categories: Category[];
  onAdd: () => void;
  onEdit: (transaction: BudgetTransaction) => void;
  onViewActivity: () => void;
  onMoveBudget: (categoryId?: string) => void;
}) {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const recent = transactions.slice(0, 5);
  return (
    <div className="space-y-9">
      <BudgetSummary summary={summary} budgetCents={plan.budgetCents} />
      <Button className="w-full sm:w-auto" size="lg" onClick={onAdd}><Plus />Record purchase</Button>

      <section aria-labelledby="category-heading">
        <div className="section-heading"><div><p className="eyebrow">Your plan</p><h2 id="category-heading">Categories</h2></div><Button variant="ghost" size="sm" onClick={() => onMoveBudget()}><ArrowLeftRight />Move budget</Button></div>
        <Separator />
        <CategoryList categories={summary.categorySummaries} onCover={onMoveBudget} />
      </section>

      <section aria-labelledby="recent-heading">
        <div className="section-heading"><div><p className="eyebrow">Latest entries</p><h2 id="recent-heading">Recent activity</h2></div>{recent.length > 0 && <Button variant="ghost" size="sm" onClick={onViewActivity}>View all<ArrowRight /></Button>}</div>
        <Separator />
        {!recent.length ? <div className="empty-state"><p className="font-medium text-foreground">No purchases this month</p><p className="mt-1">Record one when you spend outside your bills.</p></div> : (
          <div>{recent.map((transaction, index) => <div key={transaction.id}><div className="date-label">{index === 0 || transaction.date !== recent[index - 1]?.date ? formatTransactionDate(transaction.date) : ''}</div><TransactionRow transaction={transaction} category={categoryMap.get(transaction.categoryId)} onEdit={() => onEdit(transaction)} />{index < recent.length - 1 && <Separator />}</div>)}</div>
        )}
      </section>
    </div>
  );
}
