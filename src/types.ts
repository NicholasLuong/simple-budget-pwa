import type { summarizeBudget } from './domain/budget';

export type ReturnTypeOfSummary = ReturnType<typeof summarizeBudget>;
export type AppView = 'home' | 'activity' | 'insights' | 'settings';
