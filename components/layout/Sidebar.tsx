'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Wallet, TrendingUp, PieChart,
  Newspaper, Bot, Settings, Zap, Compass, ReceiptText, Tag,
  Target, Percent, Coins, Route, FileText, ExternalLink
} from 'lucide-react';

const NAV = [
  { section: 'Overview', items: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { section: 'Cash Flow', items: [
    { href: '/salary', label: 'Income Tracker', icon: Wallet },
    { href: '/expenses', label: 'Daily Expenses', icon: ReceiptText },
  ]},
  { section: 'Wealth & Goals', items: [
    { href: '/plan', label: 'Financial Plan', icon: Route },
    { href: '/portfolio', label: 'My Portfolio', icon: PieChart },
    { href: '/goals', label: 'Goals Tracker', icon: Target },
  ]},
  { section: 'Calculators', items: [
    { href: '/compound', label: 'Growth Calculator', icon: TrendingUp },
    { href: '/loans', label: 'Loan Calculator', icon: Percent },
  ]},
  { section: 'Intelligence & Tax', items: [
    { href: '/tax', label: 'Tax Planner', icon: Coins },
    { href: '/guidance', label: 'Investment Guide', icon: Compass },
    { href: '/advisor', label: 'AI Advisor', icon: Bot },
  ]},
  { section: 'Markets', items: [
    { href: '/news', label: 'Market News', icon: Newspaper },
  ]},
  { section: 'System & Config', items: [
    { href: '/categories', label: 'Category Manager', icon: Tag },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Zap size={20} color="white" />
        </div>
        <div>
          <div className="sidebar-logo-text">WealthOS</div>
          <div className="sidebar-logo-sub">Financial Command Center</div>
        </div>
      </div>

      <div className="sidebar-nav">
        {NAV.map((section) => (
          <div key={section.section}>
            <div className="nav-section-label">{section.section}</div>
            {section.items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`nav-item ${pathname === href ? 'active' : ''}`}
              >
                <Icon className="nav-icon" size={18} />
                {label}
              </Link>
            ))}
          </div>
        ))}
        {/* External: InvoiceKit (separate app) */}
        <div>
          <div className="nav-section-label">Business</div>
          <a
            href={process.env.NEXT_PUBLIC_INVOICEKIT_URL || 'http://localhost:8090'}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-item"
          >
            <FileText className="nav-icon" size={18} />
            Invoices
            <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
          </a>
        </div>
      </div>

      <div className="sidebar-footer">
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
          All data stored locally<br />on your device 🔒
        </div>
      </div>
    </nav>
  );
}
