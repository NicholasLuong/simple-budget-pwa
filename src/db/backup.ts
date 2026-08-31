import { z } from 'zod';
import { db } from './database';

const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  defaultAllocationCents: z.number().int().nonnegative(),
  color: z.string(),
  sortOrder: z.number().int().nonnegative(),
  archived: z.boolean()
});

const planSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  budgetCents: z.number().int().nonnegative(),
  allocations: z.record(z.string(), z.number().int().nonnegative()),
  createdAt: z.number(),
  updatedAt: z.number()
});

const transactionSchema = z.object({
  id: z.number().int().positive().optional(),
  amountCents: z.number().int().nonnegative(),
  categoryId: z.string().min(1),
  merchant: z.string().max(120),
  note: z.string().max(240),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  createdAt: z.number(),
  updatedAt: z.number()
});

const backupSchema = z.object({
  format: z.literal('budget-pocket'),
  version: z.literal(2),
  exportedAt: z.string(),
  data: z.object({
    settings: z.array(z.object({ key: z.string(), value: z.unknown() })),
    categories: z.array(categorySchema),
    monthlyPlans: z.array(planSchema),
    transactions: z.array(transactionSchema)
  })
});

export type Backup = z.infer<typeof backupSchema>;

export async function createBackup(): Promise<Backup> {
  const [settings, categories, monthlyPlans, transactions] = await Promise.all([
    db.settings.toArray(),
    db.categories.toArray(),
    db.monthlyPlans.toArray(),
    db.transactions.toArray()
  ]);
  return backupSchema.parse({
    format: 'budget-pocket',
    version: 2,
    exportedAt: new Date().toISOString(),
    data: { settings, categories, monthlyPlans, transactions }
  });
}

export function parseBackup(content: string): Backup {
  return backupSchema.parse(JSON.parse(content));
}

export async function restoreBackup(backup: Backup) {
  await db.transaction('rw', db.settings, db.categories, db.monthlyPlans, db.transactions, async () => {
    await Promise.all([
      db.settings.clear(),
      db.categories.clear(),
      db.monthlyPlans.clear(),
      db.transactions.clear()
    ]);
    await db.settings.bulkPut(backup.data.settings);
    await db.categories.bulkPut(backup.data.categories);
    await db.monthlyPlans.bulkPut(backup.data.monthlyPlans);
    await db.transactions.bulkPut(backup.data.transactions);
  });
}

export function downloadBackup(backup: Backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `budget-pocket-${backup.exportedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
