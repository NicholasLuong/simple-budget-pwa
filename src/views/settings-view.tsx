import { Archive, Download, Moon, MoreHorizontal, Pencil, Plus, Share, Sun, Upload } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { archiveCategory, saveCategory, updatePlanBudget } from '../db/actions';
import { createBackup, downloadBackup, parseBackup, restoreBackup } from '../db/backup';
import type { Category, MonthlyPlan } from '../db/database';
import { centsToInput, dollarsToCents, formatMoney } from '../domain/money';
import { Button, buttonVariants } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { cn } from '../lib/utils';

const CATEGORY_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#15803d', '#64748b'];

function CategoryEditor({ open, onOpenChange, month, category, allocationCents, existingNames }: { open: boolean; onOpenChange: (value: boolean) => void; month: string; category?: Category | null; allocationCents?: number; existingNames: string[] }) {
  const [name, setName] = useState('');
  const [allocation, setAllocation] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setAllocation(centsToInput(allocationCents ?? 0));
    setColor(category?.color ?? CATEGORY_COLORS[0]);
  }, [open, category, allocationCents]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    const duplicate = existingNames.some((value) => value.toLocaleLowerCase() === cleanName.toLocaleLowerCase() && value !== category?.name);
    if (!cleanName || duplicate) {
      toast.error(duplicate ? 'A category with that name already exists.' : 'Enter a category name.');
      return;
    }
    await saveCategory({ name: cleanName, allocationCents: dollarsToCents(allocation), color }, month, category?.id);
    toast.success(category ? 'Category updated' : 'Category added');
    onOpenChange(false);
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{category ? 'Edit category' : 'Add category'}</DialogTitle><DialogDescription>Set this month’s category limit and the default for future months.</DialogDescription></DialogHeader><form className="space-y-5" onSubmit={handleSubmit}><div className="space-y-2"><Label htmlFor="category-name">Name</Label><Input id="category-name" maxLength={80} autoFocus value={name} onChange={(event) => setName(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="category-allocation">Monthly limit</Label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span><Input id="category-allocation" className="pl-7 tabular-nums" type="number" min="0" step="0.01" value={allocation} onChange={(event) => setAllocation(event.target.value)} required /></div></div><fieldset><legend className="mb-3 text-sm font-medium">Color</legend><div className="flex flex-wrap gap-2">{CATEGORY_COLORS.map((value) => <button key={value} type="button" className={`size-9 rounded-full border-2 transition-transform ${color === value ? 'scale-110 border-foreground' : 'border-transparent'}`} style={{ backgroundColor: value }} onClick={() => setColor(value)} aria-label={`Use ${value} for category`} aria-pressed={color === value} />)}</div></fieldset><Button className="w-full" size="lg" type="submit">Save category</Button></form></DialogContent></Dialog>;
}

export function SettingsView({ month, plan, categories, theme, onThemeChange }: { month: string; plan: MonthlyPlan; categories: Category[]; theme: 'light' | 'dark'; onThemeChange: (theme: 'light' | 'dark') => void }) {
  const [budget, setBudget] = useState(centsToInput(plan.budgetCents));
  const [editingCategory, setEditingCategory] = useState<Category | null | undefined>(undefined);
  const activeCategories = categories.filter((category) => !category.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  const allocated = activeCategories.reduce((sum, category) => sum + (plan.allocations[category.id] ?? 0), 0);
  const difference = plan.budgetCents - allocated;

  useEffect(() => setBudget(centsToInput(plan.budgetCents)), [plan.budgetCents]);

  async function handleBudget(event: FormEvent) {
    event.preventDefault();
    const amount = dollarsToCents(budget);
    if (amount <= 0) return toast.error('Enter a monthly budget greater than zero.');
    await updatePlanBudget(month, amount);
    toast.success('Monthly budget updated');
  }

  async function handleExport() {
    try { downloadBackup(await createBackup()); toast.success('Backup exported'); }
    catch { toast.error('The backup could not be created.'); }
  }

  async function handleImport(file?: File) {
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      downloadBackup(await createBackup());
      await restoreBackup(backup);
      toast.success('Backup restored. A safety copy of your previous data was downloaded.');
    } catch {
      toast.error('That file is not a valid Budget Pocket backup.');
    }
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="budget-settings-heading">
        <div><p className="eyebrow">Spending guardrail</p><h2 id="budget-settings-heading">Monthly budget</h2></div>
        <Separator className="my-4" />
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleBudget}>
          <div className="max-w-xs flex-1 space-y-2"><Label htmlFor="monthly-budget">Limit for this and future months</Label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span><Input id="monthly-budget" className="pl-7 tabular-nums" type="number" min="1" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} /></div></div>
          <Button type="submit">Save budget</Button>
        </form>
      </section>

      <section aria-labelledby="category-settings-heading">
        <div className="section-heading"><div><p className="eyebrow">Customize your plan</p><h2 id="category-settings-heading">Categories</h2></div><Button variant="outline" size="sm" onClick={() => setEditingCategory(null)}><Plus />Add</Button></div>
        <div className={`allocation-note ${difference === 0 ? 'text-success' : difference < 0 ? 'text-destructive' : 'text-warning'}`}>
          {difference === 0 ? `Fully allocated at ${formatMoney(allocated)}.` : difference > 0 ? `${formatMoney(difference)} remains unallocated.` : `${formatMoney(Math.abs(difference))} overallocated.`}
        </div>
        <Separator />
        <div>{activeCategories.map((category, index) => <div key={category.id}><div className="flex min-h-16 items-center gap-3 py-2"><span className="size-3 rounded-full" style={{ backgroundColor: category.color }} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{category.name}</p><p className="text-xs text-muted-foreground">{formatMoney(plan.allocations[category.id] ?? 0)} this month</p></div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${category.name} actions`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setEditingCategory(category)}><Pencil />Edit</DropdownMenuItem><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => void archiveCategory(category.id).then(() => toast.success('Category archived'))}><Archive />Archive</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>{index < activeCategories.length - 1 && <Separator />}</div>)}</div>
      </section>

      <section aria-labelledby="appearance-heading">
        <div><p className="eyebrow">Display</p><h2 id="appearance-heading">Appearance</h2></div><Separator className="my-4" />
        <div className="inline-flex rounded-lg bg-secondary p-1"><Button variant={theme === 'light' ? 'default' : 'ghost'} size="sm" onClick={() => onThemeChange('light')}><Sun />Light</Button><Button variant={theme === 'dark' ? 'default' : 'ghost'} size="sm" onClick={() => onThemeChange('dark')}><Moon />Dark</Button></div>
      </section>

      <section aria-labelledby="backup-heading">
        <div><p className="eyebrow">Local data</p><h2 id="backup-heading">Backup and restore</h2><p className="mt-1 text-sm text-muted-foreground">Your data stays on this device unless you export it.</p></div><Separator className="my-4" />
        <div className="flex flex-col gap-2 sm:flex-row"><Button variant="outline" onClick={() => void handleExport()}><Download />Export backup</Button><label className={cn(buttonVariants({ variant: 'outline' }), 'cursor-pointer')}><Upload className="size-4" />Import backup<input className="sr-only" type="file" accept="application/json" onChange={(event) => { void handleImport(event.target.files?.[0]); event.target.value = ''; }} /></label></div>
      </section>

      <section aria-labelledby="iphone-heading">
        <div><p className="eyebrow">iPhone app</p><h2 id="iphone-heading">Add to Home Screen</h2></div><Separator className="my-4" />
        <div className="flex items-start gap-3 text-sm"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Share className="size-4" /></span><p className="leading-6 text-muted-foreground">In Safari, tap <strong className="text-foreground">Share</strong>, choose <strong className="text-foreground">Add to Home Screen</strong>, then open Budget Pocket from your Home Screen. It will continue working offline.</p></div>
      </section>

      <CategoryEditor open={editingCategory !== undefined} onOpenChange={(open) => { if (!open) setEditingCategory(undefined); }} month={month} category={editingCategory} allocationCents={editingCategory ? plan.allocations[editingCategory.id] : 0} existingNames={categories.map((category) => category.name)} />
    </div>
  );
}
