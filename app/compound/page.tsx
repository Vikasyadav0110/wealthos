'use client';
import { useState } from 'react';
import { calcCompound, calcGoalSIP, ruleOf72, calcSIPFinal, calcLumpsumFinal } from '@/lib/compound';
import { formatCurrency } from '@/lib/formatters';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, Target, Zap, Calculator } from 'lucide-react';

export default function CompoundPage() {
  const [tab, setTab] = useState<'compound' | 'sip' | 'goal' | 'r72'>('compound');
  const [params, setParams] = useState({ principal: 100000, monthlyContribution: 10000, annualRate: 12, years: 10, freq: 12 });
  const [goal, setGoal] = useState({ target: 5000000, rate: 12, years: 10 });
  const [sip, setSip] = useState({ monthly: 10000, rate: 12, years: 10 });
  const [lump, setLump] = useState({ principal: 500000, rate: 12, years: 10 });

  const compoundData = calcCompound({ principal: params.principal, monthlyContribution: params.monthlyContribution, annualRate: params.annualRate, years: params.years, compoundingFrequency: params.freq });
  const finalValue = compoundData[compoundData.length - 1];
  const sipMonthlyNeeded = calcGoalSIP(goal.target, goal.rate, goal.years);
  const sipFinal = calcSIPFinal(sip.monthly, sip.rate, sip.years);
  const lumpsumFinal = calcLumpsumFinal(lump.principal, lump.rate, lump.years);

  const upd = (key: string, val: number) => setParams((p) => ({ ...p, [key]: val }));

  return (
    <div className="animate-fade">
      <div className="section-header">
        <div>
          <h1>Growth Calculator</h1>
          <div className="section-sub">Simulate your wealth growth through the power of compounding</div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {(['compound', 'sip', 'goal', 'r72'] as const).map((id) => {
          const LABELS: Record<string, string> = { compound: '📈 Compound Growth', sip: '📆 SIP vs Lumpsum', goal: '🎯 Goal Planner', r72: '⚡ Rule of 72' };
          return (
            <button key={id} className={`tab-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{LABELS[id]}</button>
          );
        })}
      </div>

      {/* Compound Growth */}
      {tab === 'compound' && (
        <div className="grid-2">
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem' }}>Parameters</h3>
            {[
              { label: 'Initial Investment (₹)', key: 'principal', val: params.principal, placeholder: '100000' },
              { label: 'Monthly SIP (₹)', key: 'monthlyContribution', val: params.monthlyContribution, placeholder: '10000' },
              { label: 'Annual Return Rate (%)', key: 'annualRate', val: params.annualRate, placeholder: '12' },
              { label: 'Duration (Years)', key: 'years', val: params.years, placeholder: '10' },
            ].map(({ label, key, val, placeholder }) => (
              <div className="form-group" style={{ marginBottom: '1rem' }} key={key}>
                <label className="form-label">{label}</label>
                <input className="input" type="number" placeholder={placeholder} value={val || ''} onChange={(e) => upd(key, Number(e.target.value))} />
              </div>
            ))}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Compounding Frequency</label>
              <select className="select" value={params.freq} onChange={(e) => upd('freq', Number(e.target.value))}>
                <option value={12}>Monthly</option>
                <option value={4}>Quarterly</option>
                <option value={2}>Half-Yearly</option>
                <option value={1}>Yearly</option>
              </select>
            </div>

            {finalValue && (
              <div style={{ marginTop: '1rem', padding: '1.25rem', background: 'var(--green-glow)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Final Corpus</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--green)' }}>{formatCurrency(finalValue.value)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>Total Invested</span><span>{formatCurrency(finalValue.invested)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Interest Earned</span>
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>{formatCurrency(finalValue.interest)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Wealth Multiplier</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{(finalValue.value / finalValue.invested).toFixed(2)}x</span>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Growth Curve</h3>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={compoundData}>
                  <defs>
                    <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--green)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--blue)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--blue)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="year" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v) => `Y${v}`} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v, name) => [typeof v === 'number' ? formatCurrency(v) : v, name === 'value' ? 'Total Wealth' : name === 'invested' ? 'Amount Invested' : 'Interest']} />
                  <Area type="monotone" dataKey="value" stroke="var(--green)" fill="url(#wealthGrad)" strokeWidth={2.5} name="value" />
                  <Area type="monotone" dataKey="invested" stroke="var(--blue)" fill="url(#invGrad)" strokeWidth={2} strokeDasharray="5 3" name="invested" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: 12, height: 3, background: 'var(--green)', borderRadius: 2, display: 'inline-block' }} /> Total Wealth</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: 12, height: 3, background: 'var(--blue)', borderRadius: 2, display: 'inline-block' }} /> Amount Invested</span>
            </div>
          </div>
        </div>
      )}

      {/* SIP vs Lumpsum */}
      {tab === 'sip' && (
        <div className="grid-2">
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem' }}>SIP Calculator</h3>
            <div className="form-group mb-1"><label className="form-label">Monthly SIP Amount (₹)</label>
              <input className="input" type="number" value={sip.monthly || ''} onChange={(e) => setSip(p => ({ ...p, monthly: Number(e.target.value) }))} /></div>
            <div className="form-group mb-1"><label className="form-label">Expected Annual Return (%)</label>
              <input className="input" type="number" value={sip.rate || ''} onChange={(e) => setSip(p => ({ ...p, rate: Number(e.target.value) }))} /></div>
            <div className="form-group mb-2"><label className="form-label">Duration (Years)</label>
              <input className="input" type="number" value={sip.years || ''} onChange={(e) => setSip(p => ({ ...p, years: Number(e.target.value) }))} /></div>
            <div className="stat-card stat-card-blue" style={{ marginTop: '1rem' }}>
              <div className="stat-label">SIP Final Value</div>
              <div className="stat-value" style={{ color: 'var(--blue)' }}>{formatCurrency(sipFinal)}</div>
              <div className="stat-sub">Invested: {formatCurrency(sip.monthly * 12 * sip.years)} • Gain: {formatCurrency(sipFinal - sip.monthly * 12 * sip.years)}</div>
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem' }}>Lumpsum Calculator</h3>
            <div className="form-group mb-1"><label className="form-label">One-time Investment (₹)</label>
              <input className="input" type="number" value={lump.principal || ''} onChange={(e) => setLump(p => ({ ...p, principal: Number(e.target.value) }))} /></div>
            <div className="form-group mb-1"><label className="form-label">Expected Annual Return (%)</label>
              <input className="input" type="number" value={lump.rate || ''} onChange={(e) => setLump(p => ({ ...p, rate: Number(e.target.value) }))} /></div>
            <div className="form-group mb-2"><label className="form-label">Duration (Years)</label>
              <input className="input" type="number" value={lump.years || ''} onChange={(e) => setLump(p => ({ ...p, years: Number(e.target.value) }))} /></div>
            <div className="stat-card stat-card-gold" style={{ marginTop: '1rem' }}>
              <div className="stat-label">Lumpsum Final Value</div>
              <div className="stat-value" style={{ color: 'var(--gold)' }}>{formatCurrency(lumpsumFinal)}</div>
              <div className="stat-sub">Invested: {formatCurrency(lump.principal)} • Gain: {formatCurrency(lumpsumFinal - lump.principal)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Goal Planner */}
      {tab === 'goal' && (
        <div className="grid-2">
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem' }}>🎯 Goal Reverse Calculator</h3>
            <p style={{ marginBottom: '1.25rem', fontSize: '0.875rem' }}>Enter your target corpus and find out how much you need to invest monthly via SIP.</p>
            <div className="form-group mb-1"><label className="form-label">Target Amount (₹)</label>
              <input className="input" type="number" placeholder="10000000" value={goal.target || ''} onChange={(e) => setGoal(p => ({ ...p, target: Number(e.target.value) }))} /></div>
            <div className="form-group mb-1"><label className="form-label">Expected Annual Return (%)</label>
              <input className="input" type="number" value={goal.rate || ''} onChange={(e) => setGoal(p => ({ ...p, rate: Number(e.target.value) }))} /></div>
            <div className="form-group mb-2"><label className="form-label">Time Horizon (Years)</label>
              <input className="input" type="number" value={goal.years || ''} onChange={(e) => setGoal(p => ({ ...p, years: Number(e.target.value) }))} /></div>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }}>🎯</div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>To reach</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'Outfit,sans-serif', color: 'var(--gold)' }}>{formatCurrency(goal.target)}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0' }}>in {goal.years} years at {goal.rate}% p.a.</div>
            </div>
            <div style={{ padding: '1.25rem 2rem', background: 'var(--green-glow)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Invest monthly via SIP</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'Outfit,sans-serif', color: 'var(--green)' }}>{formatCurrency(sipMonthlyNeeded)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Rule of 72 */}
      {tab === 'r72' && (
        <div className="grid-2">
          <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚡</div>
            <h2 style={{ marginBottom: '0.5rem' }}>Rule of 72</h2>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>A quick way to estimate how many years it takes to double your money.</p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Annual Return Rate (%)</label>
              <input className="input" type="number" value={params.annualRate || ''} onChange={(e) => upd('annualRate', Number(e.target.value))}
                style={{ maxWidth: 200, margin: '0 auto' }} />
            </div>
            <div style={{ fontSize: '4rem', fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: 'var(--gold)', lineHeight: 1 }}>
              {ruleOf72(params.annualRate)} yrs
            </div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.875rem' }}>to double your money at {params.annualRate}% p.a.</div>
            <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Formula: <strong style={{ color: 'var(--text-primary)' }}>72 ÷ {params.annualRate} = {ruleOf72(params.annualRate)} years</strong>
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Quick Reference Table</h3>
            <table className="inv-table">
              <thead><tr><th>Rate</th><th>Years to Double</th><th>₹1L becomes</th></tr></thead>
              <tbody>
                {[6, 8, 10, 12, 15, 18, 20, 24].map((rate) => (
                  <tr key={rate}>
                    <td><span className="badge badge-blue">{rate}%</span></td>
                    <td style={{ fontWeight: 600 }}>{ruleOf72(rate)} yrs</td>
                    <td style={{ color: 'var(--green)' }}>{formatCurrency(100000 * Math.pow(1 + rate / 100, 10))} in 10yr</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
