import { NextResponse } from 'next/server';
import { fetchCryptoPrices, fetchMutualFundNav, fetchStockPrice, type PriceResult } from '@/lib/server/prices';

export const runtime = 'nodejs';

interface HoldingReq {
  id: string;
  type: string;
  symbol?: string;
}

// POST { holdings: [{ id, type, symbol }] } → { prices: PriceResult[] }
// Dispatches each holding to the right live-price source by type, batching
// crypto ids into one CoinGecko call.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const holdings: HoldingReq[] = Array.isArray(body?.holdings) ? body.holdings : [];
    const now = () => new Date().toISOString();
    const results: PriceResult[] = [];

    // Batch crypto ids
    const cryptoHoldings = holdings.filter((h) => h.type === 'crypto' && h.symbol);
    const cryptoPrices = cryptoHoldings.length
      ? await fetchCryptoPrices([...new Set(cryptoHoldings.map((h) => h.symbol!.trim().toLowerCase()))])
      : {};

    for (const h of holdings) {
      const symbol = h.symbol?.trim();
      if (!symbol) {
        results.push({ id: h.id, unitPrice: 0, source: 'manual', status: 'unavailable', updatedAt: now(), note: 'No symbol set' });
        continue;
      }
      if (h.type === 'crypto') {
        const price = cryptoPrices[symbol.toLowerCase()];
        results.push(typeof price === 'number'
          ? { id: h.id, unitPrice: price, source: 'crypto', status: 'ok', updatedAt: now() }
          : { id: h.id, unitPrice: 0, source: 'crypto', status: 'unavailable', updatedAt: now(), note: 'Unknown CoinGecko id' });
      } else if (h.type === 'mutual_fund') {
        const nav = await fetchMutualFundNav(symbol);
        results.push(nav
          ? { id: h.id, unitPrice: nav.nav, source: 'mf', status: 'ok', updatedAt: now(), note: `NAV ${nav.date}` }
          : { id: h.id, unitPrice: 0, source: 'mf', status: 'unavailable', updatedAt: now(), note: 'Unknown scheme code' });
      } else if (h.type === 'stock') {
        const price = await fetchStockPrice(symbol);
        results.push(typeof price === 'number'
          ? { id: h.id, unitPrice: price, source: 'stock', status: 'ok', updatedAt: now() }
          : { id: h.id, unitPrice: 0, source: 'stock', status: 'unavailable', updatedAt: now(), note: 'No live stock source configured' });
      } else {
        results.push({ id: h.id, unitPrice: 0, source: 'manual', status: 'unavailable', updatedAt: now(), note: 'No live source for this asset type' });
      }
    }

    return NextResponse.json({ prices: results });
  } catch (error) {
    console.error('Price fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 });
  }
}
