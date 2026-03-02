import Dexie from './vendor/dexie.js';

const db = new Dexie('budgetTrackerDB');
db.version(1).stores({
  settings: 'key',
  transactions: '++id,timestamp'
});

const DEFAULT_BUDGET = 2000;

const budgetInput = document.getElementById('budgetInput');
const remainingBudgetEl = document.getElementById('remainingBudget');
const transactionForm = document.getElementById('transactionForm');
const amountInput = document.getElementById('amountInput');
const categoryInput = document.getElementById('categoryInput');
const transactionList = document.getElementById('transactionList');
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');

async function getBudget() {
  const record = await db.settings.get('monthlyBudget');
  if (!record) {
    await db.settings.put({ key: 'monthlyBudget', value: DEFAULT_BUDGET });
    return DEFAULT_BUDGET;
  }
  return Number(record.value) || DEFAULT_BUDGET;
}

async function setBudget(value) {
  await db.settings.put({ key: 'monthlyBudget', value });
}

async function getTransactions() {
  return db.transactions.orderBy('timestamp').reverse().toArray();
}

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

async function render() {
  const [budget, transactions] = await Promise.all([getBudget(), getTransactions()]);
  budgetInput.value = String(budget);
  const totalSpent = transactions.reduce((sum, item) => sum + item.amount, 0);
  const remaining = budget - totalSpent;

  remainingBudgetEl.textContent = `Remaining: ${formatMoney(remaining)}`;
  remainingBudgetEl.style.color = remaining < 0 ? '#b91c1c' : '#166534';

  transactionList.innerHTML = '';
  if (!transactions.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No transactions yet.';
    transactionList.appendChild(empty);
    return;
  }

  transactions.forEach((transaction) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${transaction.category}</strong>
      <span>${formatMoney(transaction.amount)}</span>
      <span class="meta">${formatDate(transaction.timestamp)}</span>
    `;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      await db.transactions.delete(transaction.id);
      await render();
    });

    li.appendChild(deleteBtn);
    transactionList.appendChild(li);
  });
}

budgetInput.addEventListener('change', async () => {
  const value = Number(budgetInput.value);
  if (!Number.isFinite(value) || value < 0) {
    budgetInput.value = String(await getBudget());
    return;
  }
  await setBudget(value);
  await render();
});

transactionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const amount = Number(amountInput.value);
  const category = categoryInput.value.trim();

  if (!Number.isFinite(amount) || amount < 0 || !category) {
    return;
  }

  await db.transactions.add({
    amount,
    category,
    timestamp: Date.now()
  });

  transactionForm.reset();
  await render();
});

exportBtn.addEventListener('click', async () => {
  const [settings, transactions] = await Promise.all([
    db.settings.toArray(),
    db.transactions.toArray()
  ]);

  const blob = new Blob([JSON.stringify({ settings, transactions }, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'budget-tracker-export.json';
  link.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0];
  if (!file) return;

  const content = await file.text();
  const parsed = JSON.parse(content);
  const settings = Array.isArray(parsed.settings) ? parsed.settings : [];
  const transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];

  await db.transaction('rw', db.settings, db.transactions, async () => {
    await db.settings.clear();
    await db.transactions.clear();
    if (settings.length) await db.settings.bulkPut(settings);
    if (transactions.length) await db.transactions.bulkPut(transactions);
  });

  importInput.value = '';
  await render();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // ignore registration error; app still functions online
    });
  });
}

render();
