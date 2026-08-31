import Dexie, { type EntityTable, type Transaction } from 'dexie';
import { monthFromDate, monthKey, todayKey } from '../domain/months';
import { dollarsToCents } from '../domain/money';
import { newId } from '../lib/utils';

export const DEFAULT_BUDGET_CENTS = 200_000;

export interface Setting {
  key: string;
  value: unknown;
}

export interface Category {
  id: string;
  name: string;
  defaultAllocationCents: number;
  color: string;
  sortOrder: number;
  archived: boolean;
}

export interface MonthlyPlan {
  month: string;
  budgetCents: number;
  allocations: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export interface BudgetTransaction {
  id?: number;
  amountCents: number;
  categoryId: string;
  merchant: string;
  note: string;
  date: string;
  month: string;
  createdAt: number;
  updatedAt: number;
}

const DEFAULT_CATEGORY_PRESET_VERSION = 2;
const ORIGINAL_DEFAULT_CATEGORY_NAMES = ['Groceries', 'Dining', 'Shopping', 'Entertainment', 'Transportation', 'Other'];
const DEFAULT_CATEGORIES = [
  ['GF', 60_000, '#2563eb'],
  ['Eating', 40_000, '#7c3aed'],
  ['Misc', 30_000, '#64748b'],
  ['Grocery', 25_000, '#15803d'],
  ['Friends', 25_000, '#db2777'],
  ['Shopping', 20_000, '#ea580c']
] as const;

class BudgetDatabase extends Dexie {
  settings!: EntityTable<Setting, 'key'>;
  categories!: EntityTable<Category, 'id'>;
  monthlyPlans!: EntityTable<MonthlyPlan, 'month'>;
  transactions!: EntityTable<BudgetTransaction, 'id'>;

