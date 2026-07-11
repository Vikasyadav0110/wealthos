'use client';
import { useState } from 'react';
import { formatCurrency } from '@/lib/formatters';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Percent, HelpCircle, ShieldAlert, Sparkles, ChevronRight, Table } from 'lucide-react';

export default function LoansPage() {
  const [params, setParams] = useState({
    amount: 3000000, // ₹30 Lakhs default (e.g. Car / Housing)
    rate: 9,        // 9% p.a.
    years: 15,      // 15 years tenure
    prepayment: 5000 // ₹5,000 extra prepayment per month
  });

  const upd = (key: string, val: number) => setParams((p) => ({ ...p, [key]: val }));

  // Helper: Standard Loan Amortization Simulation
  const simulateLoan = (withPrepayment: boolean) => {
    const P = params.amount || 0;
    const annualRate = params.rate || 0;
    const years = params.years || 0;
    const N = Math.max(years * 12, 1); // Guard tenure from being 0
    const i = annualRate / 12 / 100; // monthly rate

    // Standard EMI formula
    const emi = i === 0 ? P / N : (P * i * Math.pow(1 + i, N)) / (Math.pow(1 + i, N) - 1);

    let principalRem = P;
    let totalInterest = 0;
    let monthsElapsed = 0;
    const schedule: { month: number; interestPaid: number; principalPaid: number; prepaymentPaid: number; balance: number }[] = [];

    const firstMonthInterest = P * i;
    // If EMI is valid and covers the interest
    if ((emi > firstMonthInterest || i === 0) && P > 0) {
      while (principalRem > 0 && monthsElapsed < 360) { // Limit to 30 years cap safety
        monthsElapsed++;
        const interestPaid = principalRem * i;
        let principalPaid = emi - interestPaid;
        const prepaymentPaid = withPrepayment ? params.prepayment : 0;

        let totalPaidThisMonth = principalPaid + prepaymentPaid;
        if (principalRem < totalPaidThisMonth) {
          // Adjust for final month payment
          totalPaidThisMonth = principalRem;
          principalPaid = principalRem;
          principalRem = 0;
        } else {
          principalRem -= totalPaidThisMonth;
        }

        totalInterest += interestPaid;
        schedule.push({
          month: monthsElapsed,
          interestPaid,
          principalPaid,
          prepaymentPaid: withPrepayment ? Math.min(prepaymentPaid, principalRem + totalPaidThisMonth - principalPaid) : 0,
          balance: Math.max(principalRem, 0)
        });
      }
    }

    return {
      emi: Math.round(emi) || 0,
      totalInterest: Math.round(totalInterest) || 0,
      months: monthsElapsed || N,
      schedule
    };
  };

  const original = simulateLoan(false);
  const prepaid = simulateLoan(true);

  const interestSaved = Math.max(original.totalInterest - prepaid.totalInterest, 0);
  const monthsSaved = Math.max(original.months - prepaid.months, 0);
  const yearsSavedText = monthsSaved >= 12 ? `(${(monthsSaved / 12).toFixed(1)} years)` : '';

  // BarChart Data
  const chartData = [
    { name: 'Original Plan', Interest: original.totalInterest, Principal: params.amount },
    { name: 'Prepayment Plan', Interest: prepaid.totalInterest, Principal: params.amount }
  ];

  return (
    <div className="animate-fade">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1>Loan & Prepayment Calculator</h1>
          <div className="section-sub">See how small monthly prepayments can shave years and lakhs of interest off your loan</div>
        </div>
      </div>

      {/* Main split */}
      <div className="grid-3" style={{ alignItems: 'start', marginBottom: '1.5rem' }}>
        {/* Form parameters */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Percent size={18} color="var(--blue)" /> Loan Setup</h3>
          
          <div className="form-group">
            <label className="form-label">Loan Amount (₹)</label>
            <input className="input" type="number" value={params.amount || ''} onChange={(e) => upd('amount', Number(e.target.value))} />
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Interest Rate (%)</label>
              <input className="input" type="number" step="0.1" value={params.rate || ''} onChange={(e) => upd('rate', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Tenure (Years)</label>
              <input className="input" type="number" value={params.years || ''} onChange={(e) => upd('years', Number(e.target.value))} />
            </div>
          </div>

          <div className="form-group" style={{ borderTop: '1px dashed var(--border)', paddingTop: '1rem' }}>
            <label className="form-label" style={{ color: 'var(--green)', fontWeight: 600 }}>Extra Prepayment (₹/month)</label>
            <input className="input" type="number" placeholder="0" value={params.prepayment || ''} onChange={(e) => upd('prepayment', Number(e.target.value))}
              style={{ borderColor: 'rgba(16,185,129,0.3)', boxShadow: '0 0 10px rgba(16,185,129,0.05)' }} />
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Added directly to your monthly EMI payment</div>
          </div>
        </div>

        {/* Results Metrics */}
        <div className="card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ margin: 0 }}>📊 Savings Summary</h3>

          <div className="grid-3">
            <div className="stat-card" style={{ background: 'var(--blue-glow)' }}>
              <div className="stat-label">Monthly EMI</div>
              <div className="stat-value">{formatCurrency(original.emi)}</div>
              <div className="stat-sub">Prepayment: +{formatCurrency(params.prepayment)}/mo</div>
            </div>
            <div className="stat-card" style={{ background: 'var(--green-glow)' }}>
              <div className="stat-label">Total Interest Saved</div>
              <div className="stat-value" style={{ color: 'var(--green)' }}>{formatCurrency(interestSaved)}</div>
              <div className="stat-sub">Paid ₹{prepaid.totalInterest.toLocaleString('en-IN')} instead of ₹{original.totalInterest.toLocaleString('en-IN')}</div>
            </div>
            <div className="stat-card" style={{ background: 'var(--gold-glow)' }}>
              <div className="stat-label">Time Saved</div>
              <div className="stat-value" style={{ color: 'var(--gold)' }}>{monthsSaved} Months</div>
              <div className="stat-sub">Loan cleared in {(prepaid.months / 12).toFixed(1)} yrs {yearsSavedText}</div>
            </div>
          </div>

          {interestSaved > 0 ? (
            <div className="alert alert-success" style={{ fontSize: '0.82rem' }}>
              <Sparkles size={16} />
              <div>By prepaying <strong>{formatCurrency(params.prepayment)} every month</strong>, your total payment reduces to <strong>{formatCurrency(params.amount + prepaid.totalInterest)}</strong>, saving you <strong>{formatCurrency(interestSaved)}</strong> in unnecessary interest costs!</div>
            </div>
          ) : (
            <div className="alert alert-info">
              💡 Enter an extra prepayment amount on the left to see how much interest and years you can save.
            </div>
          )}

          {/* Bar Chart comparing plans */}
          <div style={{ height: 200, marginTop: '0.5rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [formatCurrency(Number(v)), 'Paid']} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                <Bar dataKey="Principal" stackId="a" fill="var(--blue)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Interest" stackId="a" fill="var(--red)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Amortization schedule summary */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <Table size={18} />
          <h3 style={{ margin: 0 }}>Amortization Schedule (Prepayment Plan)</h3>
        </div>

        {prepaid.schedule.length === 0 ? (
          <div className="empty-state">No schedule generated</div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 350 }}>
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Interest Paid</th>
                  <th>Principal Paid</th>
                  <th>Prepayment</th>
                  <th>Total Payment</th>
                  <th>Balance Principal</th>
                </tr>
              </thead>
              <tbody>
                {prepaid.schedule.filter((_, idx) => idx % 12 === 0 || idx === prepaid.schedule.length - 1).map((s) => (
                  <tr key={s.month}>
                    <td style={{ fontWeight: 600 }}>Month {s.month} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>({(s.month / 12).toFixed(0)} yr)</span></td>
                    <td style={{ color: 'var(--red)' }}>{formatCurrency(s.interestPaid)}</td>
                    <td>{formatCurrency(s.principalPaid)}</td>
                    <td style={{ color: 'var(--green)' }}>{formatCurrency(s.prepaymentPaid)}</td>
                    <td style={{ fontWeight: 500 }}>{formatCurrency(s.interestPaid + s.principalPaid + s.prepaymentPaid)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--blue)' }}>{formatCurrency(s.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>* Showing schedule intervals of every 12 months for brevity.</div>
      </div>
    </div>
  );
}
