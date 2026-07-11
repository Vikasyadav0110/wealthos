'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getProfile } from '@/lib/storage';
import { Bell, Lock, Sun, Moon } from 'lucide-react';
import { isAuthEnabled, updateLastActive } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

const TITLES: Record<string, { title: string; sub: string }> = {
  '/':          { title: 'Dashboard', sub: 'Your financial overview' },
  '/salary':    { title: 'Salary Tracker', sub: 'Track your income & savings' },
  '/expenses':  { title: 'Daily Expenses', sub: 'Track individual day-to-day transactions' },
  '/categories': { title: 'Category Manager', sub: 'Configure income, expense, and asset tags' },
  '/compound':  { title: 'Growth Calculator', sub: 'Simulate compounding growth' },
  '/portfolio': { title: 'My Portfolio', sub: 'Track all your investments' },
  '/goals':     { title: 'Goals Tracker', sub: 'Define, visualize, and calculate plans to reach your savings targets' },
  '/guidance':  { title: 'Investment Guide', sub: 'Where to put your money' },
  '/news':      { title: 'Market News', sub: 'Latest financial headlines' },
  '/advisor':   { title: 'AI Advisor', sub: 'Powered by Claude AI' },
  '/settings':  { title: 'Settings', sub: 'API keys & preferences' },
  '/loans':     { title: 'Loan Calculator', sub: 'Calculate EMI and total interest' },
  '/tax':       { title: 'Tax Planner', sub: 'Estimate your tax liability' },
};

export default function TopBar() {
  const pathname = usePathname();
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [authOn, setAuthOn] = useState(false);
  const page = TITLES[pathname] || { title: 'WealthOS', sub: '' };
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const profile = getProfile();
    if (profile?.name) setName(profile.name);
    setAuthOn(isAuthEnabled());
    const tick = () => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return '☀️ Good morning';
    if (h < 17) return '🌤️ Good afternoon';
    return '🌙 Good evening';
  };

  const getInitials = (n: string) => {
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  const lockNow = () => {
    localStorage.setItem('wealthos_last_active', '0');
    window.location.reload();
  };

  return (
    <div className="topbar">
      <div>
        <div className="topbar-title">{page.title}</div>
        <div className="topbar-subtitle">{page.sub}</div>
      </div>
      <div className="topbar-right">
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
            {greeting()}{name ? `, ${name}` : ''}
          </div>
          <div className="topbar-time">{time} • {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
        </div>

        {/* Theme toggle */}
        <div className="tooltip-wrap">
          <button
            className="btn btn-ghost btn-icon theme-toggle-btn"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'light'
              ? <Moon size={18} />
              : <Sun size={18} />
            }
          </button>
          <span className="tooltip-box">{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
        </div>

        {authOn && (
          <div className="tooltip-wrap">
            <button className="btn btn-ghost btn-icon" title="Lock app" onClick={lockNow}
              style={{ color: 'var(--blue-light)' }}>
              <Lock size={18} />
            </button>
            <span className="tooltip-box">Lock app</span>
          </div>
        )}
        <button className="btn btn-ghost btn-icon" title="Notifications">
          <Bell size={18} />
        </button>
        {name && (
          <div className="user-avatar" title={name}>
            {getInitials(name)}
          </div>
        )}
      </div>
    </div>
  );
}
