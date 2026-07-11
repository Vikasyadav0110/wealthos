import type { UserProfile, SalaryEntry, Investment, ChatMessage, DailyExpense, Goal, BankAccount, RecurringExpense } from '@/types';

const KEYS = {
  profile: 'wealthos_profile',
  salary: 'wealthos_salary',
  investments: 'wealthos_investments',
  chatHistory: 'wealthos_chat_history',
  bookmarks: 'wealthos_bookmarks',
  dailyExpenses: 'wealthos_daily_expenses',
  customIncomes: 'wealthos_custom_income_categories',
  customExpenses: 'wealthos_custom_categories', // Matches existing key
  customInvestments: 'wealthos_custom_investment_categories',
  goals: 'wealthos_goals',
  bankAccounts: 'wealthos_bank_accounts',
  recurringExpenses: 'wealthos_recurring_expenses',
};


function get<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Fired when a localStorage write fails (e.g. quota exceeded). The UI layer
// (AppShell) listens and surfaces a toast so data-loss is never silent.
export const STORAGE_ERROR_EVENT = 'wealthos:storage-error';

function set<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    const isQuota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    const message = isQuota
      ? 'Storage is full — this change was not saved. Export a backup and clear old data in Settings.'
      : 'Could not save your change. Please try again.';
    window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { message, key } }));
  }
}

// --- Profile ---
export const getProfile = (): UserProfile | null => get<UserProfile | null>(KEYS.profile, null);
export const saveProfile = (profile: UserProfile) => set(KEYS.profile, profile);

// --- Salary ---
export const getSalaryEntries = (): SalaryEntry[] => get<SalaryEntry[]>(KEYS.salary, []);
export const saveSalaryEntry = (entry: SalaryEntry) => {
  const entries = getSalaryEntries();
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  entries.sort((a, b) => b.month.localeCompare(a.month));
  set(KEYS.salary, entries);
};
export const deleteSalaryEntry = (id: string) => {
  set(KEYS.salary, getSalaryEntries().filter((e) => e.id !== id));
};

// --- Investments ---
export const getInvestments = (): Investment[] => get<Investment[]>(KEYS.investments, []);
export const saveInvestment = (inv: Investment) => {
  const items = getInvestments();
  const idx = items.findIndex((i) => i.id === inv.id);
  if (idx >= 0) items[idx] = inv;
  else items.push(inv);
  set(KEYS.investments, items);
};
export const deleteInvestment = (id: string) => {
  set(KEYS.investments, getInvestments().filter((i) => i.id !== id));
};

// --- Chat History ---
export const getChatHistory = (): ChatMessage[] => get<ChatMessage[]>(KEYS.chatHistory, []);
export const saveChatHistory = (messages: ChatMessage[]) => set(KEYS.chatHistory, messages);
export const clearChatHistory = () => set(KEYS.chatHistory, []);

// --- Bookmarks ---
export const getBookmarks = (): string[] => get<string[]>(KEYS.bookmarks, []);
export const toggleBookmark = (url: string) => {
  const bm = getBookmarks();
  const idx = bm.indexOf(url);
  if (idx >= 0) bm.splice(idx, 1);
  else bm.push(url);
  set(KEYS.bookmarks, bm);
};

// --- Daily Expenses ---
export const getDailyExpenses = (): DailyExpense[] => get<DailyExpense[]>(KEYS.dailyExpenses, []);
export const saveDailyExpense = (expense: DailyExpense) => {
  const list = getDailyExpenses();
  const idx = list.findIndex((e) => e.id === expense.id);
  if (idx >= 0) list[idx] = expense;
  else list.push(expense);
  list.sort((a, b) => b.date.localeCompare(a.date)); // Sort by date desc
  set(KEYS.dailyExpenses, list);
};
export const deleteDailyExpense = (id: string) => {
  set(KEYS.dailyExpenses, getDailyExpenses().filter((e) => e.id !== id));
};

