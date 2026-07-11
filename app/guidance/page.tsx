'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProfile, getInvestments, getSalaryEntries, getGoals } from '@/lib/storage';
import { formatCurrency } from '@/lib/formatters';
import { requiredSIP, defaultRateFor } from '@/lib/planning';
import type { UserProfile, Investment, SalaryEntry, Goal } from '@/types';
import { ShieldCheck, Zap, Target, Info } from 'lucide-react';

interface Suggestion {
  type: string; label: string; icon: string; allocation: number; amount: number;
  reason: string; color: string; priority: 'high' | 'medium' | 'low';
}

function buildSuggestions(profile: UserProfile, savings: number): Suggestion[] {
  const { riskAppetite } = profile;

  const ALLOCATIONS: Record<string, { icon: string; label: string; color: string; alloc: Record<string, number>; reason: string; priority: 'high' | 'medium' | 'low' }[]> = {
    conservative: [
      { icon: '🏦', label: 'Fixed Deposit', color: 'var(--gold)', alloc: { conservative: 40, moderate: 15, aggressive: 5 }, reason: 'Safe, guaranteed returns. Ideal for capital preservation.', priority: 'high' },
      { icon: '🏛️', label: 'PPF / EPF', color: 'var(--purple)', alloc: { conservative: 25, moderate: 15, aggressive: 5 }, reason: 'Tax-free returns, government-backed. Great for retirement.', priority: 'high' },
      { icon: '💼', label: 'Debt Mutual Fund', color: 'var(--blue)', alloc: { conservative: 20, moderate: 15, aggressive: 5 }, reason: 'Slightly better than FD with good liquidity.', priority: 'medium' },
      { icon: '🥇', label: 'Gold / SGB', color: '#fbbf24', alloc: { conservative: 10, moderate: 10, aggressive: 8 }, reason: 'Hedge against inflation and market volatility.', priority: 'medium' },
      { icon: '📈', label: 'Large Cap MF', color: 'var(--green)', alloc: { conservative: 5, moderate: 20, aggressive: 20 }, reason: 'Low-risk equity exposure for inflation-beating returns.', priority: 'low' },
    ],
    moderate: [
      { icon: '📈', label: 'Large Cap MF (SIP)', color: 'var(--green)', alloc: { conservative: 5, moderate: 25, aggressive: 20 }, reason: 'Steady equity exposure. Start a monthly SIP.', priority: 'high' },
      { icon: '📊', label: 'Midcap / Flexicap MF', color: 'var(--blue)', alloc: { conservative: 0, moderate: 15, aggressive: 20 }, reason: 'Higher growth potential over 5+ years.', priority: 'medium' },
      { icon: '🏦', label: 'Fixed Deposit', color: 'var(--gold)', alloc: { conservative: 40, moderate: 15, aggressive: 5 }, reason: 'Stability anchor for your portfolio.', priority: 'medium' },
      { icon: '🥇', label: 'Gold / SGB', color: '#fbbf24', alloc: { conservative: 10, moderate: 10, aggressive: 8 }, reason: 'Portfolio diversifier. SGBs give extra interest too.', priority: 'medium' },
      { icon: '🏛️', label: 'PPF / ELSS', color: 'var(--purple)', alloc: { conservative: 25, moderate: 15, aggressive: 7 }, reason: 'ELSS gives tax benefit under 80C + equity growth.', priority: 'high' },
      { icon: '📉', label: 'Individual Stocks', color: 'var(--red)', alloc: { conservative: 0, moderate: 20, aggressive: 25 }, reason: 'Selective quality stocks for long-term wealth.', priority: 'low' },
    ],
    aggressive: [
      { icon: '🚀', label: 'Small/Midcap MF', color: 'var(--green)', alloc: { conservative: 0, moderate: 10, aggressive: 30 }, reason: 'High growth potential over 7+ years.', priority: 'high' },
      { icon: '📉', label: 'Individual Stocks', color: 'var(--blue)', alloc: { conservative: 0, moderate: 20, aggressive: 25 }, reason: 'Direct equity for maximum return potential.', priority: 'high' },
      { icon: '📊', label: 'Index Funds', color: '#ec4899', alloc: { conservative: 0, moderate: 0, aggressive: 20 }, reason: 'Low-cost passive investing that beats most active funds.', priority: 'medium' },
      { icon: '🥇', label: 'Gold / SGB', color: '#fbbf24', alloc: { conservative: 10, moderate: 10, aggressive: 8 }, reason: 'Small allocation as portfolio insurance.', priority: 'low' },
      { icon: '🏛️', label: 'ELSS (Tax Saver)', color: 'var(--purple)', alloc: { conservative: 25, moderate: 15, aggressive: 7 }, reason: 'Mandatory to save ₹1.5L under 80C.', priority: 'high' },
      { icon: '₿', label: 'Crypto (optional)', color: '#f97316', alloc: { conservative: 0, moderate: 0, aggressive: 10 }, reason: 'High risk, high reward. Keep under 10% only.', priority: 'low' },
    ],
  };

  const base = ALLOCATIONS[riskAppetite] || ALLOCATIONS.moderate;
  return base.map((b) => ({
    type: b.label.toLowerCase().replace(/ /g, '_'),
    label: b.label,
    icon: b.icon,
    allocation: b.alloc[riskAppetite],
    amount: Math.round(savings * b.alloc[riskAppetite] / 100),
    reason: b.reason,
    color: b.color,
    priority: b.priority,
  })).filter((s) => s.allocation > 0);
}

