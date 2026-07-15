'use client';
import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/formatters';
import { FileText, ExternalLink } from 'lucide-react';

interface InvoiceSummary {
  configured: boolean;
  paidTotal: number;
  pendingTotal: number;
  paidCount: number;
  pendingCount: number;
}

// Read-only card that surfaces invoice income from the InvoiceKit bridge.
// Renders nothing until we know the bridge is configured, so the dashboard is
// unaffected for users who haven't connected InvoiceKit.
export default function InvoiceIncomeCard() {
  const [data, setData] = useState<InvoiceSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/invoices')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { /* silent — card just won't render */ });
    return () => { cancelled = true; };
  }, []);

  // Only show when the bridge is connected and returned data.
  if (!data?.configured) return null;

  const invoiceKitUrl = process.env.NEXT_PUBLIC_INVOICEKIT_URL || 'http://localhost:8090';

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div className="section-title" style={{ fontSize: '1rem', margin: 0 }}>
          <FileText size={16} style={{ display: 'inline', marginRight: '0.5rem', color: 'var(--blue)' }} />
          Invoice Income
        </div>
        <a href={invoiceKitUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}>
          Open InvoiceKit <ExternalLink size={13} />
        </a>
      </div>
      <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Received (paid)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--green)' }}>{formatCurrency(data.paidTotal)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{data.paidCount} invoice{data.paidCount !== 1 ? 's' : ''}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Awaiting (pending / overdue)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gold)' }}>{formatCurrency(data.pendingTotal)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{data.pendingCount} invoice{data.pendingCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
        Live from InvoiceKit · read-only
      </div>
    </div>
  );
}
