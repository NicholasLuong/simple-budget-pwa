import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { transferAllocation } from '../db/actions';
import type { CategorySummary } from '../domain/budget';
import { centsToInput, dollarsToCents, formatMoney } from '../domain/money';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input, NativeSelect } from './ui/input';
import { Label } from './ui/label';

export function TransferBudgetDialog({ open, onOpenChange, month, categories, targetCategoryId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  categories: CategorySummary[];
  targetCategoryId?: string | null;
}) {
  const [fromCategoryId, setFromCategoryId] = useState('');
  const [toCategoryId, setToCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const sources = useMemo(
    () => categories.filter((item) => item.category.id !== toCategoryId && item.remainingCents > 0),
    [categories, toCategoryId]
  );
  const source = categories.find((item) => item.category.id === fromCategoryId);
  const target = categories.find((item) => item.category.id === toCategoryId);

  useEffect(() => {
    if (!open) return;
    const requestedTarget = categories.find((item) => item.category.id === targetCategoryId);
    const nextTarget = requestedTarget ?? categories.find((item) => item.remainingCents < 0) ?? categories[0];
    const nextSource = categories
      .filter((item) => item.category.id !== nextTarget?.category.id && item.remainingCents > 0)
      .sort((a, b) => b.remainingCents - a.remainingCents)[0];
    setToCategoryId(nextTarget?.category.id ?? '');
    setFromCategoryId(nextSource?.category.id ?? '');
    setAmount(requestedTarget && requestedTarget.remainingCents < 0 ? centsToInput(Math.abs(requestedTarget.remainingCents)) : '');
  }, [open, targetCategoryId, categories]);

  useEffect(() => {
    if (!open || sources.some((item) => item.category.id === fromCategoryId)) return;
    setFromCategoryId([...sources].sort((a, b) => b.remainingCents - a.remainingCents)[0]?.category.id ?? '');
  }, [open, sources, fromCategoryId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const amountCents = dollarsToCents(amount);
    if (!fromCategoryId || !toCategoryId || amountCents <= 0) {
      toast.error('Choose two categories and enter an amount.');
      return;
    }
    if (amountCents > (source?.remainingCents ?? 0)) {
      toast.error('That category does not have enough available to move.');
      return;
    }

    setSaving(true);
    try {
      await transferAllocation(month, fromCategoryId, toCategoryId, amountCents);
      toast.success(`${formatMoney(amountCents)} moved to ${target?.category.name ?? 'category'}`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The budget could not be moved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{target?.remainingCents && target.remainingCents < 0 ? 'Cover overspending' : 'Move budget'}</DialogTitle>
          <DialogDescription>Reallocate money within this month only. Your monthly total and other months will not change.</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="transfer-from">From</Label>
              <NativeSelect id="transfer-from" value={fromCategoryId} onChange={(event) => setFromCategoryId(event.target.value)} required>
                {!sources.length && <option value="">No money available</option>}
                {sources.map((item) => <option key={item.category.id} value={item.category.id}>{item.category.name} · {formatMoney(item.remainingCents)} left</option>)}
              </NativeSelect>
            </div>
            <ArrowRight className="mb-3 size-4 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 space-y-2">
              <Label htmlFor="transfer-to">To</Label>
              <NativeSelect id="transfer-to" value={toCategoryId} onChange={(event) => setToCategoryId(event.target.value)} required>
                {categories.filter((item) => item.category.id !== fromCategoryId).map((item) => <option key={item.category.id} value={item.category.id}>{item.category.name}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transfer-amount">Amount</Label>
            <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">$</span><Input id="transfer-amount" className="h-14 pl-8 text-2xl font-semibold tabular-nums" type="number" min="0.01" max={source ? source.remainingCents / 100 : undefined} step="0.01" inputMode="decimal" autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>
            {source && <p className="text-xs text-muted-foreground">Up to {formatMoney(source.remainingCents)} is available from {source.category.name}.</p>}
          </div>
          <Button className="w-full" size="lg" type="submit" disabled={saving || !sources.length}>{saving ? 'Moving…' : 'Move budget'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
