'use client';
import { useState } from 'react';
import { formatCurrency } from '@/lib/formatters';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Percent, Sparkles, Table } from 'lucide-react';

export default function LoansPage() {
  const [params, setParams] = useState({
    amount: 3000000, // ₹30 Lakhs default (e.g. Car / Housing)
    rate: 9,        // 9% p.a.
    years: 15,      // 15 years tenure
    prepayment: 5000, // ₹5,000 extra prepayment per month
    emisPaid: 0      // 0 months paid by default
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

    // Calculate outstanding balance after standard EMIs are paid
    let outstandingPrincipal = P;
    let interestPaidSoFar = 0;
    let principalPaidSoFar = 0;
    const emisPaidCount = Math.min(params.emisPaid || 0, N);

    for (let m = 1; m <= emisPaidCount; m++) {
      const interestPaid = outstandingPrincipal * i;
      let principalPaid = emi - interestPaid;
      if (outstandingPrincipal < principalPaid) {
        principalPaid = outstandingPrincipal;
        outstandingPrincipal = 0;
      } else {
        outstandingPrincipal -= principalPaid;
      }
      interestPaidSoFar += interestPaid;
      principalPaidSoFar += principalPaid;
    }

    let principalRem = outstandingPrincipal;
    let totalInterestFuture = 0;
    let monthsElapsedFuture = 0;
    const schedule: { month: number; interestPaid: number; principalPaid: number; prepaymentPaid: number; balance: number }[] = [];

    const firstMonthInterest = principalRem * i;
    // If EMI is valid and covers the interest
    if ((emi > firstMonthInterest || i === 0) && principalRem > 0) {
      while (principalRem > 0 && (emisPaidCount + monthsElapsedFuture) < 360) { // Limit to 30 years cap safety
        monthsElapsedFuture++;
        const interestPaid = principalRem * i;
        let principalPaid = emi - interestPaid;
        const prepaymentPaid = withPrepayment ? params.prepayment : 0;

        let totalPaidThisMonth = principalPaid + prepaymentPaid;
        if (principalRem < totalPaidThisMonth) {
          totalPaidThisMonth = principalRem;
          principalPaid = principalRem;
          principalRem = 0;
        } else {
          principalRem -= totalPaidThisMonth;
        }

        totalInterestFuture += interestPaid;
        schedule.push({
          month: emisPaidCount + monthsElapsedFuture,
          interestPaid,
          principalPaid,
          prepaymentPaid: withPrepayment ? Math.min(prepaymentPaid, principalRem + totalPaidThisMonth - principalPaid) : 0,
          balance: Math.max(principalRem, 0)
        });
      }
    }

    return {
      emi: Math.round(emi) || 0,
      outstandingPrincipal: Math.round(outstandingPrincipal),
      interestPaidSoFar: Math.round(interestPaidSoFar),
      principalPaidSoFar: Math.round(principalPaidSoFar),
      totalInterestFuture: Math.round(totalInterestFuture),
      totalInterestAll: Math.round(interestPaidSoFar + totalInterestFuture),
      monthsRemaining: monthsElapsedFuture || Math.max(N - emisPaidCount, 0),
      schedule
    };
  };

  const original = simulateLoan(false);
  const prepaid = simulateLoan(true);

  const interestSaved = Math.max(original.totalInterestFuture - prepaid.totalInterestFuture, 0);
  const monthsSaved = Math.max(original.monthsRemaining - prepaid.monthsRemaining, 0);
  const yearsSavedText = monthsSaved >= 12 ? `(${(monthsSaved / 12).toFixed(1)} years)` : '';

  // BarChart Data (Compare future payments from today)
  const chartData = [
    { name: 'Original (Remaining)', Interest: original.totalInterestFuture, Principal: original.outstandingPrincipal },
    { name: 'Prepayment (Remaining)', Interest: prepaid.totalInterestFuture, Principal: prepaid.outstandingPrincipal }
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

          <div className="form-grid form-grid-2" style={{ borderTop: '1px dashed var(--border)', paddingTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">EMIs Paid (Months)</label>
              <input className="input" type="number" placeholder="0" value={params.emisPaid || ''} onChange={(e) => upd('emisPaid', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Remaining (Months)</label>
              <div className="input-like" style={{ padding: '0.5rem', background: 'var(--inner-card)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {Math.max(params.years * 12 - (params.emisPaid || 0), 0)} months
              </div>
            </div>
          </div>

          {/* Active loan progress box */}
          {params.emisPaid > 0 && (
            <div style={{ padding: '0.75rem', background: 'var(--inner-card)', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Principal Paid So Far:</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(original.principalPaidSoFar)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Interest Paid So Far:</span>
                <span style={{ fontWeight: 600, color: 'var(--red)' }}>{formatCurrency(original.interestPaidSoFar)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.35rem', marginTop: '0.15rem' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Outstanding Balance:</span>
                <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{formatCurrency(original.outstandingPrincipal)}</span>
              </div>
            </div>
          )}

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
              <div className="stat-sub">Paid ₹{prepaid.totalInterestFuture.toLocaleString('en-IN')} instead of ₹{original.totalInterestFuture.toLocaleString('en-IN')} (Future)</div>
            </div>
            <div className="stat-card" style={{ background: 'var(--gold-glow)' }}>
              <div className="stat-label">Remaining Time</div>
              <div className="stat-value" style={{ color: 'var(--gold)' }}>{prepaid.monthsRemaining} Months</div>
              <div className="stat-sub">Saved {monthsSaved} months {yearsSavedText}</div>
            </div>
          </div>

          {interestSaved > 0 ? (
            <div className="alert alert-success" style={{ fontSize: '0.82rem' }}>
              <Sparkles size={16} />
              <div>By prepaying <strong>{formatCurrency(params.prepayment)} every month</strong> from now on, your future remaining payment reduces to <strong>{formatCurrency(original.outstandingPrincipal + prepaid.totalInterestFuture)}</strong>, saving you <strong>{formatCurrency(interestSaved)}</strong> in unnecessary future interest!</div>
            </div>
          ) : (
            <div className="alert alert-info">
              💡 Enter an extra prepayment amount on the left to see how much interest and months you can save from today.
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
                    <td style={{ fontWeight: 600 }}>Month {s.month} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>({(s.month / 12).toFixed(1)} yr)</span></td>
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
