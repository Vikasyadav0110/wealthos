'use client';
import { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import Onboarding from '@/components/onboarding/Onboarding';
import LockScreen from '@/components/auth/LockScreen';
import { getProfile, STORAGE_ERROR_EVENT, hydrate, flush } from '@/lib/storage';
import { isAuthEnabled, isSessionExpired, updateLastActive } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useToast } from '@/components/ui/Toast';

// Inline script — runs before React hydration to avoid theme flash
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('wealthos_theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
  const { error: toastError } = useToast();
  // Sync data-theme attribute on html element with localStorage on every page
  useTheme();

  // Surface failed localStorage writes (e.g. quota exceeded) so data-loss isn't silent
  useEffect(() => {
    const onStorageError = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string }>).detail;
      toastError(detail?.message || 'Could not save your change.');
    };
    window.addEventListener(STORAGE_ERROR_EVENT, onStorageError);
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, onStorageError);
  }, [toastError]);

  const checkLock = useCallback(() => {
    if (isAuthEnabled() && isSessionExpired()) {
      setLocked(true);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await hydrate();
      const profile = getProfile();
      setOnboarded(!!profile?.onboardingComplete);

      if (isAuthEnabled() && isSessionExpired()) {
        setLocked(true);
      }
    };
    init();

    const handleActivity = () => updateLastActive();
    const EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    EVENTS.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

    const lockCheck = setInterval(checkLock, 60000);

    const handleVisibility = () => {
      if (!document.hidden) checkLock();
      else flush();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    const handleBeforeUnload = () => flush();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, handleActivity));
      clearInterval(lockCheck);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [checkLock]);

  if (onboarded === null) {
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      </>
    );
  }

  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />;
  }

  if (locked) {
    return <LockScreen onUnlock={() => { updateLastActive(); setLocked(false); }} />;
  }

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <TopBar />
          <div className="page-content">{children}</div>
        </div>
      </div>
    </>
  );
}
