'use client';
import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/formatters';
import { FileText, ExternalLink } from 'lucide-react';

interface ClientIncome { clientName: string; total: number; count: number; }
interface Summary {
  configured: boolean;
  paidTotal: number;
  pendingTotal: number;
  pendingCount: number;
  byClient: ClientIncome[];
}

// Live, read-only "Invoice Income" income source for the salary/income page.
// Paid invoices grouped by client company, pulled from the InvoiceKit bridge.
// Shows nothing until connected — so the page is unaffected when off.
// NOT written into stored SalaryEntry data (no double-counting).
export default function InvoiceIncomeSources() {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/invoices')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { /* silent — card just won't render */ });
    return () => { cancelled = true; };
  }, []);

  if (!data?.configured || data.paidTotal <= 0) return null;

  const invoiceKitUrl = process.env.NEXT_PUBLIC_INVOICEKIT_URL || 'http://localhost:8090';
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
        <div className="section-title" style={{ fontSize: '1rem', margin: 0 }}>
          <FileText size={16} style={{ display: 'inline', marginRight: '0.5rem', color: 'var(--blue)' }} />
          Invoice Income <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>(from InvoiceKit)</span>
        </div>
        <a href={invoiceKitUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}>
          Open <ExternalLink size={13} />
        </a>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Received (paid) income by client · live, read-only · shown separately from your logged monthly income
      </div>

      {/* Total */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total received</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--green)' }}>{formatCurrency(data.paidTotal)}</div>
      </div>

      {/* Per-client breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {data.byClient.map((c, idx) => {
          const pct = data.paidTotal > 0 ? Math.round((c.total / data.paidTotal) * 100) : 0;
          const color = colors[idx % colors.length];
          return (
            <div key={c.clientName}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
                  {c.clientName} <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>· {c.count} invoice{c.count !== 1 ? 's' : ''}</span>
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(c.total)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct}%)</span></span>
              </div>
              <div style={{ height: 5, background: 'var(--track-bg)', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Expected (pending / overdue) — not counted as income */}
      {data.pendingTotal > 0 && (
        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{formatCurrency(data.pendingTotal)}</span> expected from {data.pendingCount} pending/overdue invoice{data.pendingCount !== 1 ? 's' : ''} <span style={{ color: 'var(--text-muted)' }}>· not counted as received</span>
        </div>
      )}
    </div>
  );
}
