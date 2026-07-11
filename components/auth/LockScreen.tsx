'use client';
import { useState, useEffect, useRef } from 'react';
import { verifyPassword, getPasswordHash, updateLastActive, getAuthEmail } from '@/lib/auth';
import { getProfile } from '@/lib/storage';
import { Zap, Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Mail } from 'lucide-react';

interface Props {
  onUnlock: () => void;
}

export default function LockScreen({ onUnlock }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [profileName, setProfileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = getProfile();
    if (p?.name) setProfileName(p.name);
    // Autofill stored auth email if available
    const storedEmail = getAuthEmail();
    if (storedEmail) setEmail(storedEmail);
    inputRef.current?.focus();
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) { setLockedUntil(null); setAttempts(0); setTimeLeft(0); }
      else setTimeLeft(remaining);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedUntil) return;
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setError('');

    try {
      const correctEmail = getAuthEmail();
      const hash = getPasswordHash();
      if (!hash) { onUnlock(); return; }

      const emailMatches = email.trim().toLowerCase() === correctEmail.toLowerCase();
      const passwordMatches = await verifyPassword(password, hash);

      if (emailMatches && passwordMatches) {
        updateLastActive();
        onUnlock();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setPassword('');

        if (newAttempts >= 5) {
          // Lock for 30 seconds after 5 failed attempts
          setLockedUntil(Date.now() + 30000);
          setError('Too many failed attempts. Locked for 30 seconds.');
        } else {
          setError(`Incorrect email or password. ${5 - newAttempts} attempt${5 - newAttempts !== 1 ? 's' : ''} remaining.`);
        }
        inputRef.current?.focus();
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return '☀️ Good morning';
    if (h < 17) return '🌤️ Good afternoon';
    return '🌙 Good evening';
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `
        radial-gradient(ellipse at 15% 50%, rgba(59,130,246,0.12) 0%, transparent 55%),
        radial-gradient(ellipse at 85% 30%, rgba(139,92,246,0.1) 0%, transparent 55%),
        radial-gradient(ellipse at 50% 80%, rgba(245,158,11,0.06) 0%, transparent 55%),
        #080d1a
      `,
      padding: '1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient orbs */}
      <div style={{ position: 'absolute', top: '20%', left: '10%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(59,130,246,0.04)', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: 250, height: 250, borderRadius: '50%', background: 'rgba(139,92,246,0.05)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{
        background: 'rgba(14, 21, 40, 0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24,
        padding: '2.5rem',
        width: '100%',
        maxWidth: 420,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.1)',
        animation: 'slideUp 0.4s ease',
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 64, height: 64,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 30px rgba(59,130,246,0.35)',
            marginBottom: '1rem',
          }}>
            <Zap size={30} color="white" />
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#f0f4ff' }}>WealthOS</div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            {greeting()}{profileName ? `, ${profileName}` : ''}
          </div>
        </div>

        {/* Lock icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: 56, height: 56,
            borderRadius: '50%',
            background: lockedUntil ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
            border: `2px solid ${lockedUntil ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {lockedUntil ? <AlertCircle size={24} color="#ef4444" /> : <Lock size={24} color="#3b82f6" />}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: 600, color: '#f0f4ff', marginBottom: '0.35rem' }}>
            {lockedUntil ? 'Account Locked' : 'Sign in to WealthOS'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            {lockedUntil
              ? `Try again in ${timeLeft} second${timeLeft !== 1 ? 's' : ''}`
              : 'Please enter your login details'}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleUnlock}>
          {/* Email Field */}
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              disabled={!!lockedUntil || loading}
              autoComplete="email"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10,
                color: '#f0f4ff',
                fontSize: '1rem',
                fontFamily: 'Inter, sans-serif',
                padding: '0.875rem 1rem 0.875rem 3rem',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; }}
              onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
            <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>

          {/* Password Field */}
          <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              disabled={!!lockedUntil || loading}
              autoComplete="current-password"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10,
                color: '#f0f4ff',
                fontSize: '1rem',
                fontFamily: 'Inter, sans-serif',
                padding: '0.875rem 3rem 0.875rem 3rem',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                letterSpacing: showPassword ? 'normal' : '0.15em',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; }}
              onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
            <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 4 }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '0.65rem 0.875rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#ef4444', animation: 'fadeIn 0.2s ease' }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Attempts indicator */}
          {attempts > 0 && attempts < 5 && !lockedUntil && (
            <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', marginBottom: '1rem' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < attempts ? '#ef4444' : 'rgba(255,255,255,0.1)', transition: 'background 0.2s' }} />
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={!!lockedUntil || loading || !email.trim() || !password.trim()}
            style={{
              width: '100%',
              background: lockedUntil ? 'rgba(239,68,68,0.2)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              border: 'none',
              borderRadius: 10,
              color: 'white',
              fontSize: '0.95rem',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              padding: '0.875rem',
              cursor: lockedUntil || loading || !email.trim() || !password.trim() ? 'not-allowed' : 'pointer',
              opacity: lockedUntil || !email.trim() || !password.trim() ? 0.5 : 1,
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              boxShadow: lockedUntil ? 'none' : '0 4px 15px rgba(59,130,246,0.3)',
            }}
            onMouseEnter={(e) => { if (!lockedUntil && email.trim() && password.trim()) e.currentTarget.style.boxShadow = '0 6px 25px rgba(59,130,246,0.45)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = lockedUntil ? 'none' : '0 4px 15px rgba(59,130,246,0.3)'; }}
          >
            {loading ? (
              <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Verifying...</>
            ) : lockedUntil ? (
              <><AlertCircle size={18} /> Locked ({timeLeft}s)</>
            ) : (
              <><ShieldCheck size={18} /> Unlock WealthOS</>
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.72rem', color: '#4a5568', lineHeight: 1.5 }}>
          🔒 Your data is stored locally on this device.<br />No cloud, no tracking.
        </div>
      </div>
    </div>
  );
}