// --- Recurring Expenses (monthly templates: rent, EMIs, subscriptions) ---
export const getRecurringExpenses = (): RecurringExpense[] => get<RecurringExpense[]>(KEYS.recurringExpenses, []);
export const saveRecurringExpense = (tpl: RecurringExpense) => {
  const list = getRecurringExpenses();
  const idx = list.findIndex((t) => t.id === tpl.id);
  if (idx >= 0) list[idx] = tpl;
  else list.push(tpl);
  set(KEYS.recurringExpenses, list);
};
export const deleteRecurringExpense = (id: string) => {
  set(KEYS.recurringExpenses, getRecurringExpenses().filter((t) => t.id !== id));
};

// Auto-log this month's due recurring expenses (idempotent: one instance per
// template per month, tracked via recurringId). Returns the created instances.
export const applyDueRecurringExpenses = (): DailyExpense[] => {
  if (typeof window === 'undefined') return [];
  const templates = getRecurringExpenses();
  if (templates.length === 0) return [];
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const today = now.getDate();
  const existing = getDailyExpenses();
  const created: DailyExpense[] = [];

  templates.forEach((tpl) => {
    if (today < tpl.dayOfMonth) return; // not due yet this month
    const already = existing.some((e) => e.recurringId === tpl.id && e.date.startsWith(month));
    if (already) return;
    const date = `${month}-${String(Math.min(tpl.dayOfMonth, 28)).padStart(2, '0')}`;
    const instance: DailyExpense = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      category: tpl.category,
      amount: tpl.amount,
      description: tpl.description,
      createdAt: new Date().toISOString(),
      recurringId: tpl.id,
    };
    saveDailyExpense(instance);
    created.push(instance);
  });
  return created;
};

// --- Custom Categories ---
export interface CategoryItem { id: string; label: string; color: string; budget?: number; }

export const DEFAULT_INCOMES: CategoryItem[] = [
  { id: 'primary', label: '💼 Primary Job', color: '#3b82f6' },
  { id: 'side_hustle', label: '🚀 Side Hustle', color: '#10b981' },
  { id: 'investment', label: '📈 Investment', color: '#fbbf24' },
  { id: 'rental', label: '🏠 Rental Income', color: '#ec4899' },
  { id: 'other', label: '💰 Other', color: '#94a3b8' },
];

export const DEFAULT_EXPENSES: CategoryItem[] = [
  { id: 'rent', label: '🏠 Rent / Housing', color: '#ec4899' },
  { id: 'groceries', label: '🛒 Groceries / Food', color: '#10b981' },
  { id: 'utilities', label: '🔌 Bills / Utilities', color: '#3b82f6' },
  { id: 'entertainment', label: '🎬 Fun / Leisure', color: '#8b5cf6' },
  { id: 'transport', label: '🚗 Transport / Fuel', color: '#06b6d4' },
  { id: 'emi_car', label: '🚗 EMI - Car', color: '#f59e0b' },
  { id: 'emi_phone', label: '📱 EMI - Phone', color: '#14b8a6' },
  { id: 'healthcare', label: '🏥 Medical / Health', color: '#ef4444' },
  { id: 'education', label: '📚 Study / Kids', color: '#a855f7' },
  { id: 'other', label: '🛍️ Other Expenses', color: '#94a3b8' },
];

export const DEFAULT_INVESTMENTS: CategoryItem[] = [
  { id: 'stock', label: '📈 Stocks', color: '#3b82f6' },
  { id: 'mutual_fund', label: '💼 Mutual Funds', color: '#10b981' },
  { id: 'fd', label: '🏦 Fixed Deposits', color: '#fbbf24' },
  { id: 'gold', label: '🏅 Gold / SGB', color: '#f59e0b' },
  { id: 'ppf', label: '💳 PPF / EPF', color: '#8b5cf6' },
  { id: 'real_estate', label: '🏠 Real Estate', color: '#ec4899' },
  { id: 'crypto', label: '🪙 Crypto', color: '#06b6d4' },
  { id: 'other', label: '🏷️ Other Assets', color: '#94a3b8' },
];

