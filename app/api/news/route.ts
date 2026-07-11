import { NextRequest, NextResponse } from 'next/server';
import { resolveNewsKey } from '@/lib/server/env';
import { fetchNews } from '@/lib/server/news';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || 'stock market india';

  // User-supplied key wins; fall back to the server's NEWSAPI_KEY.
  const key = resolveNewsKey(searchParams.get('apiKey'));
  if (!key) {
    return NextResponse.json({ error: 'NewsAPI key not configured.' }, { status: 400 });
  }

  const result = await fetchNews(q, key);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ articles: result.articles });
}
