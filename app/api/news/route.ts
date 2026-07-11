import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || 'stock market india';
  const apiKey = searchParams.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ error: 'NewsAPI key not configured.' }, { status: 400 });
  }

  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 900 } });
    const data = await res.json();

    if (data.status !== 'ok') {
      return NextResponse.json({ error: data.message || 'NewsAPI error' }, { status: 500 });
    }

    return NextResponse.json({ articles: data.articles });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch news';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
