/* ============================================================
   BudgetWise — script.js
   Vanilla JavaScript: zero external dependencies.

   Data is stored in localStorage, keyed by month (YYYY-MM).
   Structure of monthData:
     {
       budget: number,
       expenses: [{ id, desc, amount, category, date }],
       categoryLimits: { [category]: number }
     }
============================================================ */

'use strict';

/* ── Constants ─────────────────────────────────────────────── */
const STORAGE_KEY = 'budgetwise_data';

const CATEGORY_COLORS = {
  'Food & Drinks':  '#f97316',
  'Transportation': '#2563eb',
  'Housing':        '#7c3aed',
  'Health':         '#10b981',
  'Shopping':       '#ec4899',
  'Entertainment':  '#f59e0b',
  'Education':      '#06b6d4',
  'Utilities':      '#64748b',
  'Savings':        '#22c55e',
  'Others':         '#9ca3af',
};

const CATEGORY_EMOJIS = {
  'Food & Drinks':  '🍔',
  'Transportation': '🚗',
  'Housing':        '🏠',
  'Health':         '💊',
  'Shopping':       '🛍️',
  'Entertainment':  '🎬',
  'Education':      '📚',
  'Utilities':      '💡',
  'Savings':        '💰',
  'Others':         '📦',
};

/* ── Helpers ───────────────────────────────────────────────── */

/** Format number to Rupiah string: "Rp 1.500.000" */
function formatRp(num) {
  if (isNaN(num) || num === null) return 'Rp 0';
  return 'Rp ' + Math.abs(num).toLocaleString('id-ID');
}

/** Generate a simple unique ID */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** Format ISO date string to readable: "15 Jan 2025" */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Get today as YYYY-MM-DD */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Get current YYYY-MM */
function currentYearMonth() {
  return new Date().toISOString().slice(0, 7);
}

/** Days remaining in the given month (YYYY-MM) */
function daysRemainingInMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const today = new Date();
  const lastDay = new Date(y, m, 0).getDate();
  // If viewing the current month, calculate from today; else use full month
  const isCurrentMonth = (today.getFullYear() === y && today.getMonth() + 1 === m);
  return isCurrentMonth ? Math.max(1, lastDay - today.getDate() + 1) : lastDay;
}

/* ── LocalStorage ──────────────────────────────────────────── */

/** Load all stored data */
function loadStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

