'use client';
import { X, AlertTriangle, Type } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/* ─── ConfirmModal ───────────────────────────────── */
interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal animate-slide"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '0.5rem 0 1rem' }}>
          <div style={{
            width: 52, height: 52,
            borderRadius: '50%',
            background: danger ? 'var(--red-glow)' : 'var(--blue-glow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={24} color={danger ? 'var(--red)' : 'var(--blue)'} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3 className="modal-title" style={{ marginBottom: '0.5rem' }}>{title}</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>{message}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button className="btn btn-ghost w-full" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`btn w-full ${danger ? 'btn-danger' : 'btn-primary'}`}
            style={danger ? { background: 'var(--red)', color: 'white' } : {}}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── InputModal ─────────────────────────────────── */
interface InputModalProps {
  isOpen: boolean;
  title?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function InputModal({
  isOpen,
  title = 'Enter a name',
  label = 'Name',
  placeholder = '',
  confirmLabel = 'Add',
  onConfirm,
  onCancel,
}: InputModalProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && value.trim()) onConfirm(value.trim());
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [isOpen, value, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal animate-slide"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Type size={18} color="var(--blue)" />
            <h3 className="modal-title">{title}</h3>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onCancel}><X size={16} /></button>
        </div>
        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label className="form-label">{label}</label>
          <input
            ref={inputRef}
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button className="btn btn-ghost w-full" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary w-full"
            disabled={!value.trim()}
            onClick={() => onConfirm(value.trim())}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
