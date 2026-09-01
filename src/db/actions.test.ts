import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { maxTransactionDate, monthFromDate, monthKey, shiftMonth } from '../domain/months';
import { saveTransaction, transferAllocation } from './actions';
import { db, getOrCreatePlan, initializeDatabase } from './database';

afterEach(async () => {
  db.close();
  await Dexie.delete('budgetTrackerDB');
});

describe('budget allocation transfers', () => {
  it('moves available budget only inside the selected month', async () => {
    await initializeDatabase();
    const month = monthKey();
    const otherMonth = month === '2026-07' ? '2026-06' : '2026-07';
    const categories = await db.categories.orderBy('sortOrder').toArray();
    const source = categories.find((category) => category.name === 'Misc')!;
    const target = categories.find((category) => category.name === 'GF')!;
    const before = (await db.monthlyPlans.get(month))!;
    const otherBefore = await getOrCreatePlan(otherMonth);

    await transferAllocation(month, source.id, target.id, 10_000);

    const after = (await db.monthlyPlans.get(month))!;
    const otherAfter = (await db.monthlyPlans.get(otherMonth))!;
    expect(after.allocations[source.id]).toBe(before.allocations[source.id] - 10_000);
    expect(after.allocations[target.id]).toBe(before.allocations[target.id] + 10_000);
    expect(Object.values(after.allocations).reduce((sum, amount) => sum + amount, 0)).toBe(
      Object.values(before.allocations).reduce((sum, amount) => sum + amount, 0)
    );
    expect(otherAfter.allocations).toEqual(otherBefore.allocations);
    expect((await db.categories.get(source.id))?.defaultAllocationCents).toBe(source.defaultAllocationCents);
  });

  it('does not let a transfer create a new overspent source envelope', async () => {
    await initializeDatabase();
    const month = monthKey();
    const categories = await db.categories.orderBy('sortOrder').toArray();
    const source = categories.find((category) => category.name === 'Shopping')!;
    const target = categories.find((category) => category.name === 'GF')!;
    const before = (await db.monthlyPlans.get(month))!;
    await db.transactions.add({
      amountCents: 15_000,
      categoryId: source.id,
      merchant: 'Store',
      note: '',
      date: `${month}-01`,
      month,
      createdAt: 1,
      updatedAt: 1
    });

    await expect(transferAllocation(month, source.id, target.id, 6_000)).rejects.toThrow('does not have enough available');
    expect((await db.monthlyPlans.get(month))?.allocations).toEqual(before.allocations);
  });
});

describe('future transaction entry', () => {
  it('allows purchases through the third future month but rejects later dates at the data boundary', async () => {
    await initializeDatabase();
    const category = (await db.categories.orderBy('sortOrder').first())!;
    const latestAllowed = maxTransactionDate();
    const tooLate = `${shiftMonth(monthFromDate(latestAllowed), 1)}-01`;
    const input = {
      amountCents: 2_500,
      categoryId: category.id,
      merchant: 'Reservation',
      note: '',
      date: latestAllowed
    };

    await saveTransaction(input);
    await expect(saveTransaction({ ...input, date: tooLate })).rejects.toThrow('through the next three months');

    const saved = await db.transactions.toArray();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ date: latestAllowed, month: monthFromDate(latestAllowed) });
  });
});
