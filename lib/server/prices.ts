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

// ── Stocks & indices: Groww trading API (official, real-time NSE/BSE).
// Only priced when GROWW_ACCESS_TOKEN is configured; otherwise returns null
// (holding stays manual — we never fake a price). Docs:
//   GET https://api.groww.in/v1/live-data/ltp
//   headers: Authorization: Bearer <token>, Accept: application/json, X-API-VERSION: 1.0
//   query:   segment=CASH, exchange_symbols=NSE_<SYMBOL>  (e.g. NSE_RELIANCE, NSE_NIFTY)
const GROWW_BASE = 'https://api.groww.in/v1/live-data';

async function growwLtp(exchangeSymbol: string): Promise<number | null> {
  const token = resolveStockKey();
  if (!token) return null; // no broker token configured → unavailable, stays manual
  const cacheKey = `groww:${exchangeSymbol}`;
  const c = cached(cacheKey);
  if (c) return c.price;
  try {
    const url = `${GROWW_BASE}/ltp?segment=CASH&exchange_symbols=${encodeURIComponent(exchangeSymbol)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'X-API-VERSION': '1.0',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // LTP response is keyed by the exchange symbol; value is the last price.
    const raw = data?.[exchangeSymbol] ?? data?.data?.[exchangeSymbol] ?? data?.last_price;
    const price = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isNaN(price) && price > 0) { put(cacheKey, price); return price; }
  } catch { /* fall through to null */ }
  return null;
}

// A stock holding's symbol is the bare ticker (e.g. "RELIANCE"); we prefix the
// exchange. Users can also enter a full "NSE_RELIANCE"/"BSE_TCS" to override.
export async function fetchStockPrice(symbol: string): Promise<number | null> {
  const s = symbol.trim().toUpperCase();
  const exchangeSymbol = s.includes('_') ? s : `NSE_${s}`;
  return growwLtp(exchangeSymbol);
}

// Nifty 50 (and other indices) — same LTP endpoint with the index symbol,
// e.g. NSE_NIFTY. Returns { level } or null when no token / unavailable.
export async function fetchIndexLevel(exchangeSymbol: string): Promise<number | null> {
  return growwLtp(exchangeSymbol.trim().toUpperCase());
}