export default function GuidancePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [salary, setSalary] = useState<SalaryEntry | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    setProfile(getProfile());
    setInvestments(getInvestments());
    const entries = getSalaryEntries();
    setSalary(entries[0] || null);
    setGoals(getGoals());
  }, []);

  if (!profile) return null;

  const savings = salary?.savings || 0;
  const suggestions = buildSuggestions(profile, savings);
  const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
  const emergencyTarget = (profile.monthlyExpenses || 0) * (profile.emergencyFundMonths || 6);
  const hasEmergencyFund = totalInvested >= emergencyTarget;

  const tax80C = investments
    .filter((i) => ['ppf', 'mutual_fund'].includes(i.type))
    .reduce((s, i) => s + i.investedAmount, 0);
  const tax80CRemaining = Math.max(150000 - tax80C, 0);

  return (
    <div className="animate-fade">
      <div className="section-header">
        <div>
          <h1>Investment Guide</h1>
          <div className="section-sub">Personalized recommendations based on your savings & risk profile</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="badge badge-purple" style={{ padding: '0.4rem 0.75rem' }}>
            {profile.riskAppetite === 'conservative' ? '🛡️' : profile.riskAppetite === 'moderate' ? '⚖️' : '🚀'} {profile.riskAppetite} profile
          </span>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--green-glow)', color: 'var(--green)' }}><Target size={18} /></div>
          <div className="stat-label">Monthly Savings to Deploy</div>
          <div className="stat-value">{formatCurrency(savings)}</div>
          <div className="stat-sub">{savings > 0 ? 'Ready to invest' : 'Add salary data first'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: hasEmergencyFund ? 'var(--green-glow)' : 'var(--gold-glow)', color: hasEmergencyFund ? 'var(--green)' : 'var(--gold)' }}>
            <ShieldCheck size={18} />
          </div>
          <div className="stat-label">Emergency Fund</div>
          <div className="stat-value" style={{ color: hasEmergencyFund ? 'var(--green)' : 'var(--gold)' }}>
            {hasEmergencyFund ? '✅ Done' : '⚠️ Needed'}
          </div>
          <div className="stat-sub">Target: {formatCurrency(emergencyTarget)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--blue-glow)', color: 'var(--blue)' }}><Zap size={18} /></div>
          <div className="stat-label">80C Limit Remaining</div>
          <div className="stat-value" style={{ color: tax80CRemaining === 0 ? 'var(--green)' : 'var(--gold)' }}>
            {formatCurrency(tax80CRemaining)}
          </div>
          <div className="stat-sub">Max deduction: ₹1.5L/year</div>
        </div>
      </div>

      {/* Alerts */}
      {!hasEmergencyFund && emergencyTarget > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
          <ShieldCheck size={16} />
          <div><strong>Build Emergency Fund First!</strong> Keep {formatCurrency(emergencyTarget)} in a liquid savings/FD before investing in equity. This is Step 1 of any financial plan.</div>
        </div>
      )}
      {tax80CRemaining > 0 && (
        <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
          <Info size={16} />
          <div><strong>Tax Saving Opportunity:</strong> You can still invest {formatCurrency(tax80CRemaining)} in ELSS/PPF to save tax under Section 80C.</div>
        </div>
      )}

      {/* Suggestions */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <div>
            <div className="section-title" style={{ fontSize: '1rem' }}>This Month&apos;s Investment Plan</div>
            <div className="section-sub" style={{ fontSize: '0.75rem' }}>How to allocate {formatCurrency(savings)} across asset classes</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {suggestions.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', transition: 'all var(--transition)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = s.color; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
              <div style={{ fontSize: '1.5rem', width: 40, textAlign: 'center', flexShrink: 0 }}>{s.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.label}</span>
                  <span className={`badge ${s.priority === 'high' ? 'badge-red' : s.priority === 'medium' ? 'badge-gold' : 'badge-gray'}`}>
                    {s.priority === 'high' ? '🔥 Must do' : s.priority === 'medium' ? '⭐ Recommended' : '💡 Optional'}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{s.reason}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{formatCurrency(s.amount)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.allocation}% of savings</div>
              </div>
              <div style={{ width: 4, height: 50, background: s.color, borderRadius: 2, flexShrink: 0, opacity: 0.6 }} />
            </div>
          ))}
          {suggestions.length === 0 && (
            <div className="empty-state"><div className="empty-state-icon">💡</div><div className="empty-state-title">Add salary data to get personalized suggestions</div></div>
          )}
        </div>
      </div>

      {/* Goal-linked guidance */}
      {goals.length > 0 && (() => {
        const rate = defaultRateFor(profile.riskAppetite);
        const rows = goals.filter((g) => g.currentAmount < g.targetAmount).map((g) => {
          const months = Math.max(Math.ceil((new Date(g.targetDate).getTime() - Date.now()) / (30 * 24 * 3600 * 1000)), 1);
          const sip = requiredSIP(g.targetAmount, g.currentAmount, months / 12, rate);
          return { ...g, sip };
        });
        const totalSip = rows.reduce((s, r) => s + r.sip, 0);
        if (rows.length === 0) return null;
        return (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div className="section-title" style={{ fontSize: '1rem', margin: 0 }}>🎯 Fund Your Goals</div>
              <Link href="/goals" style={{ fontSize: '0.8rem', color: 'var(--blue-light)' }}>Manage goals →</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {rows.map((g) => {
                const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
                return (
                  <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{g.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct}% funded)</span></span>
                    <span style={{ fontSize: '0.85rem' }}>Invest <strong style={{ color: 'var(--blue)' }}>{formatCurrency(g.sip)}/mo</strong></span>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>Total needed for all goals</span>
                <span style={{ color: totalSip > savings ? 'var(--red)' : 'var(--green)' }}>{formatCurrency(totalSip)}/mo</span>
              </div>
              {totalSip > savings && savings > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--gold)' }}>⚠️ This exceeds your {formatCurrency(savings)}/mo surplus — extend timelines or increase savings.</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Principles */}
      <div className="card">
        <div className="section-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>📚 Key Financial Principles</div>
        <div className="grid-2">
          {[
            { icon: '1️⃣', title: 'Emergency Fund First', desc: 'Always keep 6 months of expenses in liquid form before any investment.' },
            { icon: '2️⃣', title: 'Invest Before You Spend', desc: 'Transfer savings on salary day. Treat investments like a bill.' },
            { icon: '3️⃣', title: 'Start SIPs Early', desc: 'A ₹5,000 SIP at 22 vs 32 makes a ₹1+ Crore difference at 60.' },
            { icon: '4️⃣', title: 'Diversify Asset Classes', desc: 'Never put all money in one place — equity, debt, gold each serves a role.' },
            { icon: '5️⃣', title: 'Save on Taxes First', desc: 'Maximize 80C (₹1.5L), NPS (₹50K extra), HRA before anything else.' },
            { icon: '6️⃣', title: "Don't Time the Market", desc: 'Consistent SIPs beat trying to buy at the "right" time.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ display: 'flex', gap: '0.75rem', padding: '0.875rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{icon}</span>
              <div><div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.2rem' }}>{title}</div><div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
