import type { UserProfile, SalaryEntry, Investment, Goal } from '@/types';
import { computeTakeHome } from './income';

// Rule-based proactive insights computed from the user's existing data — no AI,
// no network. Each insight is a short, actionable nudge. Pure function.

export type InsightLevel = 'warning' | 'info' | 'success';

export interface Insight {
  id: string;
  level: InsightLevel;
  title: string;
  detail: string;
}

export function buildInsights(opts: {
  profile: UserProfile | null;
  entries: SalaryEntry[];
  investments: Investment[];
  goals: Goal[];
}): Insight[] {
  const { profile, entries, investments, goals } = opts;
  const out: Insight[] = [];
  const latest = entries[0];
  const prev = entries[1];

  if (!latest || !profile) return out;

  const takeHome = computeTakeHome(latest);
  const savingsRate = takeHome > 0 ? Math.round((latest.savings / takeHome) * 100) : 0;

  // 1. Savings rate below benchmark
  if (savingsRate < 20) {
    out.push({
      id: 'low-savings',
      level: 'warning',
      title: `Savings rate is ${savingsRate}%`,
      detail: `Below the 20% benchmark. Saving ₹${Math.max(0, Math.round(takeHome * 0.2) - latest.savings).toLocaleString('en-IN')} more this month would get you there.`,
    });
  } else {
    out.push({
      id: 'good-savings',
      level: 'success',
      title: `Strong ${savingsRate}% savings rate`,
      detail: 'You are saving above the 20% benchmark — keep it up.',
    });
  }

  // 2. Savings dropped vs last month
  if (prev && prev.savings > 0 && latest.savings < prev.savings * 0.8) {
    out.push({
      id: 'savings-drop',
      level: 'warning',
      title: 'Savings dropped sharply',
      detail: `Down from ₹${prev.savings.toLocaleString('en-IN')} last month to ₹${latest.savings.toLocaleString('en-IN')}. Review this month's expenses.`,
    });
  }

  // 3. Emergency fund shortfall
  const emergencyTarget = (profile.monthlyExpenses || 0) * (profile.emergencyFundMonths || 6);
  const emergencyCurrent = profile.emergencyFundCurrent || 0;
  if (emergencyTarget > 0 && emergencyCurrent < emergencyTarget) {
    const shortfall = emergencyTarget - emergencyCurrent;
    out.push({
      id: 'emergency-short',
      level: emergencyCurrent < emergencyTarget * 0.5 ? 'warning' : 'info',
      title: 'Emergency fund is short',
      detail: `You have ₹${emergencyCurrent.toLocaleString('en-IN')} of a ₹${emergencyTarget.toLocaleString('en-IN')} target — ₹${shortfall.toLocaleString('en-IN')} to go. Prioritise this before new investing.`,
    });
  }

  // 4. 80C headroom (ELSS/PPF-type holdings vs 1.5L cap)
  const eightyC = investments
    .filter((i) => i.type === 'ppf' || i.type === 'mutual_fund')
    .reduce((s, i) => s + i.investedAmount, 0);
  const eightyCRemaining = Math.max(150000 - eightyC, 0);
  if (eightyCRemaining > 0) {
    out.push({
      id: '80c-headroom',
      level: 'info',
      title: `₹${eightyCRemaining.toLocaleString('en-IN')} of 80C unused`,
      detail: 'Investing in ELSS, PPF, or EPF up to ₹1.5L/year can cut your taxable income (old regime).',
    });
  }

  // 5. Goals off track (required run-rate exceeds current savings)
  const activeGoals = goals.filter((g) => g.currentAmount < g.targetAmount);
  if (activeGoals.length > 0) {
    out.push({
      id: 'goals-active',
      level: 'info',
      title: `${activeGoals.length} active goal${activeGoals.length > 1 ? 's' : ''}`,
      detail: 'Check the Goals Tracker for the monthly SIP each needs, and make sure the total fits your surplus.',
    });
  }

  return out;
}
