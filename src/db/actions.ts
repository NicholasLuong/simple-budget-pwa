import { db, getOrCreatePlan, type BudgetTransaction, type Category } from './database';
import { canUseTransactionDate, monthFromDate } from '../domain/months';
import { newId } from '../lib/utils';

export async function saveTransaction(input: Omit<BudgetTransaction, 'id' | 'month' | 'createdAt' | 'updatedAt'>, id?: number) {
  if (!canUseTransactionDate(input.date)) throw new Error('Purchases can only be dated through the next three months.');
  const now = Date.now();
  const value = { ...input, month: monthFromDate(input.date), updatedAt: now };
  if (id) {
    await db.transactions.update(id, value);
    return id;
  }
  return db.transactions.add({ ...value, createdAt: now });
}

export async function duplicateTransaction(transaction: BudgetTransaction) {
  const { id: _id, ...copy } = transaction;
  return db.transactions.add({ ...copy, createdAt: Date.now(), updatedAt: Date.now() });
}

export async function updatePlanBudget(month: string, budgetCents: number) {
  const plan = await getOrCreatePlan(month);
  await db.transaction('rw', db.monthlyPlans, db.settings, async () => {
    await db.monthlyPlans.put({ ...plan, budgetCents, updatedAt: Date.now() });
    await db.settings.put({ key: 'defaultMonthlyBudgetCents', value: budgetCents });
  });
}

export async function transferAllocation(month: string, fromCategoryId: string, toCategoryId: string, amountCents: number) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('Enter an amount greater than zero.');
  if (!fromCategoryId || !toCategoryId || fromCategoryId === toCategoryId) throw new Error('Choose two different categories.');

  await db.transaction('rw', db.monthlyPlans, db.transactions, async () => {
    const plan = await db.monthlyPlans.get(month);
    if (!plan) throw new Error('Budget month not found.');
    const sourceAllocation = plan.allocations[fromCategoryId] ?? 0;
    const sourceTransactions = await db.transactions.where('[month+categoryId]').equals([month, fromCategoryId]).toArray();
    const sourceSpent = sourceTransactions.reduce((total, transaction) => total + transaction.amountCents, 0);
    const sourceAvailable = sourceAllocation - sourceSpent;

    if (amountCents > sourceAvailable) {
      throw new Error('That category does not have enough available to move.');
    }

    await db.monthlyPlans.put({
      ...plan,
      allocations: {
        ...plan.allocations,
        [fromCategoryId]: sourceAllocation - amountCents,
        [toCategoryId]: (plan.allocations[toCategoryId] ?? 0) + amountCents
      },
      updatedAt: Date.now()
    });
  });
}

export async function saveCategory(input: { name: string; allocationCents: number; color: string }, month: string, id?: string) {
  const plan = await getOrCreatePlan(month);
  if (id) {
    const category = await db.categories.get(id);
    if (!category) throw new Error('Category not found');
    await db.transaction('rw', db.categories, db.monthlyPlans, async () => {
      await db.categories.put({ ...category, name: input.name, color: input.color, defaultAllocationCents: input.allocationCents });
      await db.monthlyPlans.put({ ...plan, allocations: { ...plan.allocations, [id]: input.allocationCents }, updatedAt: Date.now() });
    });
    return id;
  }

  const existing = await db.categories.toArray();
  const category: Category = {
    id: newId('category'),
    name: input.name,
    defaultAllocationCents: input.allocationCents,
    color: input.color,
    sortOrder: existing.length,
    archived: false
  };
  await db.transaction('rw', db.categories, db.monthlyPlans, async () => {
    await db.categories.add(category);
    await db.monthlyPlans.put({ ...plan, allocations: { ...plan.allocations, [category.id]: input.allocationCents }, updatedAt: Date.now() });
  });
  return category.id;
}

export async function archiveCategory(categoryId: string) {
  const category = await db.categories.get(categoryId);
  if (category) await db.categories.put({ ...category, archived: true });
}
