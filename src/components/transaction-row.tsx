import { Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { duplicateTransaction } from '../db/actions';
import { db, type BudgetTransaction, type Category } from '../db/database';
import { formatMoney } from '../domain/money';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

export function TransactionRow({ transaction, category, onEdit }: { transaction: BudgetTransaction; category?: Category; onEdit: () => void }) {
  async function handleDuplicate() {
    await duplicateTransaction(transaction);
    toast.success('Purchase duplicated');
  }

  async function handleDelete() {
    if (!transaction.id) return;
    await db.transactions.delete(transaction.id);
    toast.success('Purchase deleted', {
      action: { label: 'Undo', onClick: () => void db.transactions.put(transaction) }
    });
  }

  return (
    <div className="transaction-row">
      <button className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onEdit}>
        <p className="truncate text-sm font-medium">{transaction.merchant || category?.name || 'Purchase'}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{category?.name ?? 'Archived category'}{transaction.note ? ` · ${transaction.note}` : ''}</p>
      </button>
      <p className="text-sm font-semibold tabular-nums">−{formatMoney(transaction.amountCents)}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Transaction actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}><Pencil />Edit</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void handleDuplicate()}><Copy />Duplicate</DropdownMenuItem>
          <AlertDialog>
            <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(event) => event.preventDefault()}><Trash2 />Delete</DropdownMenuItem></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>Delete this purchase?</AlertDialogTitle>
              <AlertDialogDescription>You can undo the deletion immediately afterward.</AlertDialogDescription>
              <div className="mt-6 flex justify-end gap-2"><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void handleDelete()}>Delete</AlertDialogAction></div>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
