import type { CompoundParams, CompoundResult } from '@/types';

export function calcCompound(params: CompoundParams): CompoundResult[] {
  const { principal, monthlyContribution, annualRate, years, compoundingFrequency } = params;
  const results: CompoundResult[] = [];
  const r = annualRate / 100 / compoundingFrequency;
  let value = principal;
  let invested = principal;

  for (let year = 1; year <= years; year++) {
    for (let period = 0; period < compoundingFrequency; period++) {
      value = value * (1 + r) + monthlyContribution * (12 / compoundingFrequency);
    }
    invested = principal + monthlyContribution * 12 * year;
    results.push({ year, value: Math.round(value), invested: Math.round(invested), interest: Math.round(value - invested) });
  }
  return results;
}

export function calcGoalSIP(targetAmount: number, annualRate: number, years: number): number {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return targetAmount / n;
  const sip = (targetAmount * r) / (Math.pow(1 + r, n) - 1);
  return Math.round(sip);
}

export function ruleOf72(rate: number): number {
  return Math.round(72 / rate * 10) / 10;
}

export function calcSIPFinal(monthlyAmount: number, annualRate: number, years: number): number {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return monthlyAmount * n;
  return Math.round(monthlyAmount * ((Math.pow(1 + r, n) - 1) / r) * (1 + r));
}

export function calcLumpsumFinal(principal: number, annualRate: number, years: number): number {
  return Math.round(principal * Math.pow(1 + annualRate / 100, years));
}
