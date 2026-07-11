'use client';
import { useState, useEffect } from 'react';
import { getProfile } from '@/lib/storage';
import { formatCurrency } from '@/lib/formatters';
import { Coins, Info, ShieldCheck } from 'lucide-react';

export default function TaxPage() {
  const [params, setParams] = useState({
    gross: 1200000, // ₹12 Lakhs default
    hra: 120000,   // ₹1.2 Lakhs HRA
    c80: 150000,   // ₹1.5L standard 80C
    d80: 25000,    // ₹25k standard 80D
    nps: 50000,    // ₹50k NPS
    other: 0       // other deductions
  });

  useEffect(() => {
    const p = getProfile();
    if (p?.monthlySalary) {
      setParams((prev) => ({ ...prev, gross: p.monthlySalary * 12 }));
    }
  }, []);

  const upd = (key: string, val: number) => setParams((p) => ({ ...p, [key]: val }));

  // Helper: Calculate Old Regime Tax
  const calcOldRegime = () => {
    const stdDeduction = 50000;
    const totalDeductions = stdDeduction + Math.min(params.c80, 150000) + Math.min(params.d80, 50000) + Math.min(params.nps, 50000) + params.hra + params.other;
    const taxableIncome = Math.max(params.gross - totalDeductions, 0);

    let baseTax = 0;
    if (taxableIncome <= 500000) {
      baseTax = 0; // Rebate u/s 87A up to 5L
    } else {
      // 0 - 2.5L: Nil
      // 2.5L - 5L: 5%
      // 5L - 10L: 20%
      // Above 10L: 30%
      if (taxableIncome <= 250000) baseTax = 0;
      else if (taxableIncome <= 500000) baseTax = (taxableIncome - 250000) * 0.05;
      else if (taxableIncome <= 1000000) baseTax = 12500 + (taxableIncome - 500000) * 0.20;
      else baseTax = 112500 + (taxableIncome - 1000000) * 0.30;
    }

    const cess = baseTax * 0.04;
    const totalTax = baseTax + cess;

    return {
      taxableIncome,
      deductions: totalDeductions,
      baseTax,
      cess,
      totalTax: Math.round(totalTax)
    };
  };

  // Helper: Calculate New Regime Tax (FY 2024-25 / FY 2025-26 rules)
  const calcNewRegime = () => {
    const stdDeduction = 75000; // Increased standard deduction
    const taxableIncome = Math.max(params.gross - stdDeduction, 0);

    let baseTax = 0;
    // New Slabs:
    // Up to 3L: Nil
    // 3L - 7L: 5% (effective rebate up to 7L after std deduction, i.e. 7.75L gross)
    // 7L - 10L: 10%
    // 10L - 12L: 15%
    // 12L - 15L: 20%
    // Above 15L: 30%
    if (taxableIncome <= 700000) {
      baseTax = 0; // Rebate u/s 87A up to 7L taxable
    } else {
      if (taxableIncome <= 300000) baseTax = 0;
      else if (taxableIncome <= 700000) baseTax = (taxableIncome - 300000) * 0.05;
      else if (taxableIncome <= 1000000) baseTax = 20000 + (taxableIncome - 700000) * 0.10;
      else if (taxableIncome <= 1200000) baseTax = 50000 + (taxableIncome - 1000000) * 0.15;
      else if (taxableIncome <= 1500000) baseTax = 80000 + (taxableIncome - 1200000) * 0.20;
      else baseTax = 140000 + (taxableIncome - 1500000) * 0.30;
    }

    const cess = baseTax * 0.04;
    const totalTax = baseTax + cess;

    return {
      taxableIncome,
      deductions: stdDeduction,
      baseTax,
      cess,
      totalTax: Math.round(totalTax)
    };
  };

  const oldRes = calcOldRegime();
  const newRes = calcNewRegime();

  const taxDifference = Math.abs(oldRes.totalTax - newRes.totalTax);
  const recommendedRegime = oldRes.totalTax < newRes.totalTax ? 'Old Regime' : 'New Regime';
  const recommendationColor = recommendedRegime === 'New Regime' ? 'var(--green)' : 'var(--blue-light)';

  return (
    <div className="animate-fade">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1>Tax Regime Planner</h1>
          <div className="section-sub">Compare Indian Income Tax regimes side-by-side to choose your optimal path</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid-3" style={{ alignItems: 'start', marginBottom: '1.5rem' }}>
        {/* Left Inputs */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Coins size={18} /> Tax Inputs</h3>

          <div className="form-group">
            <label className="form-label">Annual Gross Income (₹)</label>
            <input className="input" type="number" value={params.gross || ''} onChange={(e) => upd('gross', Number(e.target.value))} />
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Include basic salary, bonuses, interest, etc.</div>
          </div>

          <div className="form-group">
            <label className="form-label">HRA Exemption (Old Regime) (₹)</label>
            <input className="input" type="number" value={params.hra || ''} onChange={(e) => upd('hra', Number(e.target.value))} />
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">80C Investments (₹)</label>
              <input className="input" type="number" value={params.c80 || ''} onChange={(e) => upd('c80', Number(e.target.value))} />
              <div style={{ fontSize: '0.6rem', color: params.c80 > 150000 ? 'var(--red)' : 'var(--text-muted)' }}>
                {params.c80 > 150000 ? '⚠️ Exceeds ₹1.5L cap (capped in math)' : 'Max ₹1.5 Lakhs (PPF, ELSS, PF)'}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">80D Health Ins. (₹)</label>
              <input className="input" type="number" value={params.d80 || ''} onChange={(e) => upd('d80', Number(e.target.value))} />
              <div style={{ fontSize: '0.6rem', color: params.d80 > 50000 ? 'var(--red)' : 'var(--text-muted)' }}>
                {params.d80 > 50000 ? '⚠️ Exceeds ₹50k cap (capped in math)' : 'Max ₹50,000 (Self+Parents)'}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">NPS u/s 80CCD(1B) (₹)</label>
            <input className="input" type="number" value={params.nps || ''} onChange={(e) => upd('nps', Number(e.target.value))} />
            <div style={{ fontSize: '0.65rem', color: params.nps > 50000 ? 'var(--red)' : 'var(--text-secondary)' }}>
              {params.nps > 50000 ? '⚠️ Exceeds ₹50k cap (capped in math)' : 'Additional deduction up to ₹50,000'}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Other Deductions (Old Regime) (₹)</label>
            <input className="input" type="number" value={params.other || ''} onChange={(e) => upd('other', Number(e.target.value))} />
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>LTA, Professional Tax, Home Loan interest, etc.</div>
          </div>
        </div>

        {/* Right Outputs */}
        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Recommendation Banner */}
          <div className="card" style={{ border: `1px solid ${recommendationColor}`, background: 'rgba(255,255,255,0.01)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${recommendationColor}20`, display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={24} color={recommendationColor} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>WealthOS Recommendation</div>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Choose the <span style={{ color: recommendationColor }}>{recommendedRegime}</span></h2>
              {taxDifference > 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  It will save you <strong>{formatCurrency(taxDifference)}</strong> in taxes this financial year.
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  Both tax regimes yield exactly the same tax liability of <strong>{formatCurrency(oldRes.totalTax)}</strong>.
                </div>
              )}
            </div>
          </div>

          {/* Side-by-Side comparison grid */}
          <div className="grid-2">
            {/* Old Regime Card */}
            <div className="card" style={{ border: recommendedRegime === 'Old Regime' ? '1px solid var(--blue-accent)' : '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Old Tax Regime</h3>
                {recommendedRegime === 'Old Regime' && <span className="badge badge-blue">Optimal</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Gross Income</span>
                  <span>{formatCurrency(params.gross)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--red)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Deductions</span>
                  <span>- {formatCurrency(oldRes.deductions)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', fontWeight: 600 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Taxable Income</span>
                  <span>{formatCurrency(oldRes.taxableIncome)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Base Tax</span>
                  <span>{formatCurrency(oldRes.baseTax)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cess (4%)</span>
                  <span>{formatCurrency(oldRes.cess)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border)', paddingTop: '0.5rem', fontWeight: 800, fontSize: '1.1rem', color: recommendedRegime === 'Old Regime' ? 'var(--blue-light)' : 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Final Tax Payable</span>
                  <span>{formatCurrency(oldRes.totalTax)}</span>
                </div>
              </div>
            </div>

            {/* New Regime Card */}
            <div className="card" style={{ border: recommendedRegime === 'New Regime' ? '1px solid var(--green)' : '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>New Tax Regime</h3>
                {recommendedRegime === 'New Regime' && <span className="badge badge-green">Optimal</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Gross Income</span>
                  <span>{formatCurrency(params.gross)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--red)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Std Deduction</span>
                  <span>- {formatCurrency(newRes.deductions)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', fontWeight: 600 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Taxable Income</span>
                  <span>{formatCurrency(newRes.taxableIncome)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Base Tax</span>
                  <span>{formatCurrency(newRes.baseTax)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cess (4%)</span>
                  <span>{formatCurrency(newRes.cess)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border)', paddingTop: '0.5rem', fontWeight: 800, fontSize: '1.1rem', color: recommendedRegime === 'New Regime' ? 'var(--green)' : 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Final Tax Payable</span>
                  <span>{formatCurrency(newRes.totalTax)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Informational Tip Card */}
          <div className="card" style={{ background: 'var(--bg-glass)', display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
            <Info size={16} color="var(--blue-light)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              <strong>Regime Rule Reminder:</strong> The New Tax Regime features lower tax slabs but disables standard deductions like Section 80C, 80D, HRA, and home loan interest. However, standard deduction is allowed up to ₹75,000, and no tax is paid for gross incomes up to ₹7.75 Lakhs! Use this tool to see if your exemptions under Old Regime beat the default discount of the New Regime.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