export const getCustomIncomes = (): CategoryItem[] => {
  if (typeof window === 'undefined') return DEFAULT_INCOMES;
  const raw = localStorage.getItem(KEYS.customIncomes);
  if (!raw) {
    set(KEYS.customIncomes, DEFAULT_INCOMES);
    return DEFAULT_INCOMES;
  }
  let list: CategoryItem[];
  try {
    list = JSON.parse(raw) as CategoryItem[];
  } catch {
    set(KEYS.customIncomes, DEFAULT_INCOMES);
    return DEFAULT_INCOMES;
  }
  const hasDefaults = list.some(c => DEFAULT_INCOMES.some(d => d.id === c.id));
  if (!hasDefaults) {
    const merged = [...DEFAULT_INCOMES, ...list];
    set(KEYS.customIncomes, merged);
    return merged;
  }
  return list;
};
export const saveCustomIncomes = (list: CategoryItem[]) => set(KEYS.customIncomes, list);

export const getCustomExpenses = (): CategoryItem[] => {
  if (typeof window === 'undefined') return DEFAULT_EXPENSES;
  const raw = localStorage.getItem(KEYS.customExpenses);
  if (!raw) {
    set(KEYS.customExpenses, DEFAULT_EXPENSES);
    return DEFAULT_EXPENSES;
  }
  let list: CategoryItem[];
  try {
    list = JSON.parse(raw) as CategoryItem[];
  } catch {
    set(KEYS.customExpenses, DEFAULT_EXPENSES);
    return DEFAULT_EXPENSES;
  }
  const hasDefaults = list.some(c => DEFAULT_EXPENSES.some(d => d.id === c.id));
  if (!hasDefaults) {
    const merged = [...DEFAULT_EXPENSES, ...list];
    set(KEYS.customExpenses, merged);
    return merged;
  }
  return list;
};
export const saveCustomExpenses = (list: CategoryItem[]) => set(KEYS.customExpenses, list);

export const getCustomInvestments = (): CategoryItem[] => {
  if (typeof window === 'undefined') return DEFAULT_INVESTMENTS;
  const raw = localStorage.getItem(KEYS.customInvestments);
  if (!raw) {
    set(KEYS.customInvestments, DEFAULT_INVESTMENTS);
    return DEFAULT_INVESTMENTS;
  }
  let list: CategoryItem[];
  try {
    list = JSON.parse(raw) as CategoryItem[];
  } catch {
    set(KEYS.customInvestments, DEFAULT_INVESTMENTS);
    return DEFAULT_INVESTMENTS;
  }
  const hasDefaults = list.some(c => DEFAULT_INVESTMENTS.some(d => d.id === c.id));
  if (!hasDefaults) {
    const merged = [...DEFAULT_INVESTMENTS, ...list];
    set(KEYS.customInvestments, merged);
    return merged;
  }
  return list;
};
export const saveCustomInvestments = (list: CategoryItem[]) => set(KEYS.customInvestments, list);

export const resetCategoriesToDefaults = () => {
  if (typeof window === 'undefined') return;
  set(KEYS.customIncomes, DEFAULT_INCOMES);
  set(KEYS.customExpenses, DEFAULT_EXPENSES);
  set(KEYS.customInvestments, DEFAULT_INVESTMENTS);
};

// --- Goals ---
export const getGoals = (): Goal[] => get<Goal[]>(KEYS.goals, []);
export const saveGoal = (goal: Goal) => {
  const list = getGoals();
  const idx = list.findIndex((g) => g.id === goal.id);
  if (idx >= 0) list[idx] = goal;
  else list.push(goal);
  list.sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  set(KEYS.goals, list);
};
export const deleteGoal = (id: string) => {
  set(KEYS.goals, getGoals().filter((g) => g.id !== id));
};

// --- Bank Accounts ---
export const getBankAccounts = (): BankAccount[] => get<BankAccount[]>(KEYS.bankAccounts, []);
export const saveBankAccounts = (accounts: BankAccount[]) => set(KEYS.bankAccounts, accounts);
