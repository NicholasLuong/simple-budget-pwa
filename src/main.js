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
const categoryTotalsList = document.getElementById('categoryTotalsList');
const categoryAllocationForm = document.getElementById('categoryAllocationForm');
const allocationCategoryInput = document.getElementById('allocationCategoryInput');
const allocationAmountInput = document.getElementById('allocationAmountInput');
const allocationSummaryEl = document.getElementById('allocationSummary');
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');
const clearTransactionsBtn = document.getElementById('clearTransactionsBtn');

function sanitizeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function normalizeCategory(value) {
  return value.trim();
}

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

async function getCategoryAllocations() {
  const record = await db.settings.get('categoryAllocations');
  if (!record || typeof record.value !== 'object' || record.value === null) {
    return {};
  }

  return Object.entries(record.value).reduce((acc, [name, amount]) => {
    const category = normalizeCategory(name);
    if (!category) return acc;
    acc[category] = sanitizeAmount(amount);
    return acc;
  }, {});
}

async function setCategoryAllocations(allocations) {
  await db.settings.put({ key: 'categoryAllocations', value: allocations });
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

function renderAllocationSummary(budget, totalAllocated) {
  const difference = budget - totalAllocated;
  if (difference === 0) {
    allocationSummaryEl.textContent = `Allocated ${formatMoney(totalAllocated)} of ${formatMoney(budget)}. Fully assigned.`;
    allocationSummaryEl.className = 'allocation-summary good';
    return;
  }

  if (difference > 0) {
    allocationSummaryEl.textContent = `Allocated ${formatMoney(totalAllocated)} of ${formatMoney(budget)}. Assign ${formatMoney(difference)} more.`;
    allocationSummaryEl.className = 'allocation-summary warn';
    return;
  }

  allocationSummaryEl.textContent = `Allocated ${formatMoney(totalAllocated)} of ${formatMoney(budget)}. Over-assigned by ${formatMoney(Math.abs(difference))}.`;
  allocationSummaryEl.className = 'allocation-summary bad';
}

async function saveCategoryAllocation(category, amount) {
  const normalizedCategory = normalizeCategory(category);
  if (!normalizedCategory) return;

  const allocations = await getCategoryAllocations();
  allocations[normalizedCategory] = sanitizeAmount(amount);
  await setCategoryAllocations(allocations);
}

async function removeCategoryAllocation(category) {
  const normalizedCategory = normalizeCategory(category);
  if (!normalizedCategory) return;

  const allocations = await getCategoryAllocations();
  if (!Object.hasOwn(allocations, normalizedCategory)) return;

  delete allocations[normalizedCategory];
  await setCategoryAllocations(allocations);
}

async function render() {
  const [budget, transactions, allocations] = await Promise.all([
    getBudget(),
    getTransactions(),
    getCategoryAllocations()
  ]);

  budgetInput.value = String(budget);

  const totalSpent = transactions.reduce((sum, item) => sum + item.amount, 0);
  const remaining = budget - totalSpent;

  remainingBudgetEl.textContent = `Remaining: ${formatMoney(remaining)}`;
  remainingBudgetEl.style.color = remaining < 0 ? '#b91c1c' : '#166534';

  transactionList.innerHTML = '';
  categoryTotalsList.innerHTML = '';

  const spendingByCategory = transactions.reduce((totals, transaction) => {
    const key = normalizeCategory(transaction.category) || 'Uncategorized';
    totals.set(key, (totals.get(key) || 0) + sanitizeAmount(transaction.amount));
    return totals;
  }, new Map());

  const allCategories = new Set([...Object.keys(allocations), ...spendingByCategory.keys()]);
  const categoryRows = [...allCategories].map((category) => {
    const allocated = sanitizeAmount(allocations[category]);
    const spent = spendingByCategory.get(category) || 0;
    return { category, allocated, spent, available: allocated - spent };
  });

  const totalAllocated = categoryRows.reduce((sum, row) => sum + row.allocated, 0);
  renderAllocationSummary(budget, totalAllocated);

  if (!categoryRows.length) {
    const emptyCategory = document.createElement('li');
    emptyCategory.className = 'empty';
    emptyCategory.textContent = 'No category spending yet.';
    categoryTotalsList.appendChild(emptyCategory);
  } else {
    categoryRows
      .sort((a, b) => b.allocated - a.allocated || b.spent - a.spent)
      .forEach((row) => {
        const li = document.createElement('li');

        const title = document.createElement('strong');
        title.textContent = row.category;

        const stats = document.createElement('span');
        stats.className = 'category-stats';
        stats.textContent = `Spent ${formatMoney(row.spent)} / Allocated ${formatMoney(row.allocated)} / Available ${formatMoney(row.available)}`;

        const controls = document.createElement('div');
        controls.className = 'category-controls';

        const allocationInput = document.createElement('input');
        allocationInput.type = 'number';
        allocationInput.min = '0';
        allocationInput.step = '0.01';
        allocationInput.inputMode = 'decimal';
        allocationInput.className = 'allocation-input';
        allocationInput.value = String(row.allocated);
        allocationInput.setAttribute('aria-label', `Allocation for ${row.category}`);

        allocationInput.addEventListener('change', async () => {
          await saveCategoryAllocation(row.category, allocationInput.value);
          await render();
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'delete-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', async () => {
          await removeCategoryAllocation(row.category);
          await render();
        });

        controls.append(allocationInput, removeBtn);
        li.append(title, stats, controls);
        categoryTotalsList.appendChild(li);
      });
  }

  clearTransactionsBtn.disabled = !transactions.length;

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

categoryAllocationForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const category = normalizeCategory(allocationCategoryInput.value);
  const amount = Number(allocationAmountInput.value);

  if (!category || !Number.isFinite(amount) || amount < 0) {
    return;
  }

  await saveCategoryAllocation(category, amount);
  categoryAllocationForm.reset();
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

clearTransactionsBtn.addEventListener('click', async () => {
  if (!window.confirm('Clear all transactions? This cannot be undone.')) {
    return;
  }

  await db.transactions.clear();
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