  constructor() {
    super('budgetTrackerDB');

    this.version(1).stores({
      settings: 'key',
      transactions: '++id,timestamp'
    });

    this.version(2)
      .stores({
        settings: 'key',
        categories: 'id,name,sortOrder,archived',
        monthlyPlans: 'month',
        transactions: '++id,date,month,categoryId,createdAt,[month+categoryId]'
      })
      .upgrade(migrateVersionOne);
  }
}

async function migrateVersionOne(transaction: Transaction) {
  const settings = transaction.table<Setting, string>('settings');
  const transactions = transaction.table('transactions');
  const categories = transaction.table<Category, string>('categories');
  const plans = transaction.table<MonthlyPlan, string>('monthlyPlans');

  const budgetRecord = await settings.get('monthlyBudget');
  const allocationRecord = await settings.get('categoryAllocations');
  const legacyBudget = dollarsToCents(typeof budgetRecord?.value === 'number' ? budgetRecord.value : 2000);
  const rawAllocations = allocationRecord?.value && typeof allocationRecord.value === 'object'
    ? allocationRecord.value as Record<string, unknown>
    : {};
  const legacyTransactions = await transactions.toArray() as Array<Record<string, unknown>>;
  const names = new Set<string>(Object.keys(rawAllocations).map((name) => name.trim()).filter(Boolean));
  legacyTransactions.forEach((item) => {
    if (typeof item.category === 'string' && item.category.trim()) names.add(item.category.trim());
  });

  const migratedCategories = [...names].map((name, index) => ({
    id: `legacy-category-${index + 1}`,
    name,
    defaultAllocationCents: dollarsToCents(Number(rawAllocations[name] ?? 0)),
    color: DEFAULT_CATEGORIES[index % DEFAULT_CATEGORIES.length][2],
    sortOrder: index,
    archived: false
  }));
  const categoryByName = new Map(migratedCategories.map((category) => [category.name, category]));

  if (migratedCategories.length) await categories.bulkAdd(migratedCategories);

  const now = Date.now();
  const usedMonths = new Set<string>([monthKey()]);
  for (const item of legacyTransactions) {
    const timestamp = typeof item.timestamp === 'number' ? item.timestamp : now;
    const date = todayKey(new Date(timestamp));
    const categoryName = typeof item.category === 'string' ? item.category.trim() : '';
    const category = categoryByName.get(categoryName) ?? migratedCategories[0];
    const month = monthFromDate(date);
    usedMonths.add(month);
    await transactions.update(item.id as number, {
      amountCents: dollarsToCents(Number(item.amount ?? 0)),
      categoryId: category?.id ?? '',
      merchant: typeof item.note === 'string' ? item.note : '',
      note: '',
      date,
      month,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  const allocations = Object.fromEntries(
    migratedCategories.map((category) => [category.id, category.defaultAllocationCents])
  );
  await plans.bulkPut([...usedMonths].map((month) => ({
    month,
    budgetCents: legacyBudget,
    allocations,
    createdAt: now,
    updatedAt: now
  })));

  await settings.bulkPut([
    { key: 'defaultMonthlyBudgetCents', value: legacyBudget },
    { key: 'schemaVersion', value: 2 }
  ]);
}

export const db = new BudgetDatabase();

export async function initializeDatabase() {
  await db.open();
  const categoryCount = await db.categories.count();
  if (!categoryCount) {
    const categories: Category[] = DEFAULT_CATEGORIES.map(([name, amount, color], index) => ({
      id: newId('category'),
      name,
      defaultAllocationCents: amount,
      color,
      sortOrder: index,
      archived: false
    }));
    await db.categories.bulkAdd(categories);
    await db.settings.bulkPut([
      { key: 'defaultMonthlyBudgetCents', value: DEFAULT_BUDGET_CENTS },
      { key: 'defaultCategoryPresetVersion', value: DEFAULT_CATEGORY_PRESET_VERSION }
    ]);
    const currentPlan = await db.monthlyPlans.get(monthKey());
    if (currentPlan && Object.keys(currentPlan.allocations).length === 0) {
      await db.monthlyPlans.put({
        ...currentPlan,
        allocations: Object.fromEntries(categories.map((category) => [category.id, category.defaultAllocationCents])),
        updatedAt: Date.now()
      });
    }
  } else {
    await upgradeUntouchedDefaultCategories();
  }
  await getOrCreatePlan(monthKey());
}

async function upgradeUntouchedDefaultCategories() {
  const presetRecord = await db.settings.get('defaultCategoryPresetVersion');
  if (presetRecord?.value === DEFAULT_CATEGORY_PRESET_VERSION) return;

  const activeCategories = (await db.categories.toArray()).filter((category) => !category.archived);
  const activeNames = activeCategories.map((category) => category.name).sort();
  const originalNames = [...ORIGINAL_DEFAULT_CATEGORY_NAMES].sort();
  const stillUsingOriginalPreset = activeNames.length === originalNames.length
    && activeNames.every((name, index) => name === originalNames[index]);

  if (!stillUsingOriginalPreset) return;

  const replacements: Category[] = DEFAULT_CATEGORIES.map(([name, amount, color], index) => ({
    id: newId('category'),
    name,
    defaultAllocationCents: amount,
    color,
    sortOrder: index,
    archived: false
  }));
  const transactionCategoryIds = new Set((await db.transactions.toArray()).map((transaction) => transaction.categoryId));
  const currentMonth = monthKey();

  await db.transaction('rw', db.settings, db.categories, db.monthlyPlans, async () => {
    for (const category of activeCategories) {
      if (transactionCategoryIds.has(category.id)) await db.categories.put({ ...category, archived: true });
      else await db.categories.delete(category.id);
    }
    await db.categories.bulkAdd(replacements);

    const currentAndFuturePlans = (await db.monthlyPlans.toArray()).filter((plan) => plan.month >= currentMonth);
    const allocations = Object.fromEntries(replacements.map((category) => [category.id, category.defaultAllocationCents]));
    await db.monthlyPlans.bulkPut(currentAndFuturePlans.map((plan) => ({ ...plan, allocations, updatedAt: Date.now() })));
    await db.settings.put({ key: 'defaultCategoryPresetVersion', value: DEFAULT_CATEGORY_PRESET_VERSION });
  });
}

export async function getDefaultBudget(): Promise<number> {
  const record = await db.settings.get('defaultMonthlyBudgetCents');
  return typeof record?.value === 'number' ? record.value : DEFAULT_BUDGET_CENTS;
}

export async function getOrCreatePlan(month: string): Promise<MonthlyPlan> {
  const existing = await db.monthlyPlans.get(month);
  if (existing) return existing;

  const [budgetCents, categories] = await Promise.all([
    getDefaultBudget(),
    db.categories.filter((category) => !category.archived).sortBy('sortOrder')
  ]);
  const now = Date.now();
  const plan: MonthlyPlan = {
    month,
    budgetCents,
    allocations: Object.fromEntries(categories.map((category) => [category.id, category.defaultAllocationCents])),
    createdAt: now,
    updatedAt: now
  };
  // Multiple live queries can request a newly available month at the same time.
  // `put` makes creation idempotent instead of throwing on a duplicate primary key.
  await db.monthlyPlans.put(plan);
  return plan;
}
