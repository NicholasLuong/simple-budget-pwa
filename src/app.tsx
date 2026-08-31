import { Activity, ChartNoAxesCombined, CircleDollarSign, Home, Moon, Plus, Settings, Sun, WifiOff } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Toaster, toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';
import { db, getOrCreatePlan, type BudgetTransaction } from './db/database';
import { summarizeBudget } from './domain/budget';
import { monthKey, shiftMonth } from './domain/months';
import type { AppView } from './types';
import { MonthNavigation } from './components/month-navigation';
import { TransactionDialog } from './components/transaction-dialog';
import { Button } from './components/ui/button';
import { HomeView } from './views/home-view';

const ActivityView = lazy(() => import('./views/activity-view').then((module) => ({ default: module.ActivityView })));
const InsightsView = lazy(() => import('./views/insights-view').then((module) => ({ default: module.InsightsView })));
const SettingsView = lazy(() => import('./views/settings-view').then((module) => ({ default: module.SettingsView })));

const updateSW = registerSW({
  onNeedRefresh() {
    toast('An update is ready', { action: { label: 'Update', onClick: () => void updateSW(true) }, duration: Infinity });
  },
  onOfflineReady() {
    toast.success('Budget Pocket is ready offline');
  }
});

function getInitialTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('budget-pocket-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function App() {
  const [view, setView] = useState<AppView>('home');
  const [month, setMonth] = useState(monthKey());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BudgetTransaction | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [online, setOnline] = useState(navigator.onLine);

  const plan = useLiveQuery(() => getOrCreatePlan(month), [month]);
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? [];
  const transactions = useLiveQuery(
    async () => (await db.transactions.where('month').equals(month).toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [month]
  ) ?? [];
  const previousMonthTransactions = useLiveQuery(
    async () => (await db.transactions.where('month').equals(shiftMonth(month, -1)).toArray()).sort((a, b) => b.date.localeCompare(a.date)),
    [month]
  ) ?? [];

  const activeCategories = categories.filter((category) => !category.archived);
  const summaryCategories = categories.filter((category) =>
    !category.archived || category.id in (plan?.allocations ?? {}) || transactions.some((transaction) => transaction.categoryId === category.id)
  );
  const summary = useMemo(() => plan ? summarizeBudget(plan, summaryCategories, transactions) : null, [plan, summaryCategories, transactions]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('budget-pocket-theme', theme);
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#11151d' : '#f7f7f5');
    document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', theme === 'dark' ? 'black' : 'default');
  }, [theme]);

  useEffect(() => {
    const setConnected = () => setOnline(true);
    const setDisconnected = () => setOnline(false);
    window.addEventListener('online', setConnected);
    window.addEventListener('offline', setDisconnected);
    return () => { window.removeEventListener('online', setConnected); window.removeEventListener('offline', setDisconnected); };
  }, []);

  function openAdd() {
    setEditingTransaction(null);
    setDialogOpen(true);
  }

  function openEdit(transaction: BudgetTransaction) {
    setEditingTransaction(transaction);
    setDialogOpen(true);
  }

  if (!plan || !summary) {
    return <div className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">Loading your budget…</div>;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {!online && <div className="offline-banner"><WifiOff className="size-4" />Offline · changes are saved on this device</div>}
      <header className="app-header">
        <div className="app-container flex h-16 items-center justify-between gap-4">
          <button className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setView('home')}>
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><CircleDollarSign className="size-5" /></span>
            <span className="brand-name text-sm font-semibold tracking-tight sm:text-base">Budget Pocket</span>
          </button>
          <div className="flex items-center gap-1">
            <MonthNavigation month={month} onChange={setMonth} />
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} className="hidden sm:inline-flex">{theme === 'light' ? <Moon /> : <Sun />}</Button>
          </div>
        </div>
      </header>

      <main className="app-container pb-28 pt-7 sm:pb-10 sm:pt-10">
        <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading view…</p>}>
          {view === 'home' && <HomeView plan={plan} summary={summary} transactions={transactions} categories={categories} onAdd={openAdd} onEdit={openEdit} onViewActivity={() => setView('activity')} />}
          {view === 'activity' && <ActivityView transactions={transactions} categories={categories} onEdit={openEdit} />}
          {view === 'insights' && <InsightsView plan={plan} categories={summaryCategories} transactions={transactions} previousMonthTransactions={previousMonthTransactions} />}
          {view === 'settings' && <SettingsView month={month} plan={plan} categories={categories} theme={theme} onThemeChange={setTheme} />}
        </Suspense>
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <div className="bottom-nav-inner">
          <NavButton active={view === 'home'} onClick={() => setView('home')} icon={<Home />} label="Home" />
          <NavButton active={view === 'activity'} onClick={() => setView('activity')} icon={<Activity />} label="Activity" />
          <Button className="add-nav-button" size="icon" onClick={openAdd} aria-label="Record purchase"><Plus /></Button>
          <NavButton active={view === 'insights'} onClick={() => setView('insights')} icon={<ChartNoAxesCombined />} label="Insights" />
          <NavButton active={view === 'settings'} onClick={() => setView('settings')} icon={<Settings />} label="Settings" />
        </div>
      </nav>

      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} categories={activeCategories} month={month} transaction={editingTransaction} />
      <Toaster richColors position="top-center" closeButton />
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}><span className="[&_svg]:size-5">{icon}</span><span>{label}</span></button>;
}
