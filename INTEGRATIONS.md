# Integrations — connecting WealthOS to InvoiceKit

WealthOS can surface your **invoice income** (from the separate InvoiceKit app)
on its dashboard, and links to InvoiceKit from the sidebar. This is a **read-only
link + data bridge** — the two apps stay separate; WealthOS never writes to your
invoice data.

## What you get
- Sidebar → **Business → Invoices** opens InvoiceKit in a new tab.
- Dashboard → **Invoice Income** card: total *received* (paid) and *awaiting*
  (pending/overdue), pulled live from InvoiceKit. Shows only when connected.

## How it works (why it's safe)
WealthOS calls InvoiceKit's API **from its own server** (not your browser), so:
- Your InvoiceKit login token never reaches the browser.
- CORS is irrelevant (no cross-origin browser request).
- It's read-only (`GET /api/invoices`) — no risk to invoice data.

Code: `lib/server/invoicekit.ts` (bridge), `app/api/invoices/route.ts` (WealthOS
route), `components/InvoiceIncomeCard.tsx` (dashboard card).

## Setup

InvoiceKit is a separate app (Express + MongoDB) — it must be running for the
bridge to return data.

| # | Step | How |
|---|------|-----|
| 1 | Run InvoiceKit's backend | In `invoice-app/backend`: `npm install && npm run dev` (starts on port **5001**, needs MongoDB) |
| 2 | Run InvoiceKit's frontend | Serve `invoice-app/index.html` (e.g. on port 8090) |
| 3 | Log into InvoiceKit and copy your **JWT** | It's stored in the browser as `ik_token` (DevTools → Application → Local Storage → `ik_token`) |
| 4 | Add to WealthOS `.env.local` | see below |
| 5 | Restart WealthOS | `pm2 restart wealthos` (or your dev server) |

`.env.local` (WealthOS):
```
INVOICEKIT_API_URL=http://localhost:5001     # InvoiceKit backend base URL (no /api)
INVOICEKIT_TOKEN=<your ik_token JWT>          # server-side only, never sent to the browser
NEXT_PUBLIC_INVOICEKIT_URL=http://localhost:8090   # InvoiceKit frontend, for the "Open" links
```

## Notes & caveats
- **Not connected?** If the env vars are unset or InvoiceKit is unreachable, the
  bridge returns `{ configured: false }` and the dashboard card + income simply
  don't appear — no errors.
- **Token expiry:** InvoiceKit JWTs expire; when the income card stops showing,
  re-copy `ik_token` and update `.env.local` (same pattern as the Groww token in
  `DATA-BROKER.md`).
- **Deployment:** on the EC2 plan, both apps + MongoDB must run on the box (or
  InvoiceKit reachable by URL). Point `INVOICEKIT_API_URL` at wherever
  InvoiceKit's backend lives.
- **Field mapping:** the bridge reads invoice fields defensively
  (`total`/`amount`, `status`, `client.name`). If InvoiceKit's JSON differs,
  adjust `normalize()` in `lib/server/invoicekit.ts`.

## Not included (deliberately)
This is a light link, not a merge. Deeper integration — one login across both
apps, invoices auto-posting into WealthOS's monthly cash-flow history, a unified
database — is a much larger effort and intentionally out of scope here.
