import './guard';
import { resolveStockKey } from './env';

// Live price services. Crypto (CoinGecko) and Indian mutual funds (mfapi.in /
// AMFI) are free and need no key. Indian stocks have no reliable free real-time
// source, so the stock adapter only returns a price when a data source is
// configured — otherwise it reports "unavailable" and the UI keeps the holding
// manual. We never fabricate a stock price.

export type PriceStatus = 'ok' | 'unavailable';
export interface PriceResult {
  id: string;            // the holding id (echoed back so the client can match)
  unitPrice: number;     // per coin / NAV per unit / per share, in INR
  source: 'crypto' | 'mf' | 'stock' | 'manual';
  status: PriceStatus;
  updatedAt: string;     // ISO
  note?: string;         // e.g. NAV date, or why unavailable
}

// 60s in-memory cache to avoid hammering free APIs on repeated refreshes.
const cache = new Map<string, { price: number; at: number; note?: string }>();
const TTL = 60_000;

function cached(key: string): { price: number; note?: string } | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return { price: hit.price, note: hit.note };
  return null;
}
function put(key: string, price: number, note?: string) {
  cache.set(key, { price, at: Date.now(), note });
}

// ── Crypto: CoinGecko simple price (INR). symbol = CoinGecko id, e.g. "bitcoin".
export async function fetchCryptoPrices(ids: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const need = ids.filter((id) => {
    const c = cached(`crypto:${id}`);
    if (c) { out[id] = c.price; return false; }
    return true;
  });
  if (need.length === 0) return out;
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(need.join(','))}&vs_currencies=inr`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    for (const id of need) {
      const price = data?.[id]?.inr;
      if (typeof price === 'number') { out[id] = price; put(`crypto:${id}`, price); }
    }
  } catch { /* leave missing ids unpriced */ }
  return out;
}

// ── Mutual funds: mfapi.in latest NAV. symbol = AMFI scheme code, e.g. "120503".
export async function fetchMutualFundNav(code: string): Promise<{ nav: number; date: string } | null> {
  const c = cached(`mf:${code}`);
  if (c) return { nav: c.price, date: c.note || '' };
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${encodeURIComponent(code)}/latest`, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    const latest = data?.data?.[0];
    const nav = latest ? Number(latest.nav) : NaN;
    if (!Number.isNaN(nav)) { put(`mf:${code}`, nav, latest.date); return { nav, date: latest.date }; }
  } catch { /* fall through */ }
  return null;
}

// ── Stocks: guarded. Only priced when a stock data source is configured.
// Adapter left thin so a chosen paid provider drops in here without touching
// the route or client.
export async function fetchStockPrice(symbol: string): Promise<number | null> {
  const key = resolveStockKey();
  if (!key) return null; // no source configured → unavailable, stays manual
  // Placeholder for a concrete provider once a key/source is chosen.
  // Intentionally returns null until wired to a real API, so we never guess.
  void symbol;
  return null;
}
