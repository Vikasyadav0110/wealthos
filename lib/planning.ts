import type { UserProfile } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Planning logic for the Financial Plan page. Pure functions only — no side
// effects, unit-testable. These operate on the user's OWN numbers (surplus,
// target, horizon). They are NOT financial advice: returns are assumptions, and
// specific security recommendations are routed to the AI advisor, not hardcoded.
// ─────────────────────────────────────────────────────────────────────────────

export type RiskAppetite = UserProfile['riskAppetite']; // 'conservative' | 'moderate' | 'aggressive'

export interface AssetSlice {
  id: string;
  label: string;
  pct: number;          // 0–100
  monthlyAmount: number;
  color: string;
}

// Standard model portfolios by risk profile (percentages sum to 100).
// Colors mirror DEFAULT_INVESTMENTS in lib/storage.ts for visual consistency.
const ASSET_ALLOCATIONS: Record<RiskAppetite, AssetSlice[]> = {
  conservative: [
    { id: 'debt', label: 'Debt / FD', pct: 40, monthlyAmount: 0, color: '#fbbf24' },
    { id: 'gold', label: 'Gold / SGB', pct: 20, monthlyAmount: 0, color: '#f59e0b' },
    { id: 'mutual_fund', label: 'Mutual Funds', pct: 25, monthlyAmount: 0, color: '#10b981' },
    { id: 'stock', label: 'Stocks / Equity', pct: 15, monthlyAmount: 0, color: '#3b82f6' },
  ],
  moderate: [
    { id: 'mutual_fund', label: 'Mutual Funds', pct: 40, monthlyAmount: 0, color: '#10b981' },
    { id: 'stock', label: 'Stocks / Equity', pct: 30, monthlyAmount: 0, color: '#3b82f6' },
    { id: 'gold', label: 'Gold / SGB', pct: 15, monthlyAmount: 0, color: '#f59e0b' },
    { id: 'debt', label: 'Debt / FD', pct: 15, monthlyAmount: 0, color: '#fbbf24' },
  ],
  aggressive: [
    { id: 'stock', label: 'Stocks / Equity', pct: 50, monthlyAmount: 0, color: '#3b82f6' },
    { id: 'mutual_fund', label: 'Mutual Funds', pct: 30, monthlyAmount: 0, color: '#10b981' },
    { id: 'gold', label: 'Gold / SGB', pct: 10, monthlyAmount: 0, color: '#f59e0b' },
    { id: 'debt', label: 'Debt / FD', pct: 10, monthlyAmount: 0, color: '#fbbf24' },
  ],
};

// Blended expected annual return assumption per profile. Used as the DEFAULT
// rate on the planner; the user can override it. Deliberately conservative —
// these are assumptions, not promises.
export const EXPECTED_RETURN: Record<RiskAppetite, number> = {
  conservative: 8,
  moderate: 11,
  aggressive: 13,
};

export function defaultRateFor(risk: RiskAppetite | undefined): number {
  return EXPECTED_RETURN[risk ?? 'moderate'];
}

// Split a monthly investable surplus across the model portfolio for a risk
// profile. Amounts sum to `surplus` (last slice absorbs rounding).
export function suggestAllocation(surplus: number, risk: RiskAppetite | undefined): AssetSlice[] {
  const model = ASSET_ALLOCATIONS[risk ?? 'moderate'];
  const amount = Math.max(surplus, 0);
  let allocated = 0;
  return model.map((slice, idx) => {
    const isLast = idx === model.length - 1;
    const monthlyAmount = isLast
      ? Math.round(amount - allocated)          // absorb rounding drift
      : Math.round((amount * slice.pct) / 100);
    allocated += monthlyAmount;
    return { ...slice, monthlyAmount };
  });
}

// The risk-based target weights (the single source of truth, replacing the
// portfolio page's old hardcoded weights).
export function targetWeights(risk: RiskAppetite | undefined): AssetSlice[] {
  return ASSET_ALLOCATIONS[risk ?? 'moderate'];
}

