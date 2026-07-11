import type { UserProfile, SalaryEntry, Investment } from '@/types';
import { formatFullCurrency, formatPercent } from './formatters';
import { getDailyExpenses } from './storage';

export function buildFinancialContext(
  profile: UserProfile,
  salaryEntries: SalaryEntry[],
  investments: Investment[],
  recentNews?: string[]
): string {
  const latestSalary = salaryEntries[0];
  const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
  const totalCurrent = investments.reduce((s, i) => s + i.currentValue, 0);
  const totalPL = totalCurrent - totalInvested;
  
  // Daily transactions context
  const dailyExpenses = getDailyExpenses().slice(0, 15);
  const dailyExpensesList = dailyExpenses
    .map((exp) => `  - Date: ${exp.date}, Category: ${exp.category.toUpperCase()}, Amount: ₹${exp.amount.toLocaleString('en-IN')}, Description: ${exp.description}`)
    .join('\n');

  const savingsRate = latestSalary
    ? Math.round((latestSalary.savings / latestSalary.grossSalary) * 100)
    : 0;

  const portfolioBreakdown = investments
    .map((inv) => {
      const pl = inv.currentValue - inv.investedAmount;
      const plPct = inv.investedAmount > 0 ? (pl / inv.investedAmount) * 100 : 0;
      return `  - ${inv.name} (${inv.type}): Invested ${formatFullCurrency(inv.investedAmount)}, Current ${formatFullCurrency(inv.currentValue)}, P&L ${formatFullCurrency(pl)} (${formatPercent(plPct)})`;
    })
    .join('\n');

  const allocationByType: Record<string, number> = {};
  investments.forEach((inv) => {
    allocationByType[inv.type] = (allocationByType[inv.type] || 0) + inv.currentValue;
  });
  const allocationStr = Object.entries(allocationByType)
    .map(([t, v]) => `  - ${t}: ₹${v.toLocaleString('en-IN')}`)
    .join('\n');

  let salaryIncomeStr = '- No salary data entered yet';
  if (latestSalary) {
    const takeHome = latestSalary.grossSalary - latestSalary.pf - latestSalary.tax - latestSalary.otherDeductions;
    
    // Incomes breakdown
    const incomes = latestSalary.incomes || [
      { id: 'default', sourceName: 'Primary Salary', amount: latestSalary.grossSalary, type: 'primary' }
    ];
    const incomesList = incomes
      .map((inc) => `  * ${inc.sourceName} (${inc.type.replace('_', ' ')}): ₹${inc.amount.toLocaleString('en-IN')}`)
      .join('\n');

    // Expenses breakdown
    const expenses = latestSalary.expenseItems || [
      { id: 'default', category: 'other', amount: latestSalary.expenses }
    ];
    const expensesList = expenses
      .map((exp) => `  * ${exp.category.toUpperCase()}${exp.notes ? ` (${exp.notes})` : ''}: ₹${exp.amount.toLocaleString('en-IN')}`)
      .join('\n');

    salaryIncomeStr = `- Total Gross Income: ₹${latestSalary.grossSalary.toLocaleString('en-IN')}
Income Sources:
${incomesList}
- Deductions: Tax (₹${latestSalary.tax.toLocaleString('en-IN')}), PF (₹${latestSalary.pf.toLocaleString('en-IN')}), Other (₹${latestSalary.otherDeductions.toLocaleString('en-IN')})
- Net Take-Home: ₹${takeHome.toLocaleString('en-IN')}
- Total Expenses: ₹${latestSalary.expenses.toLocaleString('en-IN')}
Expense Categories:
${expensesList}
- Net Monthly Savings: ₹${latestSalary.savings.toLocaleString('en-IN')}
- Savings Rate: ${savingsRate}%`;
  }

  const newsContext = recentNews && recentNews.length > 0
    ? `\nRECENT MARKET NEWS:\n${recentNews.slice(0, 5).map((h, i) => `  ${i + 1}. ${h}`).join('\n')}`
    : '';

  return `You are WealthOS AI, a personal financial advisor. You have access to the user's real financial data below. Always give specific, actionable advice based on their actual numbers. Be concise, friendly, and practical. Format responses with clear sections when helpful.

USER FINANCIAL PROFILE:
- Name: ${profile.name}
- Risk Appetite: ${profile.riskAppetite}
- Currency: INR (₹)

SALARY & INCOME (Latest Month):
${salaryIncomeStr}

DAILY TRANSACTION LOG (Recent 15 logs):
${dailyExpensesList || '  - No transactions logged yet'}

INVESTMENT PORTFOLIO:
- Total Invested: ₹${totalInvested.toLocaleString('en-IN')}
- Current Value: ₹${totalCurrent.toLocaleString('en-IN')}
- Total P&L: ₹${totalPL.toLocaleString('en-IN')} (${totalInvested > 0 ? formatPercent((totalPL / totalInvested) * 100) : '0%'})

Portfolio Breakdown:
${portfolioBreakdown || '  - No investments added yet'}

Asset Allocation:
${allocationStr || '  - No investments added yet'}
${newsContext}

Always respond as a knowledgeable Indian financial advisor familiar with NSE, BSE, SEBI regulations, mutual funds, SIP, PPF, ELSS, and Indian tax laws.`;
}
