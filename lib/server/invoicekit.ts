import './guard';
import { resolveInvoiceKitUrl, resolveInvoiceKitToken } from './env';

// Read-only bridge to the InvoiceKit app (separate Express + MongoDB service).
// WealthOS fetches invoices server-side so the InvoiceKit JWT never reaches the
// browser and CORS is irrelevant. We never write to InvoiceKit.

export interface BridgeInvoice {
  number: string;
  clientName: string;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | string;
  total: number;
  issueDate: string | null;
}

export interface InvoiceBridgeResult {
  configured: boolean;      // false when URL/token unset OR InvoiceKit unreachable
  invoices: BridgeInvoice[];
  paidTotal: number;
  pendingTotal: number;     // pending + overdue (money owed to you)
  paidCount: number;
  pendingCount: number;
  error?: string;
}

const EMPTY: InvoiceBridgeResult = {
  configured: false, invoices: [], paidTotal: 0, pendingTotal: 0, paidCount: 0, pendingCount: 0,
};

// InvoiceKit responses vary in field naming; read defensively.
function normalize(raw: unknown): BridgeInvoice {
  const r = raw as Record<string, unknown>;
  const client = r.client as Record<string, unknown> | string | undefined;
  const clientName = typeof client === 'object' && client
    ? String(client.name ?? client.clientName ?? '')
    : (r.clientName ? String(r.clientName) : '');
  const total = Number(r.total ?? r.amount ?? r.grandTotal ?? 0) || 0;
  return {
    number: String(r.number ?? r.invoiceNumber ?? ''),
    clientName,
    status: String(r.status ?? 'draft'),
    total,
    issueDate: r.issueDate ? String(r.issueDate) : (r.date ? String(r.date) : null),
  };
}

export async function fetchInvoices(): Promise<InvoiceBridgeResult> {
  const base = resolveInvoiceKitUrl();
  const token = resolveInvoiceKitToken();
  if (!base || !token) return EMPTY; // not connected — graceful, not an error

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/invoices`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { ...EMPTY, error: `InvoiceKit responded ${res.status}` };
    const data = await res.json();
    const list: unknown[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    const invoices = list.map(normalize);

    const paid = invoices.filter((i) => i.status === 'paid');
    const owed = invoices.filter((i) => i.status === 'pending' || i.status === 'overdue');
    return {
      configured: true,
      invoices,
      paidTotal: paid.reduce((s, i) => s + i.total, 0),
      pendingTotal: owed.reduce((s, i) => s + i.total, 0),
      paidCount: paid.length,
      pendingCount: owed.length,
    };
  } catch (err) {
    return { ...EMPTY, error: err instanceof Error ? err.message : 'InvoiceKit unreachable' };
  }
}
