import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { BudgetTransaction, Category } from '../db/database';
import { saveTransaction } from '../db/actions';
import { centsToInput, dollarsToCents } from '../domain/money';
import { canUseTransactionDate, maxTransactionDate, monthKey, todayKey } from '../domain/months';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input, NativeSelect } from './ui/input';
import { Label } from './ui/label';

export function TransactionDialog({ open, onOpenChange, categories, month, transaction }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  month: string;
  transaction?: BudgetTransaction | null;
}) {
  const defaultDate = month === monthKey() ? todayKey() : `${month}-01`;
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(transaction ? centsToInput(transaction.amountCents) : '');
    setCategoryId(transaction?.categoryId ?? categories[0]?.id ?? '');
    setMerchant(transaction?.merchant ?? '');
    setNote(transaction?.note ?? '');
    setDate(transaction?.date ?? defaultDate);
  }, [open, transaction, categories, defaultDate]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const amountCents = dollarsToCents(amount);
    if (amountCents <= 0 || !categoryId || !date) {
      toast.error('Enter an amount and choose a category.');
      return;
    }
    if (!canUseTransactionDate(date)) {
      toast.error('Purchases can only be dated through the end of next month.');
      return;
    }
    setSaving(true);
    try {
      await saveTransaction({ amountCents, categoryId, merchant: merchant.trim(), note: note.trim(), date }, transaction?.id);
      toast.success(transaction ? 'Purchase updated' : 'Purchase recorded');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The purchase could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{transaction ? 'Edit purchase' : 'Record a purchase'}</DialogTitle>
          <DialogDescription>Manually log discretionary spending for your monthly budget.</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="transaction-amount">Amount</Label>
            <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">$</span><Input id="transaction-amount" className="h-14 pl-8 text-2xl font-semibold tabular-nums" type="number" min="0.01" step="0.01" inputMode="decimal" autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transaction-category">Category</Label>
            <NativeSelect id="transaction-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transaction-merchant">Merchant <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="transaction-merchant" maxLength={120} placeholder="Trader Joe’s" value={merchant} onChange={(event) => setMerchant(event.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="transaction-date">Date</Label><Input id="transaction-date" type="date" max={maxTransactionDate()} value={date} onChange={(event) => setDate(event.target.value)} required /><p className="text-xs text-muted-foreground">You can plan purchases through next month.</p></div>
            <div className="space-y-2"><Label htmlFor="transaction-note">Note <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="transaction-note" maxLength={240} placeholder="Weekly groceries" value={note} onChange={(event) => setNote(event.target.value)} /></div>
          </div>
          <Button className="w-full" size="lg" type="submit" disabled={saving}>{saving ? 'Saving…' : transaction ? 'Save changes' : 'Save purchase'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
