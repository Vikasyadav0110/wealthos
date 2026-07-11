export function formatCurrency(amount: number, currency = '₹'): string {
  if (amount >= 10000000) return `${currency}${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `${currency}${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `${currency}${(amount / 1000).toFixed(1)}K`;
  return `${currency}${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatFullCurrency(amount: number, currency = '₹'): string {
  return `${currency}${Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function monthLabel(month: string): string {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getPLColor(value: number): string {
  if (value > 0) return '#10b981';
  if (value < 0) return '#ef4444';
  return '#94a3b8';
}

export function calcHealthScore(params: {
  savingsRate: number;
  hasEmergencyFund: boolean;
  diversificationScore: number;
  debtRatio: number;
}): number {
  let score = 0;
  score += Math.min(params.savingsRate * 1.5, 30);
  score += params.hasEmergencyFund ? 20 : 0;
  score += Math.min(params.diversificationScore * 4, 30);
  score += Math.max(20 - params.debtRatio * 20, 0);
  return Math.round(Math.min(score, 100));
}

export function getHealthLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Excellent', color: '#10b981' };
  if (score >= 60) return { label: 'Good', color: '#3b82f6' };
  if (score >= 40) return { label: 'Fair', color: '#f59e0b' };
  return { label: 'Needs Work', color: '#ef4444' };
}
