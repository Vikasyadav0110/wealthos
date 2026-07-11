'use client';
import { useState, useEffect, useCallback } from 'react';
import { getProfile } from '@/lib/storage';
import type { NewsArticle } from '@/types';
import { RefreshCw, ExternalLink, Bookmark, Search } from 'lucide-react';

const CATEGORIES = [
  { id: 'markets', label: '🇮🇳 Indian Markets', q: 'Nifty Sensex BSE NSE stock market india' },
  { id: 'mf', label: '💼 Mutual Funds', q: 'mutual fund SIP india NAV AMFI SEBI' },
  { id: 'economy', label: '🏦 Economy', q: 'RBI india economy inflation interest rate budget' },
  { id: 'gold', label: '🥇 Gold & Commodities', q: 'gold price india commodity crude oil' },
  { id: 'personal', label: '💡 Personal Finance', q: 'personal finance saving investment tips india tax' },
];

const BULLISH = ['rise', 'gain', 'up', 'surge', 'rally', 'high', 'record', 'growth', 'bull', 'positive', 'profit'];
const BEARISH = ['fall', 'drop', 'down', 'crash', 'loss', 'bear', 'weak', 'decline', 'negative', 'sell-off', 'low'];

function getSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
  const t = text.toLowerCase();
  const b = BULLISH.filter((w) => t.includes(w)).length;
  const br = BEARISH.filter((w) => t.includes(w)).length;
  if (b > br) return 'bullish';
  if (br > b) return 'bearish';
  return 'neutral';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Demo articles categorized when no API key
const DEMO_ARTICLES: (NewsArticle & { category: string })[] = [
  // Markets
  { title: 'Nifty 50 hits all-time high of 24,500 as FII inflows surge', description: 'Foreign institutional investors poured in ₹12,000 crore in Indian markets this week, pushing benchmark indices to record levels.', url: '#', source: 'Economic Times', publishedAt: new Date(Date.now() - 3600000).toISOString(), sentiment: 'bullish', category: 'markets' },
  { title: 'SEBI tightens F&O rules: Weekly options on limited indices only', description: 'Market regulator SEBI has announced new regulations to curb excessive speculation in F&O segment.', url: '#', source: 'SEBI', publishedAt: new Date(Date.now() - 18000000).toISOString(), sentiment: 'neutral', category: 'markets' },
  { title: 'IT Stocks rally: Infosys and TCS lead gains after strong Q1 earnings report', description: 'Major IT firms reporting better than expected margins triggers strong short covering in tech indices.', url: '#', source: 'CNBC-TV18', publishedAt: new Date(Date.now() - 25200000).toISOString(), sentiment: 'bullish', category: 'markets' },
  // Mutual Funds
  { title: 'SBI Mutual Fund launches new flexi-cap scheme with ₹5,000 min SIP', description: 'SBI MF has launched a new open-ended flexi-cap fund targeting long-term capital appreciation.', url: '#', source: 'Moneycontrol', publishedAt: new Date(Date.now() - 7200000).toISOString(), sentiment: 'neutral', category: 'mf' },
  { title: 'HDFC Midcap fund delivers 28% return in last 12 months', description: 'HDFC Mutual Fund\'s midcap scheme has outperformed the benchmark by 8% this year.', url: '#', source: 'Value Research', publishedAt: new Date(Date.now() - 21600000).toISOString(), sentiment: 'bullish', category: 'mf' },
  { title: 'Index Funds vs Active Funds: What Indian retail investors are choosing in 2026', description: 'A shift in investment behavior as low-cost index tracking passive funds gain popularity in metro cities.', url: '#', source: 'Mint', publishedAt: new Date(Date.now() - 28800000).toISOString(), sentiment: 'neutral', category: 'mf' },
  // Economy
  { title: 'RBI holds repo rate at 6.5% for fourth consecutive time', description: 'The Reserve Bank of India kept benchmark interest rates unchanged, maintaining an accommodative stance.', url: '#', source: 'Business Standard', publishedAt: new Date(Date.now() - 10800000).toISOString(), sentiment: 'neutral', category: 'economy' },
  { title: 'India GST collections rise 12% YoY in June, touching ₹1.74 lakh crore', description: 'Healthy tax collections signal steady consumer demand and robust domestic economic activity.', url: '#', source: 'Financial Express', publishedAt: new Date(Date.now() - 32400000).toISOString(), sentiment: 'bullish', category: 'economy' },
  { title: 'Inflation cools down to 4.3% bringing relief to retail consumers', description: 'Falling food prices and stable fuel costs keep the Consumer Price Index within RBI tolerance band.', url: '#', source: 'The Hindu', publishedAt: new Date(Date.now() - 36000000).toISOString(), sentiment: 'bullish', category: 'economy' },
  // Gold & Commodities
  { title: 'Gold prices dip 0.8% on strong dollar, down to ₹61,200 per 10g', description: 'International gold prices fell as the US dollar strengthened on positive economic data.', url: '#', source: 'Live Mint', publishedAt: new Date(Date.now() - 14400000).toISOString(), sentiment: 'bearish', category: 'gold' },
  { title: 'Silver surges to 2-year high amid heavy industrial demand', description: 'Increased solar panel manufacturing and electronics consumption boost commodity prices worldwide.', url: '#', source: 'Reuters', publishedAt: new Date(Date.now() - 39600000).toISOString(), sentiment: 'bullish', category: 'gold' },
  { title: 'Crude oil drops below $78 per barrel as global manufacturing slows', description: 'Concerns over inventory levels and slowing economic output from key consuming nations weigh down oil.', url: '#', source: 'Bloomberg', publishedAt: new Date(Date.now() - 43200000).toISOString(), sentiment: 'bearish', category: 'gold' },
  // Personal Finance
  { title: 'New vs Old Tax Regime: Which one saves you more money under updated rules?', description: 'A detailed breakdown of tax brackets, deductions, and calculators to optimize your annual filing.', url: '#', source: 'ET Wealth', publishedAt: new Date(Date.now() - 46800000).toISOString(), sentiment: 'neutral', category: 'personal' },
  { title: '5 golden rules of building a robust emergency fund for Indian professionals', description: 'Experts recommend keeping at least 6 months of living expenses in highly liquid options.', url: '#', source: 'Deccan Herald', publishedAt: new Date(Date.now() - 50400000).toISOString(), sentiment: 'neutral', category: 'personal' },
  { title: 'PPF interest rate remains locked at 7.1% for the upcoming quarter', description: 'Government keeps interest rates for small saving schemes unchanged despite rising bond yields.', url: '#', source: 'LiveMint', publishedAt: new Date(Date.now() - 54000000).toISOString(), sentiment: 'neutral', category: 'personal' },
];

