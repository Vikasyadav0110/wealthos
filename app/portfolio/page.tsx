'use client';
import { useState, useEffect } from 'react';
import { getInvestments, saveInvestment, deleteInvestment, getCustomInvestments, saveCustomInvestments, getProfile, getGoals } from '@/lib/storage';
import { formatCurrency, formatPercent, formatDate, generateId } from '@/lib/formatters';
import { rebalancePlan } from '@/lib/planning';
import type { Investment, UserProfile, Goal } from '@/types';
import { Plus, Trash2, Edit2, X, Download, Printer, Filter, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ConfirmModal, InputModal } from '@/components/ui/Dialogs';
import { useToast } from '@/components/ui/Toast';

const EMPTY: Omit<Investment, 'id' | 'lastUpdated' | 'startDate'> = {
  name: '', type: 'mutual_fund', investedAmount: 0, currentValue: 0,
  quantity: undefined, buyPrice: undefined, sipAmount: undefined, dividends: 0, notes: '', goalId: '',
  interestRate: undefined, withdrawnAmount: 0, symbol: '',
};

export default function PortfolioPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY, startDate: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [assetTypes, setAssetTypes] = useState<{ id: string; label: string; color: string; icon: string }[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showTypeInput, setShowTypeInput] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { success, warning, info } = useToast();

  const reload = () => {
    setInvestments(getInvestments());
    setProfile(getProfile());
    setGoals(getGoals());
    const custom = getCustomInvestments();
    const compiled = custom.map(c => ({
      id: c.id,
      label: c.label.split(' ').slice(1).join(' '),
      color: c.color,
      icon: c.label.split(' ')[0] || '🏷️'
    }));
    setAssetTypes(compiled);
  };

  useEffect(() => { reload(); }, []);

  const getAssetType = (typeId: string) => {
    return assetTypes.find(t => t.id === typeId) || { id: 'other', label: 'Other Asset', color: '#94a3b8', icon: '🏷️' };
  };

  const handleAssetTypeChange = (val: string) => {
    if (val === '+custom') {
      setShowTypeInput(true);
    } else {
      upd('type', val);
    }
  };

  const handleTypeConfirm = (name: string) => {
    const slug = 'custom_' + Date.now();
    const newType = { id: slug, label: `🏷️ ${name}`, color: '#fbbf24' };
    const list = getCustomInvestments();
    list.push(newType);
    saveCustomInvestments(list);
    setAssetTypes(list.map(c => ({
      id: c.id,
      label: c.label.split(' ').slice(1).join(' '),
      color: c.color,
      icon: c.label.split(' ')[0] || '🏷️'
    })));
    upd('type', slug);
    setShowTypeInput(false);
  };

  const upd = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const openAdd = () => { setForm({ ...EMPTY, startDate: new Date().toISOString().split('T')[0] }); setEditId(null); setShowModal(true); };
  const openEdit = (inv: Investment) => {
    setForm({ name: inv.name, type: inv.type, investedAmount: inv.investedAmount, currentValue: inv.currentValue, quantity: inv.quantity, buyPrice: inv.buyPrice, sipAmount: inv.sipAmount, dividends: inv.dividends || 0, notes: inv.notes || '', goalId: inv.goalId || '', interestRate: inv.interestRate, withdrawnAmount: inv.withdrawnAmount || 0, symbol: inv.symbol || '', startDate: inv.startDate });
    setEditId(inv.id); setShowModal(true);
  };
  const save = () => {
    const inv: Investment = { ...(form as Investment), id: editId || generateId(), lastUpdated: new Date().toISOString() };
    saveInvestment(inv); reload(); setShowModal(false);
    success(editId ? 'Investment updated!' : 'Investment added!');
  };
  const del = (id: string) => setConfirmDeleteId(id);
  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    deleteInvestment(confirmDeleteId);
    reload();
    setConfirmDeleteId(null);
    success('Investment removed');
  };

  // Fetch live prices for holdings that have a market symbol and update their
  // current value (unit price × quantity). Holdings without a symbol, or whose
  // source is unavailable (e.g. stocks with no data source), are left as-is.
  const refreshPrices = async () => {
    const priced = investments.filter((i) => i.symbol && i.symbol.trim());
    if (priced.length === 0) {
      info('Add a CoinGecko id / AMFI code / symbol to a holding to enable live prices.');
      return;
    }
    setRefreshing(true);
    try {
      const res = await fetch('/api/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdings: priced.map((i) => ({ id: i.id, type: i.type, symbol: i.symbol })) }),
      });
      const data = await res.json();
      const results: { id: string; unitPrice: number; status: string; updatedAt: string }[] = data.prices || [];
      let updated = 0, failed = 0;
      results.forEach((r) => {
        const inv = investments.find((i) => i.id === r.id);
        if (!inv) return;
        if (r.status === 'ok' && r.unitPrice > 0) {
          const units = inv.quantity && inv.quantity > 0 ? inv.quantity : 1;
          saveInvestment({ ...inv, currentValue: Math.round(r.unitPrice * units), livePrice: r.unitPrice, priceUpdatedAt: r.updatedAt, lastUpdated: r.updatedAt });
          updated++;
        } else {
          failed++;
        }
      });
      reload();
      if (updated > 0) success(`Updated ${updated} holding${updated !== 1 ? 's' : ''} with live prices${failed ? ` · ${failed} unavailable` : ''}`);
      else warning('No prices could be fetched — check your symbols, or the asset has no live source.');
    } catch {
      warning('Could not reach the price service. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Investment Name', 'Type', 'Invested Amount (INR)', 'Current Value (INR)', 'Gain/Loss (INR)', 'Start Date'];
    const rows = filtered.map((i) => [
      i.name,
      getAssetType(i.type).label,
      i.investedAmount,
      i.currentValue,
      i.currentValue - i.investedAmount,
      i.startDate
    ]);
    const content = [headers, ...rows].map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wealthos_portfolio_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHtml = filtered.map((i) => `
      <tr>
        <td>${i.name}</td>
        <td>${getAssetType(i.type).label}</td>
        <td style="text-align: right;">INR ${i.investedAmount.toLocaleString('en-IN')}</td>
        <td style="text-align: right;">INR ${i.currentValue.toLocaleString('en-IN')}</td>
        <td style="text-align: right; color: ${i.currentValue - i.investedAmount >= 0 ? '#10b981' : '#ef4444'};">
          INR ${(i.currentValue - i.investedAmount).toLocaleString('en-IN')}
        </td>
        <td>${i.startDate}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>WealthOS - Portfolio Report</title>
          <style>
            body { font-family: sans-serif; padding: 2rem; color: #1e293b; }
            h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
            .meta { font-size: 0.85rem; color: #64748b; margin-bottom: 2rem; }
            table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 0.75rem 1rem; text-align: left; font-size: 0.85rem; }
            th { background: #f8fafc; color: #475569; font-weight: 600; text-transform: uppercase; font-size: 0.7rem; }
            .total-row { font-weight: 700; font-size: 1rem; background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>Portfolio Investment Report</h1>
          <div class="meta">Generated on ${new Date().toLocaleDateString('en-IN')} · ${filtered.length} Investments Tracked</div>
          <table>
            <thead>
              <tr>
                <th>Investment Name</th>
                <th>Type</th>
                <th style="text-align: right;">Invested Amount</th>
                <th style="text-align: right;">Current Value</th>
                <th style="text-align: right;">Net P&L</th>
                <th>Start Date</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };


  const filtered = filter === 'all' ? investments : investments.filter((i) => i.type === filter);
  const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
  const totalCurrent = investments.reduce((s, i) => s + i.currentValue, 0);
  const totalPL = totalCurrent - totalInvested;
  const plPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  // I1: use the previously-orphaned sipAmount and dividends fields
  const totalSIP = investments.reduce((s, i) => s + (i.sipAmount || 0), 0);
  const totalDividends = investments.reduce((s, i) => s + (i.dividends || 0), 0);
  // Total return includes dividends received, not just capital appreciation.
  const totalReturn = totalPL + totalDividends;
  const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  const pieData = Object.entries(
    investments.reduce((acc, inv) => { acc[inv.type] = (acc[inv.type] || 0) + inv.currentValue; return acc; }, {} as Record<string, number>)
  ).map(([typeId, value]) => {
    const t = getAssetType(typeId);
    return { name: t.label, value, color: t.color };
  });

  const types = [...new Set(investments.map((i) => i.type))];

  // I2: risk-based rebalance plan (replaces the old hardcoded target weights)
  const currentByType = investments.reduce((acc, i) => { acc[i.type] = (acc[i.type] || 0) + i.currentValue; return acc; }, {} as Record<string, number>);
  const rebalance = rebalancePlan(currentByType, profile?.riskAppetite);

  return (
    <div className="animate-fade">
      {/* Dialogs */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Delete Investment?"
        message="This investment and all of its history will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete Investment"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <InputModal
        isOpen={showTypeInput}
        title="New Custom Category"
        label="Category Name"
        placeholder="e.g. ETFs, Startup Equity"
        confirmLabel="Add Category"
        onConfirm={handleTypeConfirm}
        onCancel={() => setShowTypeInput(false)}
      />

      <div className="section-header">
        <div>
          <h1>My Portfolio</h1>
          <div className="section-sub">Track all your investments with manual P&L updates</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={refreshPrices} disabled={refreshing} title="Fetch live prices for holdings with a symbol">
            <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} /> {refreshing ? 'Refreshing…' : 'Refresh Prices'}
          </button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Investment</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card card-glow-blue stat-card-blue">
          <div className="stat-label">Total Invested</div>
          <div className="stat-value">{formatCurrency(totalInvested)}</div>
          <div className="stat-sub">{investments.length} investments</div>
        </div>
        <div className="stat-card stat-card-green">
          <div className="stat-label">Current Value</div>
          <div className="stat-value">{formatCurrency(totalCurrent)}</div>
          <div className="stat-sub">Last updated today</div>
        </div>
        <div className={`stat-card ${totalPL >= 0 ? 'stat-card-green' : 'stat-card-red'}`}>
          <div className="stat-label">Total P&L</div>
          <div className="stat-value" style={{ color: totalPL >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {totalPL >= 0 ? '+' : ''}{formatCurrency(totalPL)}
          </div>
          <div className="stat-sub" style={{ color: totalPL >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {formatPercent(plPct)}
            {totalDividends > 0 && <span style={{ color: 'var(--text-muted)' }}> · incl. div: {formatPercent(totalReturnPct)}</span>}
          </div>
        </div>
        <div className="stat-card stat-card-purple">
          <div className="stat-label">Monthly SIP</div>
          <div className="stat-value">{formatCurrency(totalSIP)}</div>
          <div className="stat-sub">{types.length} asset class{types.length !== 1 ? 'es' : ''}{totalDividends > 0 ? ` · ${formatCurrency(totalDividends)} dividends` : ''}</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Pie Chart */}
        {pieData.length > 0 && (
          <div className="card">
            <div className="section-title" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Asset Allocation</div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [typeof v === 'number' ? formatCurrency(v) : String(v), '']} />
                  <Legend formatter={(v) => <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Rebalance Suggestion */}
        <div className="card">
          <div className="section-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>
            📊 Rebalance Plan <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>· {profile?.riskAppetite || 'moderate'} profile</span>
          </div>
          {investments.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '2.5rem 1rem', gap: '1rem', textAlign: 'center',
              border: '1.5px dashed rgba(79,142,255,0.28)', borderRadius: 'var(--radius-lg)',
              animation: 'borderPulse 2.5s ease-in-out infinite',
            }}>
              <div style={{ fontSize: '2.5rem', filter: 'grayscale(0.3)', lineHeight: 1 }}>📊</div>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Add investments to see allocation</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>We&apos;ll compare your portfolio vs recommended weights</div>
              <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={13} /> Add Investment</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {rebalance.map((r) => {
                const onTarget = Math.abs(r.currentPct - r.targetPct) <= 5;
                return (
                  <div key={r.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                      <span style={{ color: onTarget ? 'var(--green)' : 'var(--gold)' }}>
                        {r.currentPct}% <span style={{ color: 'var(--text-muted)' }}>(target {r.targetPct}%)</span>
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'var(--track-bg)', borderRadius: 3, position: 'relative' }}>
                      <div style={{ height: '100%', width: `${Math.min(r.currentPct, 100)}%`, background: r.color, borderRadius: 3, transition: 'width 0.5s ease' }} />
                      {/* target marker */}
                      <div style={{ position: 'absolute', top: -2, left: `${Math.min(r.targetPct, 100)}%`, width: 2, height: 10, background: 'var(--text-primary)', opacity: 0.5 }} />
                    </div>
                    {!onTarget && (
                      <div style={{ fontSize: '0.7rem', color: r.delta > 0 ? 'var(--green)' : 'var(--gold)', marginTop: '0.2rem' }}>
                        {r.delta > 0 ? `Add ${formatCurrency(r.delta)}` : `Trim ${formatCurrency(-r.delta)}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filter pill selector */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.25rem', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(79,142,255,0.06)', border: '1px solid rgba(79,142,255,0.18)', borderRadius: 'var(--radius-md)', padding: '0.3rem 0.6rem' }}>
          <Filter size={13} style={{ color: 'var(--blue)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Asset Class:</span>
          <select className="select" style={{ minWidth: 140, padding: '0 0.25rem', fontSize: '0.78rem', border: 'none', background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderRadius: '4px' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all" style={{ background: 'var(--bg-elevated)' }}>All ({investments.length})</option>
            {types.map((t) => (
              <option key={t} value={t} style={{ background: 'var(--bg-elevated)' }}>
                {getAssetType(t).icon} {getAssetType(t).label} ({investments.filter((i) => i.type === t).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="section-title" style={{ fontSize: '1rem', margin: 0 }}>Investment Holdings</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={exportToCSV} title="Export to CSV">
              <Download size={14} /> Export CSV
            </button>
            <button className="btn btn-ghost btn-sm" onClick={printReport} title="Print Report">
              <Printer size={14} /> Print PDF
            </button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '3.5rem 1rem', gap: '1rem', textAlign: 'center',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(79,142,255,0.12), rgba(167,139,250,0.12))',
              border: '1px solid rgba(79,142,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', animation: 'floatUp 4s ease-in-out infinite',
              boxShadow: '0 0 30px rgba(79,142,255,0.15)',
            }}>📈</div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>No investments tracked yet</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 320 }}>
              Start tracking stocks, mutual funds, FDs, gold, crypto and more — all in one place.
            </div>
            <button className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={openAdd}><Plus size={15} /> Add Your First Investment</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="inv-table">
              <thead>
                <tr><th>Investment</th><th>Type</th><th>Start Date</th><th>Invested</th><th>Current Value</th><th>P&L</th><th>Return</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const pl = inv.currentValue - inv.investedAmount;
                  const plp = (inv.investedAmount && Number(inv.investedAmount) > 0) ? (pl / Number(inv.investedAmount)) * 100 : 0;
                  return (
                    <tr key={inv.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{inv.name}</div>
                        {inv.quantity && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{inv.quantity} units @ ₹{inv.buyPrice?.toLocaleString('en-IN')}</div>}
                      </td>
                      <td><span className="badge badge-blue">{getAssetType(inv.type).icon} {getAssetType(inv.type).label}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{formatDate(inv.startDate)}</td>
                      <td>{formatCurrency(inv.investedAmount)}</td>
                      <td style={{ fontWeight: 500 }}>
                        {formatCurrency(inv.currentValue)}
                        {inv.priceUpdatedAt && (
                          <div style={{ fontSize: '0.62rem', color: 'var(--green)', fontWeight: 500 }}>
                            ● live · {new Date(inv.priceUpdatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>
                      <td style={{ color: pl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                        {pl >= 0 ? '+' : ''}{formatCurrency(pl)}
                      </td>
                      <td><span className={`badge ${plp >= 0 ? 'badge-green' : 'badge-red'}`}>{formatPercent(plp)}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-ghost btn-sm btn-icon" title="Edit" onClick={() => openEdit(inv)}><Edit2 size={14} /></button>
                          <button className="btn btn-danger btn-sm btn-icon" title="Delete" onClick={() => del(inv.id)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Update' : 'Add'} Investment</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="form-grid form-grid-2" style={{ gap: '1rem' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Investment Name <span className="form-required">*</span></label>
                <input className="input" placeholder="e.g. HDFC Midcap Fund, Reliance Industries" value={form.name} onChange={(e) => upd('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Type <span className="form-required">*</span></label>
                <select className="select" value={form.type} onChange={(e) => handleAssetTypeChange(e.target.value)}>
                  {assetTypes.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                  <option value="+custom">➕ Add Custom Category...</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input className="input" type="date" value={form.startDate} onChange={(e) => upd('startDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount Invested (₹) <span className="form-required">*</span></label>
                <input className="input" type="number" placeholder="50000" value={form.investedAmount || ''} onChange={(e) => upd('investedAmount', Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Current Value (₹) <span className="form-required">*</span></label>
                <input className="input" type="number" placeholder="58000" value={form.currentValue || ''} onChange={(e) => upd('currentValue', Number(e.target.value))} />
              </div>
              {form.type === 'stock' && (<>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input className="input" type="number" placeholder="50" value={form.quantity || ''} onChange={(e) => upd('quantity', Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Buy Price (₹)</label>
                  <input className="input" type="number" placeholder="1000" value={form.buyPrice || ''} onChange={(e) => upd('buyPrice', Number(e.target.value))} />
                </div>
              </>)}
              {form.type === 'mutual_fund' && (
                <div className="form-group">
                  <label className="form-label">Monthly SIP (₹)</label>
                  <input className="input" type="number" placeholder="5000" value={form.sipAmount || ''} onChange={(e) => upd('sipAmount', Number(e.target.value))} />
                </div>
              )}
              {(form.type === 'crypto' || form.type === 'mutual_fund' || form.type === 'stock') && (
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">
                    {form.type === 'crypto' ? 'CoinGecko ID' : form.type === 'mutual_fund' ? 'AMFI Scheme Code' : 'Stock Symbol'}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> — for live prices (optional)</span>
                  </label>
                  <input className="input"
                    placeholder={form.type === 'crypto' ? 'e.g. bitcoin' : form.type === 'mutual_fund' ? 'e.g. 120503' : 'e.g. RELIANCE'}
                    value={form.symbol || ''} onChange={(e) => upd('symbol', e.target.value)} />
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    {form.type === 'crypto' && 'The coin id from coingecko.com (e.g. bitcoin, ethereum). "Refresh Prices" then updates current value automatically.'}
                    {form.type === 'mutual_fund' && 'The scheme code from mfapi.in / AMFI. Refresh pulls the latest NAV × your units.'}
                    {form.type === 'stock' && 'Live NSE/BSE prices need a market-data source; until one is configured, stock value stays manual.'}
                  </div>
                </div>
              )}
              {form.type === 'ppf' && (<>
                <div className="form-group">
                  <label className="form-label">Monthly Contribution (₹)</label>
                  <input className="input" type="number" placeholder="12500" value={form.sipAmount || ''} onChange={(e) => upd('sipAmount', Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Interest Rate (% p.a.)</label>
                  <input className="input" type="number" placeholder="8.25" value={form.interestRate ?? ''} onChange={(e) => upd('interestRate', Number(e.target.value))} />
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                    {[['EPF', 8.25], ['PPF', 7.1]].map(([label, rate]) => (
                      <button key={label as string} type="button" className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', border: form.interestRate === rate ? '1px solid var(--blue)' : undefined }}
                        onClick={() => upd('interestRate', rate as number)}>
                        {label} {rate}%
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Withdrawn So Far (₹) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— optional</span></label>
                  <input className="input" type="number" placeholder="0" value={form.withdrawnAmount || ''} onChange={(e) => upd('withdrawnAmount', Number(e.target.value))} />
                </div>
              </>)}
              <div className="form-group">
                <label className="form-label">Dividends/Returns Received (₹)</label>
                <input className="input" type="number" placeholder="0" value={form.dividends || ''} onChange={(e) => upd('dividends', Number(e.target.value))} />
              </div>
              {goals.length > 0 && (
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Link to Goal <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— optional</span></label>
                  <select className="input" value={form.goalId || ''} onChange={(e) => upd('goalId', e.target.value)}>
                    <option value="">Not linked</option>
                    {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Linked holdings count toward that goal&apos;s progress.</div>
                </div>
              )}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Notes</label>
                <textarea className="textarea" placeholder="Any notes..." value={form.notes} onChange={(e) => upd('notes', e.target.value)} />
              </div>
            </div>
            {form.investedAmount > 0 && form.currentValue > 0 && (
              <div className="alert alert-info" style={{ margin: '1rem 0' }}>
                P&L: <strong>{form.currentValue >= form.investedAmount ? '+' : ''}{formatCurrency(form.currentValue - form.investedAmount)}</strong> ({formatPercent(((form.currentValue - form.investedAmount) / form.investedAmount) * 100)})
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.name || !form.investedAmount || !form.currentValue}>
                {editId ? 'Update' : 'Add'} Investment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