/** Save all data */
function saveStorage(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Get or create data object for the active month */
function getMonthData(month) {
  const all = loadStorage();
  if (!all[month]) {
    all[month] = { budget: 0, expenses: [], categoryLimits: {} };
    saveStorage(all);
  }
  return all[month];
}

/** Persist updated month data */
function setMonthData(month, data) {
  const all = loadStorage();
  all[month] = data;
  saveStorage(all);
}

/* ── App State ─────────────────────────────────────────────── */
let activeMonth = currentYearMonth();   // currently viewed month
let filterCategory = '';                // category filter for history table
let searchQuery = '';                   // free-text search for history table

/* ── DOM References ────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const monthSelector       = $('monthSelector');
const budgetInput         = $('budgetInput');
const setBudgetBtn        = $('setBudgetBtn');
const budgetProgressBar   = $('budgetProgressBar');
const progressPercent     = $('progressPercent');
const healthScoreBlock    = $('healthScoreBlock');
const healthScoreCircle   = $('healthScoreCircle');
const healthScoreLabel    = $('healthScoreLabel');
const healthScoreDesc     = $('healthScoreDesc');

const statBudget          = $('statBudget');
const statSpent           = $('statSpent');
const statRemaining       = $('statRemaining');
const statDaily           = $('statDaily');

const warningBanner       = $('warningBanner');
const warningText         = $('warningText');

const expenseForm         = $('expenseForm');
const expenseDesc         = $('expenseDesc');
const expenseAmount       = $('expenseAmount');
const expenseCategory     = $('expenseCategory');
const expenseDate         = $('expenseDate');
const submitExpenseBtn    = $('submitExpenseBtn');

const affordInput         = $('affordInput');
const affordBtn           = $('affordBtn');
const affordResult        = $('affordResult');

const categoryLimitsList  = $('categoryLimitsList');
const breakdownList       = $('breakdownList');
const monthlyComparisonChart = $('monthlyComparisonChart');

const transactionBody     = $('transactionBody');
const emptyState          = $('emptyState');
const searchInput         = $('searchInput');
const filterCategoryEl    = $('filterCategory');
const clearAllBtn         = $('clearAllBtn');
const txCount             = $('txCount');
const txTotal             = $('txTotal');

const editModal           = $('editModal');
const editId              = $('editId');
const editDesc            = $('editDesc');
const editAmount          = $('editAmount');
const editCategory        = $('editCategory');
const editDate            = $('editDate');
const editForm            = $('editForm');
const closeModalBtn       = $('closeModalBtn');
const closeModalBtnAlt    = $('closeModalBtnAlt');

const toast               = $('toast');

/* ── Toast ─────────────────────────────────────────────────── */
let toastTimer;
/**
 * Show a toast notification.
 * @param {string} msg  - Message text
 * @param {'success'|'error'|'warning'} type
 */
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

/* ── Budget Operations ─────────────────────────────────────── */

/** Set the monthly budget and re-render everything */
function setBudget() {
  const val = parseFloat(budgetInput.value);
  if (isNaN(val) || val < 0) {
    showToast('Please enter a valid budget amount.', 'error');
    return;
  }
  const data = getMonthData(activeMonth);
  data.budget = val;
  setMonthData(activeMonth, data);
  budgetInput.value = '';
  showToast('Monthly budget updated!', 'success');
  renderAll();
}

/* ── Expense CRUD ──────────────────────────────────────────── */

/** Add a new expense from the main form */
function addExpense(e) {
  e.preventDefault();
  const desc   = expenseDesc.value.trim();
  const amount = parseFloat(expenseAmount.value);
  const cat    = expenseCategory.value;
  const date   = expenseDate.value || todayISO();

  // Validation
  if (!desc) { flashError(expenseDesc); showToast('Please enter a description.', 'error'); return; }
  if (!amount || amount <= 0) { flashError(expenseAmount); showToast('Please enter a valid amount.', 'error'); return; }
  if (!cat) { flashError(expenseCategory); showToast('Please select a category.', 'error'); return; }

  const data = getMonthData(activeMonth);
  data.expenses.push({ id: uid(), desc, amount, category: cat, date });
  setMonthData(activeMonth, data);

  // Reset form
  expenseForm.reset();
  expenseDate.value = todayISO();
  showToast('Expense added!', 'success');
  renderAll();
}

/** Briefly highlight an input field as erroneous */
function flashError(el) {
  el.classList.add('error');
  setTimeout(() => el.classList.remove('error'), 1500);
}

/** Delete an expense by ID */
function deleteExpense(id) {
  const data = getMonthData(activeMonth);
  data.expenses = data.expenses.filter(ex => ex.id !== id);
  setMonthData(activeMonth, data);
  showToast('Expense deleted.', 'warning');
  renderAll();
}

/** Open the edit modal populated with expense data */
function openEditModal(id) {
  const data = getMonthData(activeMonth);
  const ex = data.expenses.find(e => e.id === id);
  if (!ex) return;
  editId.value       = id;
  editDesc.value     = ex.desc;
  editAmount.value   = ex.amount;
  editCategory.value = ex.category;
  editDate.value     = ex.date;
  editModal.classList.remove('hidden');
  editDesc.focus();
}

/** Save edits from the modal form */
function saveEdit(e) {
  e.preventDefault();
  const id     = editId.value;
  const desc   = editDesc.value.trim();
  const amount = parseFloat(editAmount.value);
  const cat    = editCategory.value;
  const date   = editDate.value || todayISO();

  if (!desc)              { flashError(editDesc);    showToast('Description required.', 'error'); return; }
  if (!amount || amount <= 0) { flashError(editAmount); showToast('Valid amount required.', 'error'); return; }

  const data = getMonthData(activeMonth);
  const idx = data.expenses.findIndex(e => e.id === id);
  if (idx === -1) return;

  data.expenses[idx] = { id, desc, amount, category: cat, date };
  setMonthData(activeMonth, data);
  closeModal();
  showToast('Expense updated!', 'success');
  renderAll();
}

/** Close the edit modal */
function closeModal() {
  editModal.classList.add('hidden');
}

/* ── Calculations ──────────────────────────────────────────── */

/** Total spending for the active month */
function calcTotalSpent(expenses) {
  return expenses.reduce((sum, ex) => sum + ex.amount, 0);
}

/** Breakdown: { category -> total } sorted by total desc */
function calcBreakdown(expenses) {
  const map = {};
  expenses.forEach(ex => {
    map[ex.category] = (map[ex.category] || 0) + ex.amount;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

/** Financial Health Score (0-100) */
function calcHealthScore(spent, budget) {
  if (!budget) return null;
  const pct = spent / budget;
  if (pct <= 0.50) return 100;
  if (pct <= 0.70) return Math.round(100 - (pct - 0.50) / 0.20 * 20);   // 80–100
  if (pct <= 0.90) return Math.round(80  - (pct - 0.70) / 0.20 * 30);   // 50–80
  if (pct <= 1.00) return Math.round(50  - (pct - 0.90) / 0.10 * 30);   // 20–50
  return Math.max(0, Math.round(20 - (pct - 1.00) * 40));
}

/** Health score label & description */
function healthLabel(score) {
  if (score >= 90) return { label: 'Excellent', desc: 'Great money management!', color: '#22c55e' };
  if (score >= 70) return { label: 'Good',      desc: 'You\'re doing well.',      color: '#84cc16' };
  if (score >= 50) return { label: 'Fair',       desc: 'Keep an eye on spending.', color: '#f59e0b' };
  if (score >= 25) return { label: 'Poor',       desc: 'Reduce spending soon.',    color: '#f97316' };
  return { label: 'Critical', desc: 'Budget seriously exceeded!', color: '#ef4444' };
}

/* ── Render Functions ──────────────────────────────────────── */

/** Master render — calls all sub-renders */
function renderAll() {
  const data     = getMonthData(activeMonth);
  const expenses = data.expenses;
  const budget   = data.budget;
  const spent    = calcTotalSpent(expenses);
  const remaining = budget - spent;
  const pct       = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const daysLeft  = daysRemainingInMonth(activeMonth);
  const dailyRec  = budget > 0 ? Math.max(0, remaining / daysLeft) : 0;

  renderSummaryCards(budget, spent, remaining, dailyRec);
  renderProgressBar(pct, spent, budget);
  renderHealthScore(spent, budget);
  renderWarning(pct, spent, budget);
  renderBreakdown(expenses, spent);
  renderCategoryLimits(data, expenses);
  renderTransactionTable(expenses);
  renderMonthlyComparison();
}

/** Update the 4 top stat cards */
function renderSummaryCards(budget, spent, remaining, dailyRec) {
  statBudget.textContent    = formatRp(budget);
  statSpent.textContent     = formatRp(spent);
  statRemaining.textContent = formatRp(remaining);
  statRemaining.className   = 'stat-value ' + (remaining >= 0 ? 'text-green-600' : 'text-red-500');
  statDaily.textContent     = formatRp(dailyRec);
}

/** Update the progress bar */
function renderProgressBar(pct, spent, budget) {
  budgetProgressBar.style.width = pct + '%';

  // Color shift: green → orange → red
  if (pct >= 100)     budgetProgressBar.className = 'h-full rounded-full bg-red-500 transition-all duration-500';
  else if (pct >= 80) budgetProgressBar.className = 'h-full rounded-full bg-orange-400 transition-all duration-500';
  else                budgetProgressBar.className = 'h-full rounded-full bg-primary transition-all duration-500';

  progressPercent.textContent = Math.round(pct) + '%';
}

/** Update the financial health score widget */
function renderHealthScore(spent, budget) {
  const score = calcHealthScore(spent, budget);
  if (score === null) { healthScoreBlock.classList.add('hidden'); return; }
  healthScoreBlock.classList.remove('hidden');
  const { label, desc, color } = healthLabel(score);
  healthScoreCircle.textContent        = score;
  healthScoreCircle.style.background   = color;
  healthScoreLabel.textContent         = label;
  healthScoreDesc.textContent          = desc;
}

/** Show or hide the budget warning banner */
function renderWarning(pct, spent, budget) {
  if (!budget || pct < 80) {
    warningBanner.classList.add('hidden');
    warningBanner.classList.remove('flex');
    return;
  }
  warningBanner.classList.remove('hidden');
  warningBanner.classList.add('flex');
  // Swap background colour cleanly
  warningBanner.classList.remove('bg-red-50', 'bg-orange-50', 'border-red-200', 'border-orange-200', 'text-red-700', 'text-orange-700');
  if (pct >= 100) {
    warningBanner.classList.add('bg-red-50', 'border-red-200', 'text-red-700');
    warningText.textContent = `⚠️ Budget exceeded! You spent ${formatRp(spent - budget)} over your ${formatRp(budget)} budget.`;
  } else {
    warningBanner.classList.add('bg-orange-50', 'border-orange-200', 'text-orange-700');
    warningText.textContent = `⚠️ Heads up! You've used ${Math.round(pct)}% of your budget. Only ${formatRp(budget - spent)} remaining.`;
  }
}

/** Render the spending breakdown section */
function renderBreakdown(expenses, totalSpent) {
  if (!expenses.length) {
    breakdownList.innerHTML = '<p class="text-sm text-gray-400 italic">No expenses yet.</p>';
    return;
  }
  const breakdown = calcBreakdown(expenses);
  breakdownList.innerHTML = breakdown.map(([cat, total]) => {
    const pct   = totalSpent > 0 ? (total / totalSpent) * 100 : 0;
    const color = CATEGORY_COLORS[cat] || '#9ca3af';
    const emoji = CATEGORY_EMOJIS[cat] || '📦';
    return `
      <div>
        <div class="flex justify-between items-center mb-1 text-xs">
          <span class="font-medium text-gray-700">${emoji} ${cat}</span>
          <span class="text-gray-500">${formatRp(total)} <span class="text-gray-400">(${Math.round(pct)}%)</span></span>
        </div>
        <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div class="breakdown-bar" style="width:${pct}%; background:${color};"></div>
        </div>
      </div>`;
  }).join('');
}

/** Render the category limits editor */
function renderCategoryLimits(data, expenses) {
  if (!data.budget) {
    categoryLimitsList.innerHTML = '<p class="text-sm text-gray-500 italic">Set a budget first to configure limits.</p>';
    return;
  }

  // Build breakdown lookup
  const spent = {};
  expenses.forEach(ex => { spent[ex.category] = (spent[ex.category] || 0) + ex.amount; });

  const cats = Object.keys(CATEGORY_EMOJIS);
  categoryLimitsList.innerHTML = cats.map(cat => {
    const limit     = data.categoryLimits[cat] || 0;
    const catSpent  = spent[cat] || 0;
    const overLimit = limit > 0 && catSpent > limit;
    return `
      <div class="flex items-center gap-2 text-xs">
        <span class="w-28 shrink-0 text-gray-600">${CATEGORY_EMOJIS[cat]} ${cat}</span>
        <input
          type="number"
          min="0"
          placeholder="No limit"
          value="${limit || ''}"
          data-cat="${cat}"
          class="form-input py-1 text-xs flex-1"
          style="font-size:0.72rem;"
          onchange="updateCategoryLimit(this)"
        />
        ${catSpent > 0 ? `<span class="${overLimit ? 'text-red-500 font-semibold' : 'text-gray-400'}" title="Spent this month">${formatRp(catSpent)}</span>` : ''}
      </div>`;
  }).join('');
}

/** Persist a category limit change */
function updateCategoryLimit(inputEl) {
  const cat   = inputEl.dataset.cat;
  const val   = parseFloat(inputEl.value) || 0;
  const data  = getMonthData(activeMonth);
  data.categoryLimits[cat] = val;
  setMonthData(activeMonth, data);
  showToast(`Limit for "${cat}" updated.`, 'success');
  renderAll();
}

/** Render the transaction history table with filters */
function renderTransactionTable(allExpenses) {
  // Apply filters
  let filtered = allExpenses.filter(ex => {
    const matchCat    = !filterCategory || ex.category === filterCategory;
    const matchSearch = !searchQuery    || ex.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  // Sort newest first
  filtered = filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Update count + total
  const total = filtered.reduce((s, ex) => s + ex.amount, 0);
  txCount.textContent = filtered.length;
  txTotal.textContent = formatRp(total);

  // Show/hide clear button
  clearAllBtn.classList.toggle('hidden', allExpenses.length === 0);

  if (!filtered.length) {
    transactionBody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  const color = cat => CATEGORY_COLORS[cat] || '#9ca3af';
  const emoji = cat => CATEGORY_EMOJIS[cat] || '📦';

  transactionBody.innerHTML = filtered.map(ex => `
    <tr data-id="${ex.id}">
      <td class="font-medium text-gray-800 max-w-[160px] truncate" title="${ex.desc}">${ex.desc}</td>
      <td>
        <span class="cat-badge" style="background:${color(ex.category)}18; color:${color(ex.category)};">
          ${emoji(ex.category)} ${ex.category}
        </span>
      </td>
      <td class="text-gray-400 hidden sm:table-cell">${formatDate(ex.date)}</td>
      <td class="text-right font-semibold text-red-500 whitespace-nowrap">${formatRp(ex.amount)}</td>
      <td class="text-center whitespace-nowrap">
        <button
          class="btn-icon text-blue-400 hover:bg-blue-50 hover:text-blue-600 mr-1"
          onclick="openEditModal('${ex.id}')"
          title="Edit"
          aria-label="Edit expense"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          class="btn-icon text-red-400 hover:bg-red-50 hover:text-red-600"
          onclick="confirmDelete('${ex.id}')"
          title="Delete"
          aria-label="Delete expense"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>`).join('');
}

/** Confirm before deleting an expense */
function confirmDelete(id) {
  if (window.confirm('Delete this expense?')) {
    deleteExpense(id);
  }
}

/** Render the monthly comparison bar chart (last 6 months) */
function renderMonthlyComparison() {
  const allData = loadStorage();
  const months  = [];

  // Build last 6 months list ending with activeMonth
  for (let i = 5; i >= 0; i--) {
    const [y, m]  = activeMonth.split('-').map(Number);
    const date    = new Date(y, m - 1 - i, 1);
    const ym      = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push(ym);
  }

  const dataset = months.map(ym => {
    const d = allData[ym];
    return {
      month:  ym,
      label:  new Date(ym + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      spent:  d ? calcTotalSpent(d.expenses) : 0,
      budget: d ? d.budget : 0,
    };
  });

  const hasData = dataset.some(d => d.spent > 0 || d.budget > 0);
  if (!hasData) {
    monthlyComparisonChart.innerHTML = '<p class="text-sm text-gray-400 italic">No data for comparison yet.</p>';
    return;
  }

  const maxVal = Math.max(...dataset.map(d => Math.max(d.spent, d.budget)), 1);

  monthlyComparisonChart.innerHTML = dataset.map(d => {
    const spentPct  = (d.spent  / maxVal) * 100;
    const budgetPct = (d.budget / maxVal) * 100;
    const isActive  = d.month === activeMonth;
    return `
      <div class="space-y-0.5">
        <div class="flex items-center justify-between text-xs mb-0.5">
          <span class="font-${isActive ? 'semibold text-primary' : 'normal text-gray-500'} w-14 shrink-0">${d.label}</span>
          <span class="text-gray-400">${formatRp(d.spent)}${d.budget ? ' / ' + formatRp(d.budget) : ''}</span>
        </div>
        <div class="flex gap-1 items-center">
          <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500" style="width:${spentPct}%; background:${isActive ? '#2563eb' : '#93c5fd'};"></div>
          </div>
        </div>
        ${d.budget ? `
        <div class="flex-1 h-1.5 bg-gray-50 rounded-full overflow-hidden ml-0">
          <div class="h-full rounded-full bg-orange-200 transition-all duration-500" style="width:${budgetPct}%;"></div>
        </div>` : ''}
      </div>`;
  }).join('');
}

/* ── "Can I Afford This?" ───────────────────────────────────── */

function checkAfford() {
  const amount = parseFloat(affordInput.value);
  if (!amount || amount <= 0) {
    affordResult.className = 'text-sm rounded-lg px-3 py-2 font-medium text-center bg-gray-100 text-gray-500';
    affordResult.textContent = 'Enter a positive amount to check.';
    affordResult.classList.remove('hidden');
    return;
  }

  const data      = getMonthData(activeMonth);
  const spent     = calcTotalSpent(data.expenses);
  const remaining = data.budget - spent;

  affordResult.classList.remove('hidden');

  if (!data.budget) {
    affordResult.className   = 'text-sm rounded-lg px-3 py-2 font-medium text-center bg-yellow-50 text-yellow-700';
    affordResult.textContent = '⚠️ Set a monthly budget first.';
  } else if (amount <= remaining) {
    affordResult.className   = 'text-sm rounded-lg px-3 py-2 font-medium text-center bg-green-50 text-green-700';
    affordResult.textContent = `✅ Yes! You can afford ${formatRp(amount)}. You'll have ${formatRp(remaining - amount)} left.`;
  } else {
    affordResult.className   = 'text-sm rounded-lg px-3 py-2 font-medium text-center bg-red-50 text-red-700';
    affordResult.textContent = `❌ No. You'd need ${formatRp(amount - remaining)} more. Currently only ${formatRp(Math.max(0, remaining))} left.`;
  }
}

/* ── Clear All Expenses ────────────────────────────────────── */

function clearAllExpenses() {
  if (!window.confirm('Delete ALL expenses for this month? This cannot be undone.')) return;
  const data = getMonthData(activeMonth);
  data.expenses = [];
  setMonthData(activeMonth, data);
  showToast('All expenses cleared.', 'warning');
  renderAll();
}

/* ── Month Selector Initialisation ────────────────────────── */

function initMonthSelector() {
  monthSelector.value = activeMonth;
  expenseDate.value   = todayISO();
}

/* ── Event Listeners ───────────────────────────────────────── */

// Month selector change
monthSelector.addEventListener('change', () => {
  activeMonth = monthSelector.value || currentYearMonth();
  renderAll();
});

// Set budget
setBudgetBtn.addEventListener('click', setBudget);
budgetInput.addEventListener('keydown', e => { if (e.key === 'Enter') setBudget(); });

// Add expense form submit
expenseForm.addEventListener('submit', addExpense);

// Edit modal form submit
editForm.addEventListener('submit', saveEdit);

// Close modal buttons
closeModalBtn.addEventListener('click',    closeModal);
closeModalBtnAlt.addEventListener('click', closeModal);

// Close modal on backdrop click
editModal.addEventListener('click', e => {
  if (e.target === editModal) closeModal();
});

// Can I afford this
affordBtn.addEventListener('click', checkAfford);
affordInput.addEventListener('keydown', e => { if (e.key === 'Enter') checkAfford(); });

// Search input
searchInput.addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  const data  = getMonthData(activeMonth);
  renderTransactionTable(data.expenses);
});

// Category filter
filterCategoryEl.addEventListener('change', e => {
  filterCategory = e.target.value;
  const data = getMonthData(activeMonth);
  renderTransactionTable(data.expenses);
});

// Clear all
clearAllBtn.addEventListener('click', clearAllExpenses);

// Keyboard: close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

/* ── Expose functions used in inline event handlers ─────────── */
// (These are needed because renderTransactionTable / renderCategoryLimits
//  inject onclick strings into the DOM)
window.openEditModal       = openEditModal;
window.confirmDelete       = confirmDelete;
window.updateCategoryLimit = updateCategoryLimit;

/* ── Bootstrap ─────────────────────────────────────────────── */
(function init() {
  initMonthSelector();
  renderAll();
})();
