'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={16} />,
  error: <AlertCircle size={16} />,
  info: <Info size={16} />,
  warning: <AlertCircle size={16} />,
};

const COLORS: Record<ToastType, { bg: string; border: string; color: string }> = {
  success: { bg: 'rgba(5,150,105,0.1)', border: 'rgba(5,150,105,0.3)', color: 'var(--green)' },
  error:   { bg: 'rgba(225,29,72,0.1)',  border: 'rgba(225,29,72,0.3)',  color: 'var(--red)' },
  info:    { bg: 'rgba(59,110,240,0.1)', border: 'rgba(59,110,240,0.3)', color: 'var(--blue)' },
  warning: { bg: 'rgba(217,119,6,0.1)',  border: 'rgba(217,119,6,0.3)',  color: 'var(--gold)' },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const c = COLORS[toast.type];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, 3200);
    return () => clearTimeout(t);
  }, [toast.id, onRemove]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        padding: '0.75rem 1rem',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 'var(--radius-md)',
        color: c.color,
        fontSize: '0.85rem',
        fontWeight: 500,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        backdropFilter: 'blur(12px)',
        minWidth: 240,
        maxWidth: 380,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        cursor: 'default',
        userSelect: 'none',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {ICONS[toast.type]}
      <span style={{ flex: 1, color: 'var(--text-primary)' }}>{toast.message}</span>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center' }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = String(++idRef.current);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    toast: addToast,
    success: (m) => addToast(m, 'success'),
    error:   (m) => addToast(m, 'error'),
    info:    (m) => addToast(m, 'info'),
    warning: (m) => addToast(m, 'warning'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          alignItems: 'flex-end',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
