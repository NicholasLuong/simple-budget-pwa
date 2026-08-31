import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { BudgetTransaction, Category } from '../db/database';
import { formatMoney } from '../domain/money';
import { formatTransactionDate } from '../domain/months';
import { TransactionRow } from '../components/transaction-row';
import { Input, NativeSelect } from '../components/ui/input';
import { Separator } from '../components/ui/separator';

export function ActivityView({ transactions, categories, onEdit }: { transactions: BudgetTransaction[]; categories: Category[]; onEdit: (transaction: BudgetTransaction) => void }) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return transactions.filter((transaction) => {
      const matchesCategory = categoryId === 'all' || transaction.categoryId === categoryId;
      const category = categoryMap.get(transaction.categoryId)?.name ?? '';
      const matchesQuery = !needle || `${transaction.merchant} ${transaction.note} ${category}`.toLocaleLowerCase().includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [transactions, query, categoryId, categories]);
  const total = filtered.reduce((sum, transaction) => sum + transaction.amountCents, 0);

  return (
    <section aria-labelledby="activity-heading" className="space-y-5">
      <div className="section-heading"><div><p className="eyebrow">Manual ledger</p><h2 id="activity-heading">Activity</h2></div><p className="text-sm font-semibold tabular-nums">{formatMoney(total)}</p></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" type="search" placeholder="Search merchant or note" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <NativeSelect aria-label="Filter by category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</NativeSelect>
      </div>
      <Separator />
      {!filtered.length ? <div className="empty-state"><p className="font-medium text-foreground">No matching purchases</p><p className="mt-1">Try another month, category, or search.</p></div> : (
        <div>{filtered.map((transaction, index) => <div key={transaction.id}><div className="date-label">{index === 0 || transaction.date !== filtered[index - 1]?.date ? formatTransactionDate(transaction.date) : ''}</div><TransactionRow transaction={transaction} category={categoryMap.get(transaction.categoryId)} onEdit={() => onEdit(transaction)} />{index < filtered.length - 1 && <Separator />}</div>)}</div>
      )}
    </section>
  );
}
