'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { getProfile, getSalaryEntries, getInvestments, getGoals } from '@/lib/storage';
import { buildInsights } from '@/lib/insights';
import { formatCurrency, formatPercent, monthLabel } from '@/lib/formatters';
import { healthBreakdown } from '@/lib/health';
import { computeTakeHome } from '@/lib/income';
import type { UserProfile, SalaryEntry, Investment, Goal } from '@/types';
import { Wallet, TrendingUp, PieChart, Bot, ArrowRight, AlertTriangle, CheckCircle, Newspaper, Compass, Lightbulb, ChevronDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import InvoiceIncomeCard from '@/components/InvoiceIncomeCard';

// Animated count-up hook
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    startRef.current = null;
    const step = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setValue(Math.round(target * ease));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
      else setValue(target);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);
  return value;
}

export default function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [salaryEntries, setSalaryEntries] = useState<SalaryEntry[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [insightsShowAll, setInsightsShowAll] = useState(false);
  // How many recent months the trend chart shows (0 = all)
  const [chartWindow, setChartWindow] = useState<number>(6);

  useEffect(() => {
    setProfile(getProfile());
    setSalaryEntries(getSalaryEntries());
    setInvestments(getInvestments());
    setGoals(getGoals());
    setLoaded(true);
  }, []);

  const latest = salaryEntries[0];
  const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
  const totalCurrent = investments.reduce((s, i) => s + i.currentValue, 0);
  const totalPL = totalCurrent - totalInvested;
  const plPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
  // Income = in-hand take-home (gross - deductions + other income), not gross.
  const takeHome = latest ? computeTakeHome(latest) : 0;
  const savingsRate = takeHome > 0 ? Math.round((latest!.savings / takeHome) * 100) : 0;

  const typeCount = [...new Set(investments.map((i) => i.type))].length;
  const emergencyTarget = (profile?.monthlyExpenses || 0) * (profile?.emergencyFundMonths || 6);
  const hasEmergencyFund = totalCurrent >= emergencyTarget;
  const health = healthBreakdown({
    savingsRate,
    hasEmergencyFund,
    diversificationScore: Math.min(typeCount, 5),
    debtRatio: 0,
  });
  const healthScore = health.score;
  const { label: healthLabel, color: healthColor } = { label: health.label, color: health.color };

  // Count-up values
  const animSalary = useCountUp(takeHome);
  const animSavings = useCountUp(latest ? latest.savings : 0);
  const animPortfolio = useCountUp(totalCurrent);
  const animHealth = useCountUp(healthScore, 1200);

  const orderedEntries = [...salaryEntries].reverse();
  const windowedEntries = chartWindow > 0 ? orderedEntries.slice(-chartWindow) : orderedEntries;
  const rawChartData = windowedEntries.map((e) => ({
    month: monthLabel(e.month),
    salary: e.grossSalary,
    savings: e.savings,
    expenses: e.expenses,
  }));
  // Pad with a zero-value preceding month when only 1 entry so the area chart can render lines
  const chartData = rawChartData.length === 1
    ? [
        { month: '', salary: 0, savings: 0, expenses: 0 },
        ...rawChartData,
      ]
    : rawChartData;

  const quickActions = [
    { href: '/salary', icon: Wallet, label: 'Add Salary', color: 'var(--blue)', bg: 'var(--blue-glow)' },
    { href: '/portfolio', icon: PieChart, label: 'Add Investment', color: 'var(--green)', bg: 'var(--green-glow)' },
    { href: '/advisor', icon: Bot, label: 'Ask AI', color: 'var(--purple)', bg: 'var(--purple-glow)' },
    { href: '/compound', icon: TrendingUp, label: 'Calculate Growth', color: 'var(--gold)', bg: 'var(--gold-glow)' },
    { href: '/guidance', icon: Compass, label: 'Get Guidance', color: 'var(--cyan)', bg: 'var(--cyan-glow)' },
    { href: '/news', icon: Newspaper, label: 'Market News', color: 'var(--blue)', bg: 'var(--blue-glow)' },
  ];

  // Warnings first, then info, then success (most actionable at the top)
  const INSIGHT_ORDER = { warning: 0, info: 1, success: 2 };
  const insights = buildInsights({ profile, entries: salaryEntries, investments, goals })
    .slice()
    .sort((a, b) => INSIGHT_ORDER[a.level] - INSIGHT_ORDER[b.level]);
  const warningCount = insights.filter((i) => i.level === 'warning').length;
  const COLLAPSED_COUNT = 3;
  const visibleInsights = insightsShowAll ? insights : insights.slice(0, COLLAPSED_COUNT);

  return (
    <div className="animate-fade">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1>Financial Overview</h1>
          <div className="section-sub">Hello {profile?.name} 👋 — here&apos;s your wealth snapshot</div>
        </div>
      </div>

      {/* Insights & Alerts — collapsible so it doesn't push the dashboard down */}
      {insights.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={() => setInsightsOpen((o) => !o)}
            aria-expanded={insightsOpen}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
              background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
          >
            <div className="section-title" style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center' }}>
              <Lightbulb size={16} style={{ marginRight: '0.5rem', color: 'var(--gold)' }} />
              Insights &amp; Alerts
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {/* Warning peek so critical items aren't hidden when collapsed */}
              {!insightsOpen && warningCount > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 600, color: 'var(--gold)' }}>
                  <AlertTriangle size={13} /> {warningCount} alert{warningCount !== 1 ? 's' : ''}
                </span>
              )}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{insights.length} to review</span>
              <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: insightsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
          </button>

          {insightsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              {visibleInsights.map((a) => (
                <div key={a.id} className={`alert alert-${a.level === 'warning' ? 'warning' : a.level === 'success' ? 'success' : 'info'}`}
                  style={{ alignItems: 'flex-start' }}>
                  {a.level === 'warning' ? <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} /> : a.level === 'success' ? <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} /> : <ArrowRight size={16} style={{ flexShrink: 0, marginTop: 2 }} />}
                  <span><strong>{a.title}</strong> — {a.detail}</span>
                </div>
              ))}
              {insights.length > COLLAPSED_COUNT && (
                <button className="btn btn-ghost btn-sm" onClick={() => setInsightsShowAll((s) => !s)}
                  style={{ alignSelf: 'flex-start', fontSize: '0.78rem' }}>
                  {insightsShowAll ? 'Show less' : `Show ${insights.length - COLLAPSED_COUNT} more`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Invoice income (from InvoiceKit bridge; renders only when connected) */}
      <InvoiceIncomeCard />

      {/* Stat Cards */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className={`stat-card card-glow-blue stat-card-blue ${loaded ? 'animate-count' : ''}`}>
          <div className="stat-icon" style={{ background: 'var(--blue-glow)', color: 'var(--blue)' }}>
            <Wallet size={18} />
          </div>
          <div className="stat-label">Monthly Income</div>
          <div className="stat-value">{latest ? formatCurrency(animSalary) : '—'}</div>
          <div className="stat-sub">In-hand · Gross: {latest ? formatCurrency(latest.grossSalary) : '—'}</div>
        </div>
        <div className={`stat-card stat-card-green ${loaded ? 'animate-count' : ''}`} style={{ animationDelay: '0.08s' }}>
          <div className="stat-icon" style={{ background: 'var(--green-glow)', color: 'var(--green)' }}>
            <TrendingUp size={18} />
          </div>
          <div className="stat-label">Monthly Savings</div>
          <div className="stat-value">{latest ? formatCurrency(animSavings) : '—'}</div>
          <div className="stat-sub" style={{ color: savingsRate >= 20 ? 'var(--green)' : 'var(--gold)' }}>
            {savingsRate > 0 ? `${savingsRate}% savings rate` : 'Add salary to track'}
          </div>
        </div>
        <div className={`stat-card stat-card-gold ${loaded ? 'animate-count' : ''}`} style={{ animationDelay: '0.16s' }}>
          <div className="stat-icon" style={{ background: 'var(--gold-glow)', color: 'var(--gold)' }}>
            <PieChart size={18} />
          </div>
          <div className="stat-label">Portfolio Value</div>
          <div className="stat-value">{formatCurrency(animPortfolio)}</div>
          <div className="stat-sub" style={{ color: totalPL >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {totalInvested > 0 ? `${formatPercent(plPct)} overall return` : investments.length === 0 ? 'No investments yet' : '—'}
          </div>
        </div>
        <div className={`stat-card stat-card-purple ${loaded ? 'animate-count' : ''}`} style={{ animationDelay: '0.24s' }}>
          <div className="stat-icon" style={{ background: `${healthColor}20`, color: healthColor }}>
            <CheckCircle size={18} />
          </div>
          <div className="stat-label">Health Score</div>
          <div className="stat-value" style={{ color: healthColor }}>{animHealth}<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/100</span></div>
          <div className="stat-sub" style={{ color: healthColor }}>{healthLabel}</div>
        </div>
      </div>

      {/* Health Score breakdown — the "why" + how to improve */}
      {latest && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div className="section-title" style={{ fontSize: '1rem', margin: 0 }}>
              <CheckCircle size={16} style={{ display: 'inline', marginRight: '0.5rem', color: healthColor }} />
              Health Score Breakdown
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: healthColor }}>{healthScore}/100 · {healthLabel}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {health.factors.map((f) => {
              const pct = f.max > 0 ? Math.round((f.score / f.max) * 100) : 0;
              const barColor = pct >= 80 ? 'var(--green)' : pct >= 40 ? 'var(--gold)' : 'var(--red)';
              return (
                <div key={f.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{f.label}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{f.score}/{f.max}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--track-bg)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3 }} />
                  </div>
                  {f.tip && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>{f.tip}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chart + Quick Actions */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="section-header" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div className="section-title" style={{ fontSize: '1rem' }}>Income vs Savings</div>
            <select
              className="input"
              value={chartWindow}
              onChange={(e) => setChartWindow(Number(e.target.value))}
              style={{ width: 'auto', fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
              aria-label="Chart month range"
            >
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={0}>All months</option>
            </select>
          </div>
          {chartData.length > 0 ? (
            <div className="chart-container" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salaryGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--blue)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--blue)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--green)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,142,255,0.08)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={45} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px rgba(59,110,240,0.1)' }}
                    labelStyle={{ color: 'var(--blue)', fontWeight: 600, marginBottom: 4 }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    formatter={(v) => [typeof v === 'number' ? `₹${(v as number).toLocaleString('en-IN')}` : v, '']}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '0.75rem', paddingTop: '0.75rem' }}
                    formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>}
                  />
                  <Area type="monotone" dataKey="salary" stroke="var(--blue)" fill="url(#salaryGrad)" strokeWidth={2} name="Salary" dot={{ r: 4, fill: 'var(--blue)' }} activeDot={{ r: 6 }} />
                  <Area type="monotone" dataKey="savings" stroke="var(--green)" fill="url(#savingsGrad)" strokeWidth={2} name="Savings" dot={{ r: 4, fill: 'var(--green)' }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">No salary data yet</div>
              <div className="empty-state-sub">Add your first salary entry to see the chart</div>
              <Link href="/salary" className="btn btn-primary btn-sm mt-2">Add Income</Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="section-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>Quick Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {quickActions.map(({ href, icon: Icon, label, color, bg }) => (
              <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: bg,
                  border: `1px solid ${color}30`,
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  cursor: 'pointer', transition: 'all var(--transition)',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${color}20`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                >
                  <Icon size={20} color={color} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Portfolio Summary */}
      {investments.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <div className="section-title" style={{ fontSize: '1rem' }}>Portfolio Summary</div>
            <Link href="/portfolio" className="btn btn-ghost btn-sm">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Investment</th>
                  <th>Type</th>
                  <th>Invested</th>
                  <th>Current</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {investments.slice(0, 5).map((inv) => {
                  const pl = inv.currentValue - inv.investedAmount;
                  const plp = inv.investedAmount > 0 ? (pl / inv.investedAmount) * 100 : 0;
                  return (
                    <tr key={inv.id}>
                      <td><span style={{ fontWeight: 500 }}>{inv.name}</span></td>
                      <td><span className="badge badge-blue">{inv.type.replace('_', ' ')}</span></td>
                      <td>{formatCurrency(inv.investedAmount)}</td>
                      <td>{formatCurrency(inv.currentValue)}</td>
                      <td style={{ color: pl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                        {pl >= 0 ? '+' : ''}{formatCurrency(pl)} ({formatPercent(plp)})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No data prompt */}
      {salaryEntries.length === 0 && investments.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚀</div>
          <h2 style={{ marginBottom: '0.5rem' }}>Let&apos;s get started!</h2>
          <p style={{ marginBottom: '1.5rem' }}>Add your salary and investments to see your complete financial picture.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/salary" className="btn btn-primary">💰 Add First Income</Link>
            <Link href="/portfolio" className="btn btn-ghost">📊 Add Investment</Link>
            <Link href="/advisor" className="btn btn-ghost">🤖 Ask AI</Link>
          </div>
        </div>
      )}
    </div>
  );
}
