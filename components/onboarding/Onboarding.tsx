'use client';
import { useState } from 'react';
import { saveProfile } from '@/lib/storage';
import type { UserProfile } from '@/types';
import { generateId } from '@/lib/formatters';
import { Zap, User, DollarSign, Shield, Key } from 'lucide-react';

interface Props { onComplete: () => void; }

const STEPS = ['Welcome', 'Profile', 'Financial Setup', 'Risk & Keys'];

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Partial<UserProfile>>({
    name: '',
    riskAppetite: 'moderate',
    monthlySalary: 0,
    monthlyExpenses: 0,
    emergencyFundMonths: 6,
    currency: '₹',
    claudeApiKey: '',
    newsApiKey: '',
    onboardingComplete: false,
  });

  const update = (key: keyof UserProfile, val: unknown) =>
    setForm((f) => ({ ...f, [key]: val }));

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  const finish = () => {
    const profile: UserProfile = {
      ...(form as UserProfile),
      onboardingComplete: true,
    };
    saveProfile(profile);
    onComplete();
  };

  return (
    <div className="onboarding-bg">
      <div className="onboarding-card">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div className="sidebar-logo-icon"><Zap size={22} color="white" /></div>
          <div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 700 }}>WealthOS</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Your Personal Financial OS</div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="step-indicator">
          {STEPS.map((_, i) => (
            <div key={i} className={`step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
          ))}
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Step {step + 1} of {STEPS.length}
          </span>
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="animate-fade">
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>👋</div>
            <h2 style={{ marginBottom: '0.5rem' }}>Welcome to WealthOS</h2>
            <p style={{ marginBottom: '1.5rem' }}>
              Your all-in-one financial command center. Track salary, grow wealth through compounding,
              manage investments, and get personalized AI advice — all in one place.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
              {[
                ['💰', 'Track salary & savings rate'],
                ['📈', 'Compound growth calculator'],
                ['📊', 'Manual investment tracker with P&L'],
                ['🤖', 'AI advisor powered by Claude'],
                ['📰', 'Live market & business news'],
              ].map(([icon, text]) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <span style={{ fontSize: '1.2rem' }}>{icon}</span> {text}
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-lg w-full" onClick={next}>Get Started →</button>
          </div>
        )}

        {/* Step 1: Profile */}
        {step === 1 && (
          <div className="animate-fade">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <User size={20} color="var(--blue)" />
              <h2>Tell us about yourself</h2>
            </div>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>This helps personalize your experience.</p>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Your Name <span className="form-required">*</span></label>
              <input className="input" placeholder="e.g. Rahul Sharma" value={form.name}
                onChange={(e) => update('name', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Currency</label>
              <select className="select" value={form.currency} onChange={(e) => update('currency', e.target.value)}>
                <option value="₹">₹ Indian Rupee (INR)</option>
                <option value="$">$ US Dollar (USD)</option>
                <option value="€">€ Euro (EUR)</option>
                <option value="£">£ British Pound (GBP)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-ghost" onClick={back}>Back</button>
              <button className="btn btn-primary w-full" onClick={next} disabled={!form.name?.trim()}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 2: Financial Setup */}
        {step === 2 && (
          <div className="animate-fade">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <DollarSign size={20} color="var(--gold)" />
              <h2>Financial snapshot</h2>
            </div>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>Used for your dashboard overview. You can update anytime.</p>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Monthly Gross Salary ({form.currency})</label>
              <input className="input" type="number" placeholder="e.g. 80000" value={form.monthlySalary || ''}
                onChange={(e) => update('monthlySalary', Number(e.target.value))} />
            </div>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Monthly Expenses ({form.currency})</label>
              <input className="input" type="number" placeholder="e.g. 35000" value={form.monthlyExpenses || ''}
                onChange={(e) => update('monthlyExpenses', Number(e.target.value))} />
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Emergency Fund Target (months of expenses)</label>
              <select className="select" value={form.emergencyFundMonths}
                onChange={(e) => update('emergencyFundMonths', Number(e.target.value))}>
                <option value={3}>3 months (minimum)</option>
                <option value={6}>6 months (recommended)</option>
                <option value={12}>12 months (very safe)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-ghost" onClick={back}>Back</button>
              <button className="btn btn-primary w-full" onClick={next}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3: Risk & API Keys */}
        {step === 3 && (
          <div className="animate-fade">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Shield size={20} color="var(--purple)" />
              <h2>Risk profile & AI setup</h2>
            </div>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>API keys are stored locally in your browser only — never sent to any server except the API itself.</p>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Investment Risk Appetite</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {(['conservative', 'moderate', 'aggressive'] as const).map((r) => (
                  <button key={r} onClick={() => update('riskAppetite', r)}
                    className={`btn ${form.riskAppetite === r ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ textTransform: 'capitalize', flex: 1 }}>
                    {r === 'conservative' ? '🛡️' : r === 'moderate' ? '⚖️' : '🚀'} {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">
                <Key size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
                Claude API Key <span className="form-required">*</span>
              </label>
              <input className="input" type="password" placeholder="sk-ant-..." value={form.claudeApiKey}
                onChange={(e) => update('claudeApiKey', e.target.value)} />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Get free at console.anthropic.com → API Keys
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">
                <Key size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
                NewsAPI Key <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input className="input" type="password" placeholder="Enter NewsAPI key for live news..." value={form.newsApiKey}
                onChange={(e) => update('newsApiKey', e.target.value)} />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Free at newsapi.org — skip to use demo news
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-ghost" onClick={back}>Back</button>
              <button className="btn btn-gold btn-lg w-full" onClick={finish}
                disabled={!form.claudeApiKey?.trim()}>
                🚀 Launch WealthOS
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
