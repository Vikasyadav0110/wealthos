import type { SalaryEntry } from '@/types';

// Deductions (PF/tax/other) apply only to salary — the "primary" income source.
// Other income (rental, side hustle, investment, etc.) is added after
// deductions, so it isn't treated as PF/tax-eligible salary.
//
// Single source of truth for take-home so the salary page and the AI context
// never drift. Old entries saved before income sources existed have no
// `incomes[]`; for those we fall back to treating the whole grossSalary as
// salary, which matches the app's original behavior for that data.
export interface IncomeBreakdown {
  salaryIncome: number;   // PF/tax-eligible (primary source)
  otherIncome: number;    // rental, side hustle, etc. — added after deductions
  deductions: number;     // pf + tax + otherDeductions (applied to salary only)
  takeHome: number;
  legacy: boolean;        // true when the entry predates income sources
}

export function computeIncomeBreakdown(entry: SalaryEntry): IncomeBreakdown {
  const deductions = entry.pf + entry.tax + entry.otherDeductions;
  const rows = entry.incomes && entry.incomes.length > 0 ? entry.incomes : null;

  if (!rows) {
    // Legacy entry: no per-source breakdown — treat all of grossSalary as salary.
    return { salaryIncome: entry.grossSalary, otherIncome: 0, deductions, takeHome: entry.grossSalary - deductions, legacy: true };
  }

  const salaryIncome = rows.reduce((s, i) => s + (i.type === 'primary' ? i.amount : 0), 0);
  const otherIncome = rows.reduce((s, i) => s + (i.type !== 'primary' ? i.amount : 0), 0);
  return { salaryIncome, otherIncome, deductions, takeHome: (salaryIncome - deductions) + otherIncome, legacy: false };
}

export function computeTakeHome(entry: SalaryEntry): number {
  return computeIncomeBreakdown(entry).takeHome;
}
