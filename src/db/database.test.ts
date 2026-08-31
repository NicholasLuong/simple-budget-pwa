import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { db, getOrCreatePlan, initializeDatabase } from './database';

afterEach(async () => {
  db.close();
  await Dexie.delete('budgetTrackerDB');
});

describe('database initialization', () => {
  it('seeds a complete $2,000 plan for a new user', async () => {
    await initializeDatabase();
    const categories = await db.categories.toArray();
    const plan = (await db.monthlyPlans.toArray())[0];
    expect(categories).toHaveLength(6);
    expect(categories.sort((a, b) => a.sortOrder - b.sortOrder).map((category) => category.name)).toEqual([
      'GF', 'Eating', 'Misc', 'Grocery', 'Friends', 'Shopping'
    ]);
    expect(plan.budgetCents).toBe(200_000);
    expect(Object.values(plan.allocations).reduce((sum, amount) => sum + amount, 0)).toBe(200_000);
  });

  it('migrates version-one budget, categories, and transactions without deleting them', async () => {
    const legacy = new Dexie('budgetTrackerDB');
    legacy.version(1).stores({ settings: 'key', transactions: '++id,timestamp' });
    await legacy.open();
    await legacy.table('settings').bulkPut([
      { key: 'monthlyBudget', value: 1750 },
      { key: 'categoryAllocations', value: { Dining: 500, Other: 1250 } }
    ]);
    await legacy.table('transactions').add({ amount: 25.5, category: 'Dining', note: 'Lunch', timestamp: new Date(2026, 7, 5).getTime() });
    legacy.close();

    await initializeDatabase();
    const transaction = await db.transactions.toCollection().first();
    const dining = await db.categories.where('name').equals('Dining').first();
    expect(transaction?.amountCents).toBe(2550);
    expect(transaction?.merchant).toBe('Lunch');
    expect(transaction?.categoryId).toBe(dining?.id);
    expect((await db.monthlyPlans.get('2026-08'))?.budgetCents).toBe(175_000);
  });

  it('creates the same newly available month safely when requested concurrently', async () => {
    await initializeDatabase();
    const [first, second] = await Promise.all([
      getOrCreatePlan('2026-09'),
      getOrCreatePlan('2026-09')
    ]);
    expect(first.month).toBe('2026-09');
    expect(second.month).toBe('2026-09');
    expect(await db.monthlyPlans.where('month').equals('2026-09').count()).toBe(1);
  });
});
