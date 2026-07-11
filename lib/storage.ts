import type { UserProfile, SalaryEntry, Investment, ChatMessage, DailyExpense, Goal } from '@/types';

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

function set<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
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

// --- Custom Categories ---
export interface CategoryItem { id: string; label: string; color: string; }

export const getCustomIncomes = (): CategoryItem[] => get<CategoryItem[]>(KEYS.customIncomes, []);
export const saveCustomIncomes = (list: CategoryItem[]) => set(KEYS.customIncomes, list);

export const getCustomExpenses = (): CategoryItem[] => get<CategoryItem[]>(KEYS.customExpenses, []);
export const saveCustomExpenses = (list: CategoryItem[]) => set(KEYS.customExpenses, list);

export const getCustomInvestments = (): CategoryItem[] => get<CategoryItem[]>(KEYS.customInvestments, []);
export const saveCustomInvestments = (list: CategoryItem[]) => set(KEYS.customInvestments, list);

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


