'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getProfile, getSalaryEntries, getInvestments } from '@/lib/storage';
import { computeIncomeBreakdown } from '@/lib/income';
import { calcCompound } from '@/lib/compound';
import { assessTarget, suggestAllocation, defaultRateFor, type RiskAppetite } from '@/lib/planning';
import { formatCurrency } from '@/lib/formatters';
import type { SalaryEntry, Investment, UserProfile } from '@/types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Target, TrendingUp, Wallet, PiggyBank, Sparkles, AlertTriangle, CheckCircle2, Info, Lightbulb } from 'lucide-react';

const CR = 10000000;

export default function PlanPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<SalaryEntry[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Target planner inputs
  const [targetAmount, setTargetAmount] = useState(CR);
  const [targetYears, setTargetYears] = useState(10);
  const [rate, setRate] = useState(11);

  useEffect(() => {
    const p = getProfile();
    setProfile(p);
    setEntries(getSalaryEntries());
    setInvestments(getInvestments());
    setRate(defaultRateFor(p?.riskAppetite));
    setLoaded(true);
  }, []);

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
