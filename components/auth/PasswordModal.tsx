'use client';
import { useState, useEffect } from 'react';
import { setCredentials, disableAuth, verifyPassword, getPasswordHash, isAuthEnabled, getAuthEmail } from '@/lib/auth';
import { Eye, EyeOff, Lock, LockOpen, CheckCircle, X, ShieldCheck, AlertCircle } from 'lucide-react';

interface Props {
  onClose: () => void;
}

type Mode = 'status' | 'set' | 'change' | 'disable';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '6+ characters', ok: password.length >= 6 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const colors = ['', '#ef4444', '#f59e0b', '#10b981'];
  const labels = ['', 'Weak', 'Good', 'Strong'];

  if (!password) return null;

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.4rem' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= score ? colors[score] : 'rgba(255,255,255,0.08)', transition: 'background 0.3s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {checks.map(({ label, ok }) => (
            <span key={label} style={{ color: ok ? '#10b981' : '#4a5568', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              {ok ? '✓' : '○'} {label}
            </span>
          ))}
        </div>
        {score > 0 && <span style={{ color: colors[score], fontWeight: 600 }}>{labels[score]}</span>}
      </div>
    </div>
  );
}

export default function PasswordModal({ onClose }: Props) {
  const authEnabled = isAuthEnabled();
  const [mode, setMode] = useState<Mode>(authEnabled ? 'status' : 'set');
  const [email, setEmail] = useState('vikas@gmail.com');
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setEmail(getAuthEmail());
  }, []);

  const reset = () => { setCurrent(''); setNewPass(''); setConfirm(''); setError(''); };

  const handleSetPassword = async () => {
    setError('');
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (newPass.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPass !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    await setCredentials(email.trim(), newPass);
    setLoading(false);
    setSuccess('Credentials set successfully! App will lock on next visit.');
    setTimeout(() => { onClose(); window.location.reload(); }, 1800);
  };

  const handleChangePassword = async () => {
    setError('');
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (!current) { setError('Enter your current password.'); return; }
    const hash = getPasswordHash();
    if (hash) {
      const ok = await verifyPassword(current, hash);
      if (!ok) { setError('Current password is incorrect.'); return; }
    }
    if (newPass.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (newPass !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    await setCredentials(email.trim(), newPass);
    setLoading(false);
    setSuccess('Credentials updated successfully!');
    setTimeout(() => { onClose(); }, 1800);
  };

  const handleDisable = async () => {
    setError('');
    if (!current) { setError('Enter your current password to disable auth.'); return; }
    const hash = getPasswordHash();
    if (hash) {
      const ok = await verifyPassword(current, hash);
      if (!ok) { setError('Incorrect password.'); return; }
    }
    setLoading(true);
    disableAuth();
    setLoading(false);
    setSuccess('Password protection removed.');
    setTimeout(() => { onClose(); }, 1500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={18} color="white" />
            </div>
            <div>
              <div className="modal-title">App Lock Settings</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Protect your financial data with email and password</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
            <CheckCircle size={16} /> {success}
          </div>
        )}

        {/* Status view */}
        {mode === 'status' && !success && (
          <div>
            <div style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, marginBottom: '1.5rem', alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, background: 'rgba(16,185,129,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={20} color="#10b981" />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#10b981' }}>Password protection is active</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>Your app is locked when you return after being away.</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-ghost w-full" onClick={() => { reset(); setMode('change'); }} style={{ justifyContent: 'flex-start', gap: '0.75rem' }}>
                <Lock size={16} /> Change Password
              </button>
              <button className="btn btn-danger w-full" onClick={() => { reset(); setMode('disable'); }} style={{ justifyContent: 'flex-start', gap: '0.75rem' }}>
                <LockOpen size={16} /> Remove Password Protection
              </button>
            </div>
          </div>
        )}

        {/* Set password */}
        {(mode === 'set') && !success && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="alert alert-info">
              <AlertCircle size={16} />
              Set an email and password to lock the app when you&apos;re away. You&apos;ll need these credentials to sign in.
            </div>

            <div className="form-group">
              <label className="form-label">Email Address <span className="form-required">*</span></label>
              <input className="input" type="email" placeholder="e.g. user@example.com"
                value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
            </div>

            <div className="form-group">
              <label className="form-label">New Password <span className="form-required">*</span></label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showNew ? 'text' : 'password'} placeholder="Enter a strong password"
                  value={newPass} onChange={(e) => { setNewPass(e.target.value); setError(''); }}
                  style={{ paddingRight: '2.75rem' }} />
                <button type="button" onClick={() => setShowNew((v) => !v)}
                  style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <PasswordStrength password={newPass} />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password <span className="form-required">*</span></label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showConfirm ? 'text' : 'password'} placeholder="Repeat the password"
                  value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                  style={{ paddingRight: '2.75rem', borderColor: confirm && newPass && confirm !== newPass ? 'rgba(239,68,68,0.5)' : '' }} />
                <button type="button" onClick={() => setShowConfirm((v) => !v)}
                  style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirm && newPass && confirm !== newPass && (
                <div style={{ fontSize: '0.72rem', color: 'var(--red)', marginTop: '0.25rem' }}>Passwords don&apos;t match</div>
              )}
            </div>

            {error && <div className="alert alert-danger"><AlertCircle size={14} /> {error}</div>}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary w-full" onClick={handleSetPassword}
                disabled={loading || !email.trim() || !newPass || !confirm || newPass !== confirm}>
                {loading ? <><div className="spinner" /> Setting...</> : <><Lock size={16} /> Save Credentials</>}
              </button>
            </div>
          </div>
        )}

        {/* Change password */}
        {mode === 'change' && !success && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Email Address <span className="form-required">*</span></label>
              <input className="input" type="email" placeholder="e.g. user@example.com"
                value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
            </div>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showCurrent ? 'text' : 'password'} placeholder="Your current password"
                  value={current} onChange={(e) => { setCurrent(e.target.value); setError(''); }}
                  style={{ paddingRight: '2.75rem' }} />
                <button type="button" onClick={() => setShowCurrent((v) => !v)}
                  style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showNew ? 'text' : 'password'} placeholder="Enter new password"
                  value={newPass} onChange={(e) => { setNewPass(e.target.value); setError(''); }}
                  style={{ paddingRight: '2.75rem' }} />
                <button type="button" onClick={() => setShowNew((v) => !v)}
                  style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <PasswordStrength password={newPass} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showConfirm ? 'text' : 'password'} placeholder="Repeat new password"
                  value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                  style={{ paddingRight: '2.75rem' }} />
                <button type="button" onClick={() => setShowConfirm((v) => !v)}
                  style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <div className="alert alert-danger"><AlertCircle size={14} /> {error}</div>}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-ghost" onClick={() => setMode('status')}>Back</button>
              <button className="btn btn-primary w-full" onClick={handleChangePassword}
                disabled={loading || !email.trim() || !current || !newPass || !confirm || newPass !== confirm}>
                {loading ? 'Updating...' : 'Update Credentials'}
              </button>
            </div>
          </div>
        )}

        {/* Disable auth */}
        {mode === 'disable' && !success && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="alert alert-warning">
              <AlertCircle size={16} />
              <div>Removing the password means anyone with access to this device can view your financial data.</div>
            </div>
            <div className="form-group">
              <label className="form-label">Current Password (to confirm)</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showCurrent ? 'text' : 'password'} placeholder="Enter current password"
                  value={current} onChange={(e) => { setCurrent(e.target.value); setError(''); }}
                  style={{ paddingRight: '2.75rem' }} />
                <button type="button" onClick={() => setShowCurrent((v) => !v)}
                  style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <div className="alert alert-danger"><AlertCircle size={14} /> {error}</div>}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-ghost" onClick={() => setMode('status')}>Cancel</button>
              <button className="btn btn-danger w-full" onClick={handleDisable} disabled={loading || !current}>
                <LockOpen size={16} /> Remove Protection
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
