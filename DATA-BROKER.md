# Live stock & Nifty data — Groww API setup

WealthOS gets **real-time NSE/BSE stock prices and the Nifty 50 index** from the
**official Groww trading API**. Crypto (CoinGecko) and mutual-fund NAV
(mfapi/AMFI) already work with no key. This guide covers only stocks + indices,
which require a paid Groww API subscription.

> **Reality check (read before subscribing):**
> - Groww API costs **~₹499 + tax / month**.
> - It needs a **broker access token** that **expires** — you re-generate it
>   periodically (Groww shows the exact validity in the dashboard). So live
>   stock prices are **not fully unattended**: when the token expires, stock
>   holdings quietly fall back to "manual" until you paste a fresh token.
> - Without a token, everything still works — stocks just stay manual (no fake
>   prices are ever shown).

---

## What you get once it's set up

| Data | How | Symbol you enter on a holding |
|---|---|---|
| **Individual stock price** (real-time) | Groww LTP API | the ticker, e.g. `RELIANCE` (or `NSE_RELIANCE` / `BSE_TCS` to force an exchange) |
| **Nifty 50 index level** | Groww LTP API | fetched by the app as `NSE_NIFTY` |

---

## Step-by-step setup

| # | Step | Where |
|---|------|-------|
| 1 | Have a **Groww account** | groww.in |
| 2 | Go to the **Trading API** page and **subscribe** (~₹499/mo) | https://groww.in/trade-api |
| 3 | Open **Get API Key** → generate your API key / access token | https://groww.in/trade-api/api-keys |
| 4 | Copy the **access token** | (Groww dashboard) |
| 5 | On your server, add it to `.env.local` | `GROWW_ACCESS_TOKEN=your-token-here` |
| 6 | Restart the app | `pm2 restart wealthos` (or your dev server) |
| 7 | In Portfolio → add/edit a **stock** holding → set its symbol (e.g. `RELIANCE`) and `quantity` | the app |
| 8 | Click **Refresh Prices** | current value + P&L go live 🎉 |

**When the token expires:** repeat steps 3–6 with a fresh token. (Groww's token
validity is shown in their dashboard; broker tokens are typically short-lived
for security.)

---

## How the app uses it (for reference)

The app calls Groww's official endpoint server-side (your token never reaches
the browser):

```
GET https://api.groww.in/v1/live-data/ltp?segment=CASH&exchange_symbols=NSE_RELIANCE
Headers:
  Authorization: Bearer <GROWW_ACCESS_TOKEN>
  Accept: application/json
  X-API-VERSION: 1.0
```

- **Stocks:** a holding of type `stock` with symbol `RELIANCE` → priced as
  `NSE_RELIANCE`. Enter `NSE_...`/`BSE_...` yourself to override the exchange.
- **Nifty 50:** the app fetches `NSE_NIFTY` via `GET /api/prices?index=NSE_NIFTY`.
- **No token set:** the stock/index price comes back as *unavailable*; the
  holding stays manual. Nothing is guessed.

Code: `lib/server/prices.ts` (`fetchStockPrice`, `fetchIndexLevel`),
`lib/server/env.ts` (`resolveStockKey` → reads `GROWW_ACCESS_TOKEN`),
`app/api/prices/route.ts`.

---

## Notes & caveats

- **Response shape:** Groww's LTP response is keyed by the exchange symbol; the
  adapter reads the last price defensively (`data[symbol]` /
  `data.data[symbol]` / `data.last_price`). If Groww changes the exact JSON, the
  one place to adjust is `growwLtp()` in `lib/server/prices.ts` — verify against
  a real response once you have a token.
- **Rate limits:** the app caches prices for 60s to avoid hammering the API on
  repeated refreshes. Groww's exact limits are in their docs.
- **Market hours:** live prices only move during NSE/BSE trading hours; outside
  them you get the last close.
- **Security:** the token lives only in `.env.local` on the server and is used
  server-side; it is never sent to the browser. Keep `.env.local` out of git
  (it already is).

Sources: Groww Trading API docs — https://groww.in/trade-api/docs and
https://groww.in/trade-api/docs/curl/live-data
