'use client';
import { useState, useEffect } from 'react';
import { getDailyExpenses, saveDailyExpense, deleteDailyExpense, getProfile, getCustomExpenses, saveCustomExpenses, CategoryItem } from '@/lib/storage';
import { formatCurrency, generateId, monthLabel } from '@/lib/formatters';
import type { DailyExpense } from '@/types';
import { Plus, Trash2, Calendar, Filter, Receipt, Download, Printer } from 'lucide-react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { ConfirmModal, InputModal } from '@/components/ui/Dialogs';
import { useToast } from '@/components/ui/Toast';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [amount, setAmount] = useState('');
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [category, setCategory] = useState<string>('groceries');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [monthlyLimit, setMonthlyLimit] = useState(50000);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showCatInput, setShowCatInput] = useState(false);
  const { success, warning } = useToast();

  // New Date filter states
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Month shown in the daily Spending Trend chart (defaults to current month)
  const [chartMonth, setChartMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const reload = () => {
    setExpenses(getDailyExpenses());
    const prof = getProfile();
    if (prof?.monthlyExpenses) {
      setMonthlyLimit(prof.monthlyExpenses);
    }
    
    const list = getCustomExpenses();
    setCategories(list);
  };

  useEffect(() => {
    reload();
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    const newExpense: DailyExpense = {
      id: generateId(),
      date,
      category,
      amount: Number(amount),
      description: description.trim() || category.toUpperCase(),
      createdAt: new Date().toISOString(),
    };

    saveDailyExpense(newExpense);
    setAmount('');
    setDescription('');
    reload();
    success('Expense added');
  };

  const handleDelete = (id: string) => setConfirmDeleteId(id);
  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    deleteDailyExpense(confirmDeleteId);
    reload();
    setConfirmDeleteId(null);
    success('Expense deleted');
  };

  const handleCategoryChange = (val: string) => {
    if (val === '+custom') {
      setShowCatInput(true);
    } else {
      setCategory(val);
    }
  };

  const handleCatConfirm = (name: string) => {
    const slug = 'custom_' + Date.now();
    const newCat = { id: slug, label: `🛒 ${name}`, color: '#94a3b8' };
    const list = getCustomExpenses();
    list.push(newCat);
    saveCustomExpenses(list);
    setCategories(list);
    setCategory(slug);
    setShowCatInput(false);
  };

  const handleDateFilter = (filter: typeof dateFilter) => {
    if (filter === 'custom' && startDate && endDate && startDate > endDate) {
      warning('Start date must be before end date');
      return;
    }
    setDateFilter(filter);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
  const currentMonthYear = new Date().toISOString().slice(0, 7);

  const spentToday = expenses
    .filter((e) => e.date === todayStr)
    .reduce((s, e) => s + e.amount, 0);

  const spentThisWeek = expenses
    .filter((e) => e.date >= startOfWeekStr)
    .reduce((s, e) => s + e.amount, 0);

  const spentThisMonth = expenses
    .filter((e) => e.date.startsWith(currentMonthYear))
    .reduce((s, e) => s + e.amount, 0);

  // Filtered expenses based on category and date filters
  const filteredExpenses = expenses.filter((e) => {
    const matchesCategory = filterCategory === 'all' || e.category === filterCategory;
    if (!matchesCategory) return false;

    if (dateFilter === 'all') return true;
    if (dateFilter === 'today') return e.date === todayStr;
    if (dateFilter === 'week') return e.date >= startOfWeekStr;
    if (dateFilter === 'month') return e.date.startsWith(currentMonthYear);
    if (dateFilter === 'custom') {
      const s = startDate || '1970-01-01';
      const en = endDate || '2999-12-31';
      const minDate = s <= en ? s : en;
      const maxDate = s <= en ? en : s;
      return e.date >= minDate && e.date <= maxDate;
    }
    return true;
  });

  // Months that actually have expenses, newest first — drives the chart picker
  const availableMonths = [...new Set(expenses.map((e) => e.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a));

  const dailySums = expenses
    .filter((e) => e.date.startsWith(chartMonth))
    .reduce((acc, e) => {
      const day = e.date.slice(8, 10);
      acc[day] = (acc[day] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);



  const chartData = Object.entries(dailySums)
    .map(([day, value]) => ({ day: `Day ${day}`, amount: value }))
    .sort((a, b) => a.day.localeCompare(b.day));

  // Category Distribution calculation
  const categorySummary = filteredExpenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(categorySummary).map(([catId, amount]) => {
    const cat = categories.find((c) => c.id === catId) || { label: '🛍️ Other', color: '#94a3b8' };
    return {
      name: cat.label.split(' ').slice(1).join(' ') || cat.label,
      value: amount,
      color: cat.color,
    };
  });

  const exportToCSV = () => {
    const headers = ['Date', 'Category', 'Description', 'Amount (INR)'];
    const rows = filteredExpenses.map((e) => [
      e.date,
      (categories.find((c) => c.id === e.category) || { label: 'Other' }).label.split(' ').slice(1).join(' '),
      e.description,
      e.amount
    ]);
    const content = [headers, ...rows].map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wealthos_expenses_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalSpent = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const rowsHtml = filteredExpenses.map((exp) => `
      <tr>
        <td>${exp.date}</td>
        <td>${(categories.find((c) => c.id === exp.category) || { label: 'Other' }).label.split(' ').slice(1).join(' ')}</td>
        <td>${exp.description}</td>
        <td style="text-align: right;">INR ${exp.amount.toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>WealthOS - Expense Report</title>
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
          <h1>Daily Expenses Report</h1>
          <div class="meta">Generated on ${new Date().toLocaleDateString('en-IN')} · Filter: ${dateFilter.toUpperCase()} · ${filteredExpenses.length} Transactions</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="total-row">
                <td colspan="3">Total Spent</td>
                <td style="text-align: right;">INR ${totalSpent.toLocaleString('en-IN')}</td>
              </tr>
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


  return (
    <div className="animate-fade">
      {/* Dialogs */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Delete Expense?"
        message="This expense entry will be permanently removed. This action cannot be undone."
        confirmLabel="Delete Expense"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <InputModal
        isOpen={showCatInput}
        title="New Expense Category"
        label="Category Name"
        placeholder="e.g. Subscriptions, Pet Care"
        confirmLabel="Add Category"
        onConfirm={handleCatConfirm}
        onCancel={() => setShowCatInput(false)}
      />

      <div className="section-header">
        <div>
          <h1>Daily Expenses</h1>
          <div className="section-sub">Log individual day-to-day purchases to track your spending habits</div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card card-glow-blue stat-card-blue">
          <div className="stat-label">Spent Today</div>
          <div className="stat-value">{formatCurrency(spentToday)}</div>
          <div className="stat-sub">Today&apos;s transactions</div>
        </div>
        <div className="stat-card stat-card-gold">
          <div className="stat-label">Spent This Week</div>
          <div className="stat-value">{formatCurrency(spentThisWeek)}</div>
          <div className="stat-sub">Past 7 days</div>
        </div>
        <div className={`stat-card ${spentThisMonth > monthlyLimit ? 'stat-card-red' : 'stat-card-green'}`}>
          <div className="stat-label">Spent This Month</div>
          <div className="stat-value" style={{ color: spentThisMonth > monthlyLimit ? 'var(--red)' : 'var(--green)' }}>
            {formatCurrency(spentThisMonth)}
          </div>
          <div className="stat-sub">Limit: {formatCurrency(monthlyLimit)}</div>
        </div>
        <div className={`stat-card ${monthlyLimit - spentThisMonth >= 0 ? 'stat-card-green' : 'stat-card-red'}`}>
          <div className="stat-label">Budget Remaining</div>
          <div className="stat-value" style={{ color: monthlyLimit - spentThisMonth >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {formatCurrency(Math.max(monthlyLimit - spentThisMonth, 0))}
          </div>
          <div className="stat-sub">{spentThisMonth > monthlyLimit ? '⚠️ Budget Exceeded!' : 'Within target'}</div>
        </div>
      </div>

      {/* Limit Progress Bar */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Monthly Budget Usage</span>
          <span style={{ fontWeight: 600 }}>{spentThisMonth > 0 ? Math.round((spentThisMonth / monthlyLimit) * 100) : 0}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--track-bg)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min((spentThisMonth / monthlyLimit) * 100, 100)}%`,
            background: spentThisMonth > monthlyLimit ? 'var(--red)' : 'linear-gradient(90deg, var(--green), var(--blue))',
            borderRadius: 4,
            transition: 'width 0.4s ease'
          }} />
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        {/* Quick Add Form */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Plus size={18} /> Quick Log Expense</h3>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Amount (₹)</label>
              <input className="input" type="number" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="select" value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                <option value="+custom">➕ Add Custom Category...</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="input" placeholder="e.g. Groceries shop, fuel, movies" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <button className="btn btn-primary w-full" type="submit" style={{ marginTop: '0.5rem' }}>
              <Receipt size={16} /> Log Expense
            </button>
          </form>
        </div>

        {/* Expenses Trend Chart */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>📈 Spending Trend</h3>
            <select
              className="input"
              value={chartMonth}
              onChange={(e) => setChartMonth(e.target.value)}
              style={{ width: 'auto', fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
              aria-label="Chart month"
            >
              {(availableMonths.includes(chartMonth) ? availableMonths : [chartMonth, ...availableMonths]).map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>
          {chartData.length === 0 ? (
            <div className="empty-state" style={{ height: 220 }}><div className="empty-state-icon">📊</div><div className="empty-state-title">No expenses logged for {monthLabel(chartMonth)}</div></div>
          ) : (
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `₹${v}`} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [formatCurrency(Number(v)), 'Spent']} />
                  <Bar dataKey="amount" fill="var(--blue)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Category Distribution Pie Chart */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>🍕 Category Breakdown</h3>
          {pieData.length === 0 ? (
            <div className="empty-state" style={{ height: 220 }}><div className="empty-state-icon">📊</div><div className="empty-state-title">No expenses match active filters</div></div>
          ) : (
            <div style={{ height: 260, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={2}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                      formatter={(v) => [formatCurrency(Number(v)), 'Spent']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Custom Legends list */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center', overflowY: 'auto', maxHeight: 60, fontSize: '0.65rem', marginTop: '0.25rem' }}>
                {pieData.slice(0, 4).map((entry, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: entry.color }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
                  </span>
                ))}
                {pieData.length > 4 && <span style={{ color: 'var(--text-muted)' }}>+{pieData.length - 4} more</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Transaction History</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Export buttons */}
            <button className="btn btn-ghost btn-sm" onClick={exportToCSV} title="Export to CSV">
              <Download size={14} /> Export CSV
            </button>
            <button className="btn btn-ghost btn-sm" onClick={printReport} title="Print Report">
              <Printer size={14} /> Print PDF
            </button>
            <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 0.25rem' }} />

            {/* Date filter selector — labeled pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(79,142,255,0.06)', border: '1px solid rgba(79,142,255,0.18)', borderRadius: 'var(--radius-md)', padding: '0.3rem 0.6rem' }}>
              <Calendar size={13} style={{ color: 'var(--blue-light)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Date:</span>
              <select className="select" style={{ minWidth: 100, padding: '0 0.25rem', fontSize: '0.78rem', border: 'none', background: 'transparent', color: 'var(--text-primary)' }} value={dateFilter} onChange={(e) => handleDateFilter(e.target.value as typeof dateFilter)}>
                <option value="all">All</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom…</option>
              </select>
            </div>

            {dateFilter === 'custom' && (
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <input type="date" className="input" style={{ width: 125, padding: '0.35rem 0.5rem', fontSize: '0.75rem', borderColor: startDate && endDate && startDate > endDate ? 'var(--red)' : '' }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
                <input type="date" className="input" style={{ width: 125, padding: '0.35rem 0.5rem', fontSize: '0.75rem', borderColor: startDate && endDate && startDate > endDate ? 'var(--red)' : '' }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                {startDate && endDate && startDate > endDate && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--red)' }} title="Swapped automatically">⚠️ Start &gt; End</span>
                )}
              </div>
            )}

            {/* Category filter selector — labeled pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(79,142,255,0.06)', border: '1px solid rgba(79,142,255,0.18)', borderRadius: 'var(--radius-md)', padding: '0.3rem 0.6rem' }}>
              <Filter size={13} style={{ color: 'var(--blue-light)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Category:</span>
              <select className="select" style={{ minWidth: 110, padding: '0 0.25rem', fontSize: '0.78rem', border: 'none', background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderRadius: '4px' }} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="all" style={{ background: 'var(--bg-elevated)' }}>All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id} style={{ background: 'var(--bg-elevated)' }}>
                    {c.label.split(' ').slice(1).join(' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🛍️</div>
            <div className="empty-state-title">No transactions logged</div>
            <div className="empty-state-sub">Start typing in the quick log form to log your expenses.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id}>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{exp.date}</td>
                    <td>
                      <span className="badge" style={{
                        background: `${(categories.find((c) => c.id === exp.category) || { color: '#94a3b8' }).color}1A`,
                        borderColor: (categories.find((c) => c.id === exp.category) || { color: '#94a3b8' }).color,
                        color: (categories.find((c) => c.id === exp.category) || { color: '#94a3b8' }).color,
                        textTransform: 'capitalize'
                      }}>
                        {(categories.find((c) => c.id === exp.category) || { label: '🛍️ Other' }).label.split(' ').slice(1).join(' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{exp.description}</td>
                    <td style={{ fontWeight: 600, color: 'var(--gold)' }}>{formatCurrency(exp.amount)}</td>
                    <td>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(exp.id)} title="Delete Log">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
