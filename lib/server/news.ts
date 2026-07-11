import './guard';

export interface NewsResult {
  articles?: unknown[];
  error?: string;
  status: number;
}

// Fetch market news from NewsAPI. Returns a plain result the route maps to a
// Response; keeps the HTTP handler thin and the fetch logic testable.
export async function fetchNews(query: string, apiKey: string): Promise<NewsResult> {
  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 900 } });
    const data = await res.json();

    if (data.status !== 'ok') {
      return { error: data.message || 'NewsAPI error', status: 500 };
    }
    return { articles: data.articles, status: 200 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch news';
    return { error: msg, status: 500 };
  }
}
