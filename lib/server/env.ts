import './guard';

// Server-side API keys, read from the environment (.env.local, deployment env).
// A key supplied by the user from the browser always takes precedence; these
// are the fallback so the app can work out-of-the-box when they're configured.

function envKey(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

// Resolve the key to use: the caller-supplied (user) key wins, else the env fallback.
export function resolveAnthropicKey(userKey?: string | null): string | undefined {
  return (userKey && userKey.trim()) || envKey('ANTHROPIC_API_KEY');
}

export function resolveNewsKey(userKey?: string | null): string | undefined {
  return (userKey && userKey.trim()) || envKey('NEWSAPI_KEY');
}

// Optional stock-market data key. When unset, stock holdings stay manual (no
// free/reliable real-time NSE/BSE source), and the price service reports them
// as unavailable rather than guessing.
export function resolveStockKey(userKey?: string | null): string | undefined {
  return (userKey && userKey.trim()) || envKey('STOCK_API_KEY');
}
