export interface UserProfile {
  name: string;
  riskAppetite: 'conservative' | 'moderate' | 'aggressive';
  monthlySalary: number;
  monthlyExpenses: number;
  emergencyFundMonths: number;
  emergencyFundCurrent: number;
  currency: string;
  claudeApiKey?: string;
  claudeModel?: string;
  newsApiKey?: string;
  onboardingComplete: boolean;
}

export interface IncomeSource {
  id: string;
  sourceName: string;
  amount: number;
  type: string;
}

export interface ExpenseItem {
  id: string;
  category: string;
  amount: number;
  notes?: string;
}

export interface SalaryEntry {
  id: string;
  month: string; // "YYYY-MM"
  grossSalary: number;
  basicSalary: number;
  hra: number;
  pf: number;
  tax: number;
  otherDeductions: number;
  expenses: number;
  savings: number;
  notes?: string;
  createdAt: string;
  incomes?: IncomeSource[];
  expenseItems?: ExpenseItem[];
}

export type InvestmentType = 'stock' | 'mutual_fund' | 'fd' | 'gold' | 'ppf' | 'real_estate' | 'crypto' | 'other';

export interface Investment {
  id: string;
  name: string;
  type: string;
  investedAmount: number;
  currentValue: number;
  quantity?: number;
  buyPrice?: number;
  sipAmount?: number;
  startDate: string;
  lastUpdated: string;
  dividends?: number;
  notes?: string;
  goalId?: string; // links this holding to a Goal (I3)
  interestRate?: number;    // for PPF/EPF/FD: annual interest %
  withdrawnAmount?: number; // for PPF/EPF: amount withdrawn so far
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  category?: string;
}

export interface CompoundParams {
  principal: number;
  monthlyContribution: number;
  annualRate: number;
  years: number;
  compoundingFrequency: number;
}

export interface CompoundResult {
  year: number;
  value: number;
  invested: number;
  interest: number;
}

export interface DailyExpense {
  id: string;
  date: string; // YYYY-MM-DD
  category: string;
  amount: number;
  description: string;
  createdAt: string;
  recurringId?: string; // set when auto-generated from a recurring template
}

// A monthly recurring expense template (rent, EMI, subscription). Each month,
// one DailyExpense is auto-logged from it on `dayOfMonth`.
export interface RecurringExpense {
  id: string;
  category: string;
  amount: number;
  description: string;
  dayOfMonth: number; // 1-28
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // "YYYY-MM-DD"
  category: string;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  name: string;
  type: 'salary' | 'savings' | 'fd' | 'current';
  balance: number;
  purpose: string; // e.g. 'Emergency Fund', 'Monthly Expenses', 'Investments', 'General'
  color: string;
}

