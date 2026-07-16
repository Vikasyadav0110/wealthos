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

export interface ClientIncome {
  clientName: string;
  total: number;
  count: number;
}

export interface InvoiceBridgeResult {
  configured: boolean;      // false when URL/token unset OR InvoiceKit unreachable
  invoices: BridgeInvoice[];
  paidTotal: number;
  pendingTotal: number;     // pending + overdue (money owed to you)
  paidCount: number;
  pendingCount: number;
  byClient: ClientIncome[]; // paid income grouped by client company, biggest first
  error?: string;
}

const EMPTY: InvoiceBridgeResult = {
  configured: false, invoices: [], paidTotal: 0, pendingTotal: 0, paidCount: 0, pendingCount: 0, byClient: [],
};

interface RawItem { qty?: number; rate?: number; quantity?: number; }

// InvoiceKit invoices have NO stored `total` — the amount lives in
// items[].qty × rate, plus a `tax` percentage. Compute it here. (Falls back to
// a `total`/`amount` field if a future version adds one.)
function invoiceTotal(r: Record<string, unknown>): number {
  const stored = Number(r.total ?? r.amount ?? r.grandTotal);
  if (!Number.isNaN(stored) && stored > 0) return stored;
  const items = Array.isArray(r.items) ? (r.items as RawItem[]) : [];
  const subtotal = items.reduce((s, it) => s + (Number(it.qty ?? it.quantity ?? 0) * Number(it.rate ?? 0)), 0);
  const taxPct = Number(r.tax ?? 0) || 0;
  return Math.round(subtotal * (1 + taxPct / 100));
}

function normalize(raw: unknown): BridgeInvoice {
  const r = raw as Record<string, unknown>;
  const client = r.client as Record<string, unknown> | string | undefined;
  const clientName = typeof client === 'object' && client
    ? String(client.name ?? client.clientName ?? '')
    : (r.clientName ? String(r.clientName) : '');
  return {
    number: String(r.number ?? r.invoiceNumber ?? ''),
    clientName,
    status: String(r.status ?? 'draft'),
    total: invoiceTotal(r),
    issueDate: r.date ? String(r.date) : (r.issueDate ? String(r.issueDate) : null),
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

    // Group paid income by client company (biggest first).
    const clientMap = new Map<string, ClientIncome>();
    paid.forEach((i) => {
      const name = i.clientName || 'Unknown client';
      const existing = clientMap.get(name);
      if (existing) { existing.total += i.total; existing.count += 1; }
      else clientMap.set(name, { clientName: name, total: i.total, count: 1 });
    });
    const byClient = [...clientMap.values()].sort((a, b) => b.total - a.total);

    return {
      configured: true,
      invoices,
      paidTotal: paid.reduce((s, i) => s + i.total, 0),
      pendingTotal: owed.reduce((s, i) => s + i.total, 0),
      paidCount: paid.length,
      pendingCount: owed.length,
      byClient,
    };
  } catch (err) {
    return { ...EMPTY, error: err instanceof Error ? err.message : 'InvoiceKit unreachable' };
  }
}
