import { NextResponse } from 'next/server';
import { fetchInvoices } from '@/lib/server/invoicekit';

export const runtime = 'nodejs';

// GET /api/invoices → read-only summary of the user's invoices from InvoiceKit.
// Returns { configured: false } gracefully when the bridge isn't set up or
// InvoiceKit is unreachable — the UI shows "not connected" rather than erroring.
export async function GET() {
  const result = await fetchInvoices();
  return NextResponse.json(result);
}
