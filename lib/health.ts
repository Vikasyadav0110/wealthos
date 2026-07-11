import { calcHealthScore, getHealthLabel } from './formatters';

// Per-factor breakdown of the financial health score, so the UI can show
// "why" and the AI advisor can reason about it. Mirrors the weighting in
// calcHealthScore (formatters.ts) exactly.

export interface HealthFactor {
  key: string;
  label: string;
  score: number;   // points earned
  max: number;     // max points for this factor
  tip: string;     // how to improve (empty when maxed)
}

export interface HealthBreakdown {
  score: number;
  label: string;
  color: string;
  factors: HealthFactor[];
}

export interface HealthInputs {
  savingsRate: number;          // %
  hasEmergencyFund: boolean;
  diversificationScore: number; // distinct asset types, capped at 5 by caller
  debtRatio: number;            // 0..1
}

export function healthBreakdown(inputs: HealthInputs): HealthBreakdown {
  const { savingsRate, hasEmergencyFund, diversificationScore, debtRatio } = inputs;
  const score = calcHealthScore(inputs);
  const { label, color } = getHealthLabel(score);

  const savingsPts = Math.min(Math.round(savingsRate * 1.5), 30);
  const divPts = Math.min(diversificationScore * 4, 30);
  const debtPts = Math.max(Math.round(20 - debtRatio * 20), 0);

  const factors: HealthFactor[] = [
    {
      key: 'savings',
      label: 'Savings Rate',
      score: savingsPts,
      max: 30,
      tip: savingsPts >= 30 ? '' : 'Increase your monthly savings rate toward 20%+ to earn full points.',
    },
    {
      key: 'emergency',
      label: 'Emergency Fund',
      score: hasEmergencyFund ? 20 : 0,
      max: 20,
      tip: hasEmergencyFund ? '' : 'Build an emergency fund covering your target months of expenses.',
    },
    {
      key: 'diversification',
      label: 'Diversification',
      score: divPts,
      max: 30,
      tip: divPts >= 30 ? '' : 'Spread investments across more asset types (equity, MF, gold, debt) to reduce concentration risk.',
    },
    {
      key: 'debt',
      label: 'Debt Load',
      score: debtPts,
      max: 20,
      tip: debtPts >= 20 ? '' : 'Reduce high-interest debt relative to income to improve this factor.',
    },
  ];

  return { score, label, color, factors };
}