export interface RebalanceRow {
  id: string;
  label: string;
  color: string;
  currentValue: number;
  currentPct: number;
  targetPct: number;
  targetValue: number;
  delta: number;   // +ve = add this much, -ve = trim this much
}

// Compare actual holdings (by asset id, current value) against the risk-based
// target, and return the rupee move needed per asset to rebalance.
export function rebalancePlan(
  currentByType: Record<string, number>,
  risk: RiskAppetite | undefined
): RebalanceRow[] {
  const model = targetWeights(risk);
  const total = Object.values(currentByType).reduce((s, v) => s + v, 0);
  if (total <= 0) return [];
  return model.map((m) => {
    const currentValue = currentByType[m.id] || 0;
    const currentPct = Math.round((currentValue / total) * 100);
    const targetValue = Math.round((total * m.pct) / 100);
    return {
      id: m.id,
      label: m.label,
      color: m.color,
      currentValue,
      currentPct,
      targetPct: m.pct,
      targetValue,
      delta: targetValue - currentValue,
    };
  });
}

export interface TargetAssessment {
  requiredSIP: number;      // monthly SIP needed to hit target in `years`, given current corpus
  achievable: boolean;      // is requiredSIP <= monthlySurplus?
  shortfall: number;        // requiredSIP - monthlySurplus (0 if achievable)
  achievableYears: number | null; // if not achievable, years to reach target at current surplus (null if never)
  projectedCorpus: number;  // corpus after `years` if investing exactly monthlySurplus
}

// Monthly SIP needed to reach `targetAmount` in `years`, accounting for the
// future value of an existing corpus (current-savings-aware annuity formula —
// the same math as app/goals/page.tsx calcRequiredSIP, generalized here).
export function requiredSIP(targetAmount: number, currentCorpus: number, years: number, rate: number): number {
  const months = Math.max(Math.round(years * 12), 1);
  const i = rate / 12 / 100;
  const fvCurrent = currentCorpus * Math.pow(1 + i, months);
  const remaining = targetAmount - fvCurrent;
  if (remaining <= 0) return 0; // already on track from existing corpus alone
  if (i === 0) return Math.round(remaining / months);
  return Math.round((remaining * i) / (Math.pow(1 + i, months) - 1));
}

// Future value of investing `monthly` for `years` on top of `currentCorpus`.
export function projectCorpus(monthly: number, currentCorpus: number, years: number, rate: number): number {
  const months = Math.max(Math.round(years * 12), 1);
  const i = rate / 12 / 100;
  const fvCurrent = currentCorpus * Math.pow(1 + i, months);
  const fvSip = i === 0 ? monthly * months : monthly * ((Math.pow(1 + i, months) - 1) / i) * (1 + i);
  return Math.round(fvCurrent + fvSip);
}

// The honest feasibility engine. If the required SIP exceeds what the user can
// actually save each month, report it plainly and solve for how many years it
// WOULD take at their current surplus — never imply the impossible.
export function assessTarget(opts: {
  targetAmount: number;
  currentCorpus: number;
  years: number;
  monthlySurplus: number;
  rate: number;
}): TargetAssessment {
  const { targetAmount, currentCorpus, years, monthlySurplus, rate } = opts;
  const req = requiredSIP(targetAmount, currentCorpus, years, rate);
  const achievable = req <= monthlySurplus;
  const projectedCorpus = projectCorpus(monthlySurplus, currentCorpus, years, rate);

  let achievableYears: number | null = null;
  if (!achievable) {
    // Search for the smallest whole year count where investing the current
    // surplus reaches the target. Cap the search at 60 years.
    for (let y = 1; y <= 60; y++) {
      if (projectCorpus(monthlySurplus, currentCorpus, y, rate) >= targetAmount) {
        achievableYears = y;
        break;
      }
    }
  }

  return {
    requiredSIP: req,
    achievable,
    shortfall: achievable ? 0 : req - monthlySurplus,
    achievableYears,
    projectedCorpus,
  };
}