export default function NewsPage() {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [hasApiKey, setHasApiKey] = useState(false);

  const fetchNews = useCallback(async (q?: string) => {
    const p = getProfile();
    if (!p?.newsApiKey) {
      // Demo mode: Filter DEMO_ARTICLES locally by active category or search query
      if (q && q.trim()) {
        const queryLower = q.toLowerCase();
        const filtered = DEMO_ARTICLES.filter(
          (art) =>
            art.title.toLowerCase().includes(queryLower) ||
            art.description.toLowerCase().includes(queryLower)
        );
        setArticles(filtered);
      } else {
        const filtered = DEMO_ARTICLES.filter((art) => art.category === category.id);
        setArticles(filtered);
      }
      return;
    }
    setLoading(true); setError('');
    try {
      const query = q || category.q;
      const res = await fetch(`/api/news?q=${encodeURIComponent(query)}&apiKey=${p.newsApiKey}`);
      const data = await res.json();
      if (data.error) { setError(data.error); setArticles(DEMO_ARTICLES.filter((art) => art.category === category.id)); return; }
      const enriched: NewsArticle[] = (data.articles || []).map((a: { title: string; description: string; url: string; source: { name: string }; publishedAt: string }) => ({
        title: a.title, description: a.description, url: a.url,
        source: a.source?.name || '', publishedAt: a.publishedAt,
        sentiment: getSentiment(`${a.title} ${a.description}`),
      }));
      setArticles(enriched.length ? enriched : DEMO_ARTICLES.filter((art) => art.category === category.id));
    } catch { setError('Failed to fetch news. Showing demo data.'); setArticles(DEMO_ARTICLES.filter((art) => art.category === category.id)); }
    finally { setLoading(false); }
  }, [category]);

  useEffect(() => {
    const p = getProfile();
    setHasApiKey(!!p?.newsApiKey);
    const bm = localStorage.getItem('wealthos_bookmarks');
    if (bm) setBookmarks(JSON.parse(bm));
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);


  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); if (search.trim()) fetchNews(search); };

  const toggleBM = (url: string) => {
    setBookmarks((prev) => {
      const next = prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url];
      localStorage.setItem('wealthos_bookmarks', JSON.stringify(next));
      return next;
    });
  };

  const sentimentBadge = (s?: string) => {
    if (s === 'bullish') return <span className="badge badge-green">📈 Bullish</span>;
    if (s === 'bearish') return <span className="badge badge-red">📉 Bearish</span>;
    return <span className="badge badge-gray">➡️ Neutral</span>;
  };

  return (
    <div className="animate-fade">
      <div className="section-header">
        <div>
          <h1>Market News</h1>
          <div className="section-sub">Latest financial headlines to keep you informed</div>
        </div>
        <button className="btn btn-ghost" onClick={() => fetchNews()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-pulse' : ''} /> Refresh
        </button>
      </div>

      {!hasApiKey && (
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          💡 Showing demo news. Add your free NewsAPI key in <a href="/settings" style={{ color: 'var(--blue-light)', fontWeight: 600 }}>Settings</a> for live headlines.
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" placeholder="Search news (e.g. HDFC, Nifty, SBI...)" value={search}
            onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '2.5rem' }} />
        </div>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {/* Category Tabs */}
      <div className="tabs" style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
        {CATEGORIES.map((cat) => (
          <button key={cat.id} className={`tab-btn ${category.id === cat.id ? 'active' : ''}`}
            onClick={() => { setCategory(cat); setSearch(''); }}>{cat.label}</button>
        ))}
      </div>

      {error && <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* News Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {articles.map((article, i) => (
            <div key={i} className="news-card" onClick={() => article.url !== '#' && window.open(article.url, '_blank', 'noopener,noreferrer')}>
              <div className="news-meta">
                <span className="news-source">{article.source}</span>
                <span className="news-time">{timeAgo(article.publishedAt)}</span>
                {sentimentBadge(article.sentiment)}
              </div>
              <div className="news-title">{article.title}</div>
              {article.description && <div className="news-desc">{article.description?.slice(0, 120)}...</div>}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                {article.url !== '#' && (
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                    <ExternalLink size={12} /> Read
                  </a>
                )}
                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); toggleBM(article.url); }} style={{ fontSize: '0.75rem', color: bookmarks.includes(article.url) ? 'var(--gold)' : '' }}>
                  <Bookmark size={12} fill={bookmarks.includes(article.url) ? 'var(--gold)' : 'none'} />
                  {bookmarks.includes(article.url) ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
