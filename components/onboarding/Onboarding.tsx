'use client';
import { saveProfile } from '@/lib/storage';
import type { UserProfile } from '@/types';
import { Zap } from 'lucide-react';

interface Props { onComplete: () => void; }

export default function Onboarding({ onComplete }: Props) {
  const finish = () => {
    const profile: UserProfile = {
      name: 'User',
      riskAppetite: 'moderate',
      monthlySalary: 0,
      monthlyExpenses: 0,
      emergencyFundMonths: 6,
      emergencyFundCurrent: 0,
      currency: '₹',
      claudeApiKey: '',
      newsApiKey: '',
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
          <button className="btn btn-primary btn-lg w-full" onClick={finish}>Get Started →</button>
        </div>
      </div>
    </div>
  );
}
