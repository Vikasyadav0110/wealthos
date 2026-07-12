'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { getProfile, saveProfile, getSalaryEntries, getInvestments, getBankAccounts, saveBankAccounts } from '@/lib/storage';
import { computeIncomeBreakdown } from '@/lib/income';
import { calcCompound } from '@/lib/compound';
import { assessTarget, suggestAllocation, defaultRateFor, type RiskAppetite } from '@/lib/planning';
import { formatCurrency, generateId } from '@/lib/formatters';
import type { SalaryEntry, Investment, UserProfile, BankAccount } from '@/types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Target, TrendingUp, Wallet, PiggyBank, Sparkles, AlertTriangle, CheckCircle2, Info, Lightbulb, Shield, Plus, Trash2, Building2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

const BANK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
const BANK_PURPOSES = ['Salary Account', 'Monthly Expenses', 'Emergency Fund', 'Investments & Savings', 'General'];

const CR = 10000000;

export default function PlanPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<SalaryEntry[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loaded, setLoaded] = useState(false);

  const { success } = useToast();

  // Target planner inputs
  const [targetAmount, setTargetAmount] = useState(CR);
  const [targetYears, setTargetYears] = useState(10);
  const [rate, setRate] = useState(11);

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const reload = useCallback(() => {
    const p = getProfile();
    setProfile(p);
    setEntries(getSalaryEntries());
    setInvestments(getInvestments());
    setBankAccounts(getBankAccounts());
    setRate(defaultRateFor(p?.riskAppetite));
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const risk: RiskAppetite = profile?.riskAppetite ?? 'moderate';
  const latest = entries[0];
  const breakdown = latest ? computeIncomeBreakdown(latest) : null;

  // Surplus = the app's stored monthly savings (consistent with the rest of the app).
  const monthlySurplus = latest?.savings ?? 0;
  // "Income" = in-hand take-home (gross - deductions + other income), not gross.
  const takeHome = breakdown?.takeHome ?? 0;
  const grossIncome = latest?.grossSalary ?? 0;
  const totalExpenses = latest?.expenses ?? 0;
  const savingsRate = takeHome > 0 ? Math.round((monthlySurplus / takeHome) * 100) : 0;

  // Current invested corpus, from the portfolio.
  const currentCorpus = investments.reduce((s, i) => s + i.currentValue, 0);

  // Emergency fund — reconcile with bank accounts tagged "Emergency Fund" (I5)
  const emergencyTarget = (profile?.monthlyExpenses || 0) * (profile?.emergencyFundMonths || 6);
  const emergencyBankBalance = bankAccounts.filter((a) => a.purpose === 'Emergency Fund').reduce((s, a) => s + a.balance, 0);
  // Count the greater of the manually-entered amount and the tagged bank balances,
  // so linking an Emergency Fund account auto-counts toward the target.
  const emergencyFundCurrent = Math.max(profile?.emergencyFundCurrent || 0, emergencyBankBalance);
  const emergencyPct = emergencyTarget > 0 ? Math.min(Math.round((emergencyFundCurrent / emergencyTarget) * 100), 100) : 0;
  const emergencyColor = emergencyPct >= 100 ? 'var(--green)' : emergencyPct >= 50 ? 'var(--gold)' : 'var(--red)';

  const updateEmergencyFund = (amount: number) => {
    if (!profile) return;
    const updated = { ...profile, emergencyFundCurrent: amount };
    saveProfile(updated);
    setProfile(updated);
    success('Emergency fund updated!');
  };

  // Bank accounts helpers
  const addBankAccount = () => {
    if (bankAccounts.length >= 4) return;
    const newAccount: BankAccount = {
      id: generateId(),
      name: '',
      type: 'savings',
      balance: 0,
      purpose: 'General',
      color: BANK_COLORS[bankAccounts.length] || '#94a3b8',
    };
    const updated = [...bankAccounts, newAccount];
    setBankAccounts(updated);
    saveBankAccounts(updated);
  };

  const updateBankAccount = (id: string, field: keyof BankAccount, value: unknown) => {
    const updated = bankAccounts.map((a) => a.id === id ? { ...a, [field]: value } : a);
    setBankAccounts(updated);
    saveBankAccounts(updated);
  };

  const removeBankAccount = (id: string) => {
    const updated = bankAccounts.filter((a) => a.id !== id);
    setBankAccounts(updated);
    saveBankAccounts(updated);
    success('Account removed');
  };

  const totalBankBalance = bankAccounts.reduce((s, a) => s + a.balance, 0);

  // Smart allocation suggestion based on income
  const suggestedSplit = useMemo(() => {
    if (!latest || bankAccounts.length === 0) return null;
    const th = takeHome;
    const exp = totalExpenses;
    const surplus = monthlySurplus;
    const emergencyNeed = Math.max(emergencyTarget - emergencyFundCurrent, 0);
    const monthlyEmergencySave = emergencyNeed > 0 ? Math.min(Math.round(surplus * 0.3), emergencyNeed) : 0;
    const investable = surplus - monthlyEmergencySave;

    return {
      salary: th,
      expenses: exp,
      emergency: monthlyEmergencySave,
      investments: investable,
    };
  }, [latest, bankAccounts.length, takeHome, totalExpenses, monthlySurplus, emergencyTarget, emergencyFundCurrent]);

  const assessment = useMemo(
    () => assessTarget({ targetAmount, currentCorpus, years: targetYears, monthlySurplus, rate }),
    [targetAmount, currentCorpus, targetYears, monthlySurplus, rate]
  );

  // Projection chart: invest the current surplus each month at `rate`.
  const projection = useMemo(
    () => calcCompound({ principal: currentCorpus, monthlyContribution: monthlySurplus, annualRate: rate, years: targetYears, compoundingFrequency: 12 }),
    [currentCorpus, monthlySurplus, rate, targetYears]
  );

  const allocation = useMemo(() => suggestAllocation(monthlySurplus, risk), [monthlySurplus, risk]);

  const aiPrompt = `Given my ${risk} risk profile, ₹${monthlySurplus.toLocaleString('en-IN')}/month available to invest, and a target of ${formatCurrency(targetAmount)} in ${targetYears} years, suggest specific mutual funds and stocks available in India (NSE/BSE) to consider, with brief reasoning for each. Note this is for my own research.`;

  if (!loaded) {
    return <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" style={{ width: 36, height: 36 }} /></div>;
  }

  if (!latest) {
    return (
      <div className="animate-fade">
        <div className="section-header"><div><h1 style={{ fontSize: '1.5rem' }}>Financial Plan</h1><div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Plan your path to your money goals</div></div></div>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🎯</div>
            <div className="empty-state-title">Add your income first</div>
            <div className="empty-state-sub">The plan is built from your income and expenses. Log a month in the Income Tracker to get started.</div>
            <Link href="/salary" className="btn btn-primary mt-2">Go to Income Tracker</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade">
      {/* Header */}
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem' }}>Financial Plan</h1>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>See your money, set a target, and get a plan to reach it</div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="alert alert-warning" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span style={{ fontSize: '0.8rem' }}>Projections use assumed returns and are not guaranteed. This is educational planning, <strong>not SEBI-registered financial advice</strong>. Verify any decision independently.</span>
      </div>

      {/* 1. Cash Flow Summary */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card stat-card-blue">
          <div className="stat-label"><Wallet size={13} style={{ display: 'inline', marginRight: 4 }} />Monthly Income</div>
          <div className="stat-value">{formatCurrency(takeHome)}</div>
          <div className="stat-sub">In-hand · Gross: {formatCurrency(grossIncome)}</div>
        </div>
        <div className="stat-card stat-card-gold">
          <div className="stat-label">Monthly Expenses</div>
          <div className="stat-value">{formatCurrency(totalExpenses)}</div>
          <div className="stat-sub">{takeHome > 0 ? Math.round((totalExpenses / takeHome) * 100) : 0}% of in-hand</div>
        </div>
        <div className="stat-card stat-card-green">
          <div className="stat-label"><PiggyBank size={13} style={{ display: 'inline', marginRight: 4 }} />Investable Surplus</div>
          <div className="stat-value">{formatCurrency(monthlySurplus)}</div>
          <div className="stat-sub">per month to invest</div>
        </div>
        <div className="stat-card stat-card-purple">
          <div className="stat-label">Savings Rate</div>
          <div className="stat-value" style={{ color: savingsRate >= 20 ? 'var(--green)' : 'var(--gold)' }}>{savingsRate}%</div>
          <div className="stat-sub">{savingsRate >= 20 ? '✅ On track' : 'Aim for 20%+'}</div>
        </div>
      </div>

      {/* Emergency Fund + Bank Accounts */}
      <div className="grid-2" style={{ marginBottom: '1.5rem', alignItems: 'start' }}>
        {/* Emergency Fund Tracker */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <div style={{ width: 36, height: 36, background: `${emergencyColor}20`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={18} style={{ color: emergencyColor }} />
            </div>
            <div>
              <div className="section-title" style={{ fontSize: '1rem', margin: 0 }}>Emergency Fund</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{profile?.emergencyFundMonths || 6} months of expenses</div>
            </div>
          </div>

          {/* Progress */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Progress</span>
              <span style={{ fontWeight: 600, color: emergencyColor }}>{emergencyPct}%</span>
            </div>
            <div style={{ height: 10, background: 'var(--track-bg)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${emergencyPct}%`, background: emergencyColor, borderRadius: 6, transition: 'width 0.4s ease' }} />
            </div>
          </div>

          {/* Amount display */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: emergencyColor }}>{formatCurrency(emergencyFundCurrent)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(emergencyTarget)}</div>
            </div>
          </div>

          {/* Update amount */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              className="input"
              type="number"
              placeholder="Update current amount"
              value={emergencyFundCurrent || ''}
              onChange={(e) => {
                if (!profile) return;
                setProfile({ ...profile, emergencyFundCurrent: Number(e.target.value) });
              }}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary btn-sm" onClick={() => updateEmergencyFund(profile?.emergencyFundCurrent || 0)}>Save</button>
          </div>

          {emergencyPct >= 100 && (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(16,185,129,0.1)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle2 size={14} /> Emergency fund fully covered! ✅
            </div>
          )}
          {emergencyPct < 100 && emergencyTarget > 0 && (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.1)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={14} /> {formatCurrency(emergencyTarget - emergencyFundCurrent)} more needed. Keep this in a high-interest savings account or liquid fund.
            </div>
          )}
        </div>

        {/* Bank Accounts */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: 36, height: 36, background: 'var(--blue-glow)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={18} style={{ color: 'var(--blue)' }} />
              </div>
              <div>
                <div className="section-title" style={{ fontSize: '1rem', margin: 0 }}>Bank Accounts</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Configure up to 4 accounts</div>
              </div>
            </div>
            {bankAccounts.length < 4 && (
              <button className="btn btn-ghost btn-sm" onClick={addBankAccount} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}><Plus size={14} /> Add Account</button>
            )}
          </div>

          {bankAccounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏦</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Add your bank accounts to get smart allocation suggestions</div>
              <button className="btn btn-primary btn-sm" onClick={addBankAccount}><Plus size={14} /> Add First Account</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Table Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 1.1fr 1.3fr auto', gap: '0.5rem', padding: '0 0.5rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <div>Bank Name</div>
                <div>A/C Type</div>
                <div>Balance</div>
                <div>Purpose</div>
                <div></div>
              </div>

              {bankAccounts.map((acc, idx) => (
                <div key={acc.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 1.1fr 1.3fr auto', gap: '0.5rem', alignItems: 'center', padding: '0.4rem 0.5rem', background: 'var(--inner-card)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${acc.color}`, transition: 'border-color var(--transition)' }}>
                  <input
                    className="input"
                    placeholder={`e.g. Bank ${idx + 1}`}
                    value={acc.name}
                    onChange={(e) => updateBankAccount(acc.id, 'name', e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', height: 'auto', margin: 0 }}
                  />
                  <select
                    className="select"
                    value={acc.type}
                    onChange={(e) => updateBankAccount(acc.id, 'type', e.target.value as BankAccount['type'])}
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.5rem', height: 'auto', margin: 0 }}
                  >
                    <option value="salary">Salary</option>
                    <option value="savings">Savings</option>
                    <option value="current">Current</option>
                    <option value="fd">Fixed Dep.</option>
                  </select>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>₹</span>
                    <input
                      className="input"
                      type="number"
                      placeholder="0"
                      value={acc.balance || ''}
                      onChange={(e) => updateBankAccount(acc.id, 'balance', Number(e.target.value))}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem 0.35rem 1.1rem', height: 'auto', margin: 0, width: '100%' }}
                    />
                  </div>
                  <select
                    className="select"
                    value={acc.purpose}
                    onChange={(e) => updateBankAccount(acc.id, 'purpose', e.target.value)}
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.5rem', height: 'auto', margin: 0 }}
                  >
                    {BANK_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeBankAccount(acc.id)} title="Remove" style={{ padding: '0.35rem', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={13} /></button>
                </div>
              ))}

              {/* Total balance */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Total Balance</span>
                <span style={{ fontWeight: 700, color: 'var(--blue)', fontSize: '1.05rem' }}>{formatCurrency(totalBankBalance)}</span>
              </div>

              {/* Smart allocation suggestion */}
              {suggestedSplit && bankAccounts.length >= 2 && (
                <div style={{ padding: '0.75rem', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 'var(--radius-md)', marginTop: '0.25rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--blue)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Lightbulb size={14} /> Suggested Monthly Allocation
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>💼 Salary account (receive income)</span>
                      <span style={{ fontWeight: 500 }}>{formatCurrency(suggestedSplit.salary)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>🛒 Expenses account (bills, groceries)</span>
                      <span style={{ fontWeight: 500 }}>{formatCurrency(suggestedSplit.expenses)}</span>
                    </div>
                    {suggestedSplit.emergency > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>🛡️ Emergency fund (liquid savings)</span>
                        <span style={{ fontWeight: 500, color: 'var(--gold)' }}>{formatCurrency(suggestedSplit.emergency)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>📈 Investments (SIPs, stocks, MFs)</span>
                      <span style={{ fontWeight: 500, color: 'var(--green)' }}>{formatCurrency(suggestedSplit.investments)}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    💡 Transfer monthly expenses to a separate account on salary day. Keep emergency fund in a high-interest savings or liquid mutual fund.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        {/* 2. Set Your Target */}
        <div className="card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column' }}>
          <div className="section-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>
            <Target size={16} style={{ display: 'inline', marginRight: '0.5rem', color: 'var(--blue)' }} />
            Set Your Target
          </div>
          <div className="grid-3" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Target Amount (₹)</label>
              <input className="input" type="number" value={targetAmount} onChange={(e) => setTargetAmount(Math.max(0, Number(e.target.value)))} />
              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                {[[CR, '₹1 Cr'], [CR / 2, '₹50 L'], [CR * 5, '₹5 Cr']].map(([v, l]) => (
                  <button key={l} className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} onClick={() => setTargetAmount(v as number)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">In how many years?</label>
              <input className="input" type="number" min={1} value={targetYears} onChange={(e) => setTargetYears(Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Expected return (%/yr)</label>
              <input className="input" type="number" min={0} value={rate} onChange={(e) => setRate(Math.max(0, Number(e.target.value)))} />
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>Default for {risk} profile</div>
            </div>
          </div>

          {/* Feasibility banner */}
          {assessment.achievable ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.3)', marginBottom: '1rem' }}>
              <CheckCircle2 size={18} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: '0.85rem' }}>
                <strong style={{ color: 'var(--green)' }}>Achievable.</strong> Invest <strong>{formatCurrency(assessment.requiredSIP)}/mo</strong> to reach {formatCurrency(targetAmount)} in {targetYears} years. That fits within your {formatCurrency(monthlySurplus)} monthly surplus.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', marginBottom: '1rem' }}>
              <AlertTriangle size={18} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: '0.85rem' }}>
                <strong style={{ color: 'var(--gold)' }}>Not reachable on your current surplus.</strong> It would need <strong>{formatCurrency(assessment.requiredSIP)}/mo</strong>, but you have {formatCurrency(monthlySurplus)}/mo.{' '}
                {assessment.achievableYears
                  ? <>At {formatCurrency(monthlySurplus)}/mo you would reach {formatCurrency(targetAmount)} in about <strong>{assessment.achievableYears} years</strong>.</>
                  : <>Even over 60 years, {formatCurrency(monthlySurplus)}/mo doesn&apos;t reach this target — raise your surplus or lower the target.</>}
              </div>
            </div>
          )}

          {/* Required SIP + projection */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Required monthly SIP</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--blue)' }}>{formatCurrency(assessment.requiredSIP)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Projected corpus at {formatCurrency(monthlySurplus)}/mo</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)' }}>{formatCurrency(assessment.projectedCorpus)}</div>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projection}>
                <defs>
                  <linearGradient id="planWealth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--green)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--green)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="year" tickFormatter={(v) => `Y${v}`} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => (v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : `₹${(v / 1000).toFixed(0)}K`)} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [formatCurrency(Number(v)), 'Corpus']} labelFormatter={(l) => `Year ${l}`} />
                <Area type="monotone" dataKey="value" stroke="var(--green)" fill="url(#planWealth)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Suggested Allocation */}
        <div className="card">
          <div className="section-title" style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>
            <TrendingUp size={16} style={{ display: 'inline', marginRight: '0.5rem', color: 'var(--green)' }} />
            Suggested Allocation
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            For your <strong style={{ color: 'var(--text-primary)' }}>{risk}</strong> profile · {formatCurrency(monthlySurplus)}/mo
          </div>
          {monthlySurplus > 0 ? (
            <>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocation} dataKey="monthlyAmount" nameKey="label" cx="50%" cy="50%" innerRadius={38} outerRadius={65} paddingAngle={2}>
                      {allocation.map((d) => <Cell key={d.id} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [formatCurrency(Number(v)), 'Monthly']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {allocation.map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{d.label}</span>
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatCurrency(d.monthlyAmount)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({d.pct}%)</span></span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No surplus to allocate yet. Free up some monthly savings first.</div>
          )}
        </div>
      </div>

      {/* 4 & 5: Extra money + AI hand-off */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="section-title" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
            <Lightbulb size={16} style={{ display: 'inline', marginRight: '0.5rem', color: 'var(--gold)' }} />
            Where to find extra money
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
            {savingsRate < 20 && (
              <li>Your savings rate is <strong style={{ color: 'var(--gold)' }}>{savingsRate}%</strong>. Reaching the 20% benchmark would free up about <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(Math.max(0, Math.round(takeHome * 0.2) - monthlySurplus))}/mo</strong> more to invest.</li>
            )}
            {totalExpenses > 0 && (
              <li>Trimming your expenses by 10% frees up <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(Math.round(totalExpenses * 0.1))}/mo</strong> — review your biggest categories in <Link href="/expenses" style={{ color: 'var(--blue-light)' }}>Daily Expenses</Link>.</li>
            )}
            {breakdown && breakdown.otherIncome === 0 && (
              <li>You currently have no income beyond salary. A side source (freelance, rental, dividends) adds directly to your investable surplus.</li>
            )}
            <li>Every extra <strong style={{ color: 'var(--text-primary)' }}>₹5,000/mo</strong> invested at {rate}% becomes about <strong style={{ color: 'var(--green)' }}>{formatCurrency(calcCompound({ principal: 0, monthlyContribution: 5000, annualRate: rate, years: targetYears, compoundingFrequency: 12 }).slice(-1)[0]?.value ?? 0)}</strong> in {targetYears} years.</li>
          </ul>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-title" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
            <Sparkles size={16} style={{ display: 'inline', marginRight: '0.5rem', color: 'var(--purple)' }} />
            Get specific recommendations
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Ask the AI Advisor for specific funds and stocks that fit your profile and surplus. It knows your full financial picture.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link href={`/advisor?ask=${encodeURIComponent(aiPrompt)}`} className="btn btn-primary w-full">
              <Sparkles size={15} /> Recommend funds & stocks for me
            </Link>
            <Link href={`/advisor?ask=${encodeURIComponent(`How can I increase my monthly investable surplus above ${formatCurrency(monthlySurplus)}? Suggest concrete steps based on my income and expenses.`)}`} className="btn btn-ghost w-full">
              How do I free up more money?
            </Link>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: '0.35rem', alignItems: 'flex-start' }}>
            <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} />
            AI suggestions are educational, not financial advice — always verify independently before investing.
          </div>
        </div>
      </div>
    </div>
  );
}
