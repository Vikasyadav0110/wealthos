'use client';
import { useState, useEffect } from 'react';
import { getProfile, saveProfile } from '@/lib/storage';
import type { UserProfile } from '@/types';
import { Key, Eye, EyeOff, Save, RotateCcw, CheckCircle, Lock, LockOpen, Timer, Download, Upload } from 'lucide-react';
import { isAuthEnabled, getLockTimeout, setLockTimeout } from '@/lib/auth';
import PasswordModal from '@/components/auth/PasswordModal';
import { useToast } from '@/components/ui/Toast';

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showClaude, setShowClaude] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const [saved, setSaved] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [lockTimeout, setLockTimeoutState] = useState(15);
  const { success } = useToast();

  useEffect(() => {
    setProfile(getProfile());
    setAuthEnabled(isAuthEnabled());
    setLockTimeoutState(getLockTimeout());
  }, []);

  const handleBackup = () => {
    const backupData: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('wealthos_')) {
        backupData[key] = localStorage.getItem(key) || '';
      }
    }
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wealthos_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('This will overwrite all current financial records, categories, and settings. Are you sure?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as Record<string, string>;
        const valid = Object.keys(data).every((k) => k.startsWith('wealthos_'));
        if (!valid || Object.keys(data).length === 0) {
          alert('Invalid backup file. Missing WealthOS data signatures.');
          return;
        }
        Object.entries(data).forEach(([k, v]) => {
          localStorage.setItem(k, v);
        });
        alert('Data restored successfully! The application will now reload.');
        window.location.reload();
      } catch {
        alert('Error parsing backup file. Please upload a valid JSON backup.');
      }
    };
    reader.readAsText(file);
  };


  const upd = (k: keyof UserProfile, v: unknown) => setProfile((p) => p ? { ...p, [k]: v } : p);

  const save = () => {
    if (profile) {
      saveProfile(profile);
      setSaved(true);
      success('Settings saved successfully!');
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const reset = () => {
    if (confirm('This will clear ALL your data including salary, investments, and chat history. Are you sure?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  if (!profile) return null;

  return (
    <div className="animate-fade">
      <div className="section-header">
        <div><h1>Settings</h1><div className="section-sub">Manage your profile, API keys, and preferences</div></div>
        <button className="btn btn-primary" onClick={save}>
          {saved ? <><CheckCircle size={16} /> Saved!</> : <><Save size={16} /> Save Changes</>}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 680 }}>
        {/* Profile */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem' }}>👤 Profile</h3>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input className="input" value={profile.name} onChange={(e) => upd('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select className="select" value={profile.currency} onChange={(e) => upd('currency', e.target.value)}>
                <option value="₹">₹ Indian Rupee (INR)</option>
                <option value="$">$ US Dollar (USD)</option>
                <option value="€">€ Euro (EUR)</option>
                <option value="£">£ British Pound (GBP)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Monthly Salary (₹)</label>
              <input className="input" type="number" value={profile.monthlySalary || ''} onChange={(e) => upd('monthlySalary', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Monthly Expenses (₹)</label>
              <input className="input" type="number" value={profile.monthlyExpenses || ''} onChange={(e) => upd('monthlyExpenses', Number(e.target.value))} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">Investment Risk Appetite</label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              {(['conservative', 'moderate', 'aggressive'] as const).map((r) => (
                <button key={r} onClick={() => upd('riskAppetite', r)}
                  className={`btn ${profile.riskAppetite === r ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ textTransform: 'capitalize', flex: 1, minWidth: 120 }}>
                  {r === 'conservative' ? '🛡️' : r === 'moderate' ? '⚖️' : '🚀'} {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>🔑 API Keys</h3>
          <p style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>Keys are stored only in your browser&apos;s localStorage — never sent to any third party.</p>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">
              <Key size={14} style={{ display: 'inline', marginRight: '0.35rem' }} />
              Claude API Key (Anthropic) <span className="form-required">*</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input className="input" type={showClaude ? 'text' : 'password'} placeholder="sk-ant-api03-..."
                value={profile.claudeApiKey || ''} onChange={(e) => upd('claudeApiKey', e.target.value)} />
              <button className="btn btn-ghost btn-icon" onClick={() => setShowClaude((v) => !v)}>
                {showClaude ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Get at: <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-light)' }}>console.anthropic.com</a> → API Keys
            </div>
            {profile.claudeApiKey && <div className="badge badge-green" style={{ marginTop: '0.5rem' }}><CheckCircle size={12} /> Configured</div>}
          </div>

          <div className="form-group">
            <label className="form-label">
              <Key size={14} style={{ display: 'inline', marginRight: '0.35rem' }} />
              NewsAPI Key (optional)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input className="input" type={showNews ? 'text' : 'password'} placeholder="Enter NewsAPI.org key..."
                value={profile.newsApiKey || ''} onChange={(e) => upd('newsApiKey', e.target.value)} />
              <button className="btn btn-ghost btn-icon" onClick={() => setShowNews((v) => !v)}>
                {showNews ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Free at: <a href="https://newsapi.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-light)' }}>newsapi.org</a> · 100 requests/day free
            </div>
            {profile.newsApiKey && <div className="badge badge-green" style={{ marginTop: '0.5rem' }}><CheckCircle size={12} /> Configured</div>}
          </div>
        </div>

        {/* App Lock */}
        <div className="card" style={{ border: '1px solid rgba(59,130,246,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={18} color="white" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>🔒 App Lock</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Password-protect your financial data</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: authEnabled ? 'rgba(16,185,129,0.08)' : 'var(--bg-glass)', border: `1px solid ${authEnabled ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`, borderRadius: 10, marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {authEnabled ? <Lock size={18} color="var(--green)" /> : <LockOpen size={18} color="var(--text-muted)" />}
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: authEnabled ? 'var(--green)' : 'var(--text-secondary)' }}>
                  {authEnabled ? 'Password protection is ON' : 'No password set'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {authEnabled ? 'App locks after inactivity' : 'Anyone can access your data'}
                </div>
              </div>
            </div>
            <span className={`badge ${authEnabled ? 'badge-green' : 'badge-gray'}`}>
              {authEnabled ? '🔒 Active' : '🔓 Off'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: authEnabled ? '1rem' : '0' }}>
            <button className="btn btn-primary" onClick={() => setShowPasswordModal(true)}>
              <Lock size={16} /> {authEnabled ? 'Manage Password' : 'Set Password'}
            </button>
          </div>

          {authEnabled && (
            <div className="form-group">
              <label className="form-label"><Timer size={14} style={{ display: 'inline', marginRight: '0.35rem' }} />Auto-lock after inactivity</label>
              <select className="select" value={String(lockTimeout)} onChange={(e) => {
                const v = Number(e.target.value);
                setLockTimeoutState(v);
                setLockTimeout(v);
              }}>
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="15">15 minutes (default)</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="999">Never (manual lock only)</option>
              </select>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Use the 🔒 button in the top bar to lock instantly at any time.</div>
            </div>
          )}
        </div>

        {/* Emergency Fund */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem' }}>🛡️ Financial Preferences</h3>
          <div className="form-group">
            <label className="form-label">Emergency Fund Target (months of expenses)</label>
            <select className="select" value={profile.emergencyFundMonths}
              onChange={(e) => upd('emergencyFundMonths', Number(e.target.value))}>
              <option value={3}>3 months (minimum)</option>
              <option value={6}>6 months (recommended)</option>
              <option value={12}>12 months (very conservative)</option>
            </select>
          </div>
        </div>

        {/* Backup & Restore */}
        <div className="card" style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Download size={18} color="white" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>💾 Backup & Restore</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Save your financial records locally or restore them</div>
            </div>
          </div>

          <p style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Since WealthOS runs offline and stores everything locally, we recommend taking regular backups to prevent data loss when clearing browser cache.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleBackup} style={{ background: 'linear-gradient(135deg, var(--green), #059669)', boxShadow: '0 4px 15px rgba(16,185,129,0.2)' }}>
              <Download size={16} /> Download Backup (.json)
            </button>
            <label className="btn btn-ghost" style={{ cursor: 'pointer', position: 'relative' }}>
              <Upload size={16} /> Upload & Restore Data
              <input type="file" accept=".json" onChange={handleRestore} style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }} />
            </label>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--red)' }}>⚠️ Danger Zone</h3>
          <p style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>This will permanently delete all your data — salary entries, investments, chat history, and settings.</p>
          <button className="btn btn-danger" onClick={reset}>
            <RotateCcw size={16} /> Reset All Data
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary btn-lg" onClick={save}>
            {saved ? <><CheckCircle size={18} /> Saved!</> : <><Save size={18} /> Save All Changes</>}
          </button>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <PasswordModal onClose={() => {
          setShowPasswordModal(false);
          setAuthEnabled(isAuthEnabled());
        }} />
      )}
    </div>
  );
}
