'use client';
import { useState, useEffect, useCallback } from 'react';
import { getSalaryEntries, saveSalaryEntry, deleteSalaryEntry, getDailyExpenses, getCustomIncomes, saveCustomIncomes, getCustomExpenses, saveCustomExpenses, CategoryItem } from '@/lib/storage';
import { formatCurrency, monthLabel, currentMonth, generateId } from '@/lib/formatters';
import { computeTakeHome, computeIncomeBreakdown } from '@/lib/income';
import type { SalaryEntry, IncomeSource, ExpenseItem } from '@/types';
import { Plus, Trash2, X, TrendingUp, DollarSign, Receipt, Eye, Download, Printer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ConfirmModal, InputModal } from '@/components/ui/Dialogs';
import { useToast } from '@/components/ui/Toast';

const EMPTY_INCOME = (): IncomeSource => ({
  id: generateId(),
  sourceName: '',
  amount: 0,
  type: 'primary'
});

const EMPTY_EXPENSE = (): ExpenseItem => ({
  id: generateId(),
  category: 'other',
  amount: 0,
  notes: ''
});

export default function SalaryPage() {
  const [entries, setEntries] = useState<SalaryEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showExpCatInput, setShowExpCatInput] = useState<string | null>(null); // rowId awaiting input
  const [showIncTypeInput, setShowIncTypeInput] = useState<string | null>(null);
  // How many recent months the history chart shows (0 = all)
  const [chartWindow, setChartWindow] = useState<number>(6);
  const { success, info } = useToast();

  // Form State
  const [month, setMonth] = useState(currentMonth());
  const [basicSalary, setBasicSalary] = useState(0);
  const [hra, setHra] = useState(0);
  const [pf, setPf] = useState(0);
  const [tax, setTax] = useState(0);
  const [otherDeductions, setOtherDeductions] = useState(0);
  const [notes, setNotes] = useState('');
  const [incomes, setIncomes] = useState<IncomeSource[]>([EMPTY_INCOME()]);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([EMPTY_EXPENSE()]);

  const [expenseCategories, setExpenseCategories] = useState<CategoryItem[]>([]);
  const [incomeTypes, setIncomeTypes] = useState<CategoryItem[]>([]);

  // Selected Entry for Detailed Breakdown Charts
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const reload = useCallback(() => {
    const list = getSalaryEntries();
    setEntries(list);
    setSelectedEntryId((prev) => (list.length > 0 && !prev ? list[0].id : prev));
    
    // Load custom categories
    const customExps = getCustomExpenses();
    setExpenseCategories(customExps);

    const customIncs = getCustomIncomes();
    setIncomeTypes(customIncs);
  }, []);

  const handleExpenseCategoryChange = (rowId: string, val: string) => {
    if (val === '+custom') {
      setShowExpCatInput(rowId);
    } else {
      updateExpenseRow(rowId, 'category', val);
    }
  };

  const handleExpCatConfirm = (rowId: string, name: string) => {
    const slug = 'custom_' + Date.now();
    const newCat = { id: slug, label: `🛒 ${name}`, color: '#94a3b8' };
    const list = getCustomExpenses();
    list.push(newCat);
    saveCustomExpenses(list);
    setExpenseCategories(list);
    updateExpenseRow(rowId, 'category', slug);
    setShowExpCatInput(null);
  };

  const handleIncomeTypeChange = (rowId: string, val: string) => {
    if (val === '+custom') {
      setShowIncTypeInput(rowId);
    } else {
      updateIncomeRow(rowId, 'type', val);
    }
  };

  const handleIncTypeConfirm = (rowId: string, name: string) => {
    const slug = 'custom_' + Date.now();
    const newType = { id: slug, label: `💰 ${name}`, color: '#3b82f6' };
    const list = getCustomIncomes();
    list.push(newType);
    saveCustomIncomes(list);
    setIncomeTypes(list);
    updateIncomeRow(rowId, 'type', slug);
    setShowIncTypeInput(null);
  };

  useEffect(() => {
    reload();
  }, [reload]);

  const totalIncomes = incomes.reduce((s, i) => s + (i.amount || 0), 0);
  const totalDeductions = pf + tax + otherDeductions;
  // Deductions (PF/tax) apply only to salary (primary income). Other income
  // — rental, side hustle, etc. — is added after deductions, so it isn't taxed
  // or PF'd as if it were salary.
  const salaryIncome = incomes.reduce((s, i) => s + (i.type === 'primary' ? (i.amount || 0) : 0), 0);
  const otherIncome = totalIncomes - salaryIncome;
  const takeHome = (salaryIncome - totalDeductions) + otherIncome;
  const totalExpenses = expenseItems.reduce((s, e) => s + (e.amount || 0), 0);
  const totalSavings = Math.max(takeHome - totalExpenses, 0);

  const syncDailyExpensesForMonth = (m: string) => {
    const dailyLogs = getDailyExpenses();
    const filtered = dailyLogs.filter((log) => log.date.startsWith(m));
    if (filtered.length === 0) {
      setExpenseItems([EMPTY_EXPENSE()]);
      return;
    }

    const aggregated = filtered.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + log.amount;
      return acc;
    }, {} as Record<string, number>);

    const compiled = Object.entries(aggregated).map(([cat, amt]) => ({
      id: generateId(),
      category: cat as ExpenseItem['category'],
      amount: amt,
      notes: `Auto-compiled from daily tracker`
    }));

    setExpenseItems(compiled);
    info(`Imported ${compiled.length} expense items for ${m}`);
  };

  const openAdd = () => {
    const curM = currentMonth();
    setMonth(curM);
    setBasicSalary(0);
    setHra(0);
    setPf(0);
    setTax(0);
    setOtherDeductions(0);
    setNotes('');
    setIncomes([EMPTY_INCOME()]);
    setEditId(null);
    setShowModal(true);
    // Auto-load daily expenses
    syncDailyExpensesForMonth(curM);
  };

  const openEdit = (e: SalaryEntry) => {
    setMonth(e.month);
    setBasicSalary(e.basicSalary);
    setHra(e.hra);
    setPf(e.pf);
    setTax(e.tax);
    setOtherDeductions(e.otherDeductions);
    setNotes(e.notes || '');
    
    // Backwards compatibility migration fallback
    const loadedIncomes = e.incomes && e.incomes.length > 0 ? e.incomes : [
      { id: generateId(), sourceName: 'Primary Salary', amount: e.grossSalary, type: 'primary' as const }
    ];
    const loadedExpenses = e.expenseItems && e.expenseItems.length > 0 ? e.expenseItems : [
      { id: generateId(), category: 'other' as const, amount: e.expenses, notes: 'Uncategorized fallback' }
    ];

    setIncomes(loadedIncomes);
    setExpenseItems(loadedExpenses);
    setEditId(e.id);
    setShowModal(true);
  };

  const save = () => {
    const entry: SalaryEntry = {
      id: editId || generateId(),
      month,
      grossSalary: totalIncomes,
      basicSalary,
      hra,
      pf,
      tax,
      otherDeductions,
      expenses: totalExpenses,
      savings: totalSavings,
      notes,
      createdAt: new Date().toISOString(),
      incomes: incomes
        .filter((i) => i.amount > 0)
        .map((i) => ({ ...i, sourceName: i.sourceName.trim() || 'Income' })),
      expenseItems: expenseItems.filter((e) => e.amount > 0),
    };
    saveSalaryEntry(entry);
    reload();
    setShowModal(false);
    success(editId ? 'Monthly flow updated!' : 'Monthly flow saved!');
  };

  const del = (id: string) => setConfirmDeleteId(id);
  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    deleteSalaryEntry(confirmDeleteId);
    if (selectedEntryId === confirmDeleteId) setSelectedEntryId(null);
    reload();
    setConfirmDeleteId(null);
    success('Entry deleted');
  };

  const exportToCSV = () => {
    const headers = ['Month', 'Gross Income (INR)', 'Tax (INR)', 'PF (INR)', 'Expenses (INR)', 'Savings (INR)'];
    const rows = entries.map((e) => [
      monthLabel(e.month),
      e.grossSalary,
      e.tax,
      e.pf,
      e.expenses,
      e.savings
    ]);
    const content = [headers, ...rows].map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wealthos_salary_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHtml = entries.map((e) => `
      <tr>
        <td>${monthLabel(e.month)}</td>
        <td style="text-align: right;">INR ${e.grossSalary.toLocaleString('en-IN')}</td>
        <td style="text-align: right;">INR ${e.tax.toLocaleString('en-IN')}</td>
        <td style="text-align: right;">INR ${e.pf.toLocaleString('en-IN')}</td>
        <td style="text-align: right;">INR ${e.expenses.toLocaleString('en-IN')}</td>
        <td style="text-align: right;">INR ${e.savings.toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>WealthOS - Income & Savings Report</title>
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
          <h1>Income & Savings History Report</h1>
          <div class="meta">Generated on ${new Date().toLocaleDateString('en-IN')} · ${entries.length} Months Tracked</div>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th style="text-align: right;">Gross Income</th>
                <th style="text-align: right;">Tax</th>
                <th style="text-align: right;">PF</th>
                <th style="text-align: right;">Expenses</th>
                <th style="text-align: right;">Net Savings</th>
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


  // Income Sources Add / Remove
  const addIncomeRow = () => setIncomes([...incomes, EMPTY_INCOME()]);
  const removeIncomeRow = (id: string) => setIncomes(incomes.filter((i) => i.id !== id));
  const updateIncomeRow = (id: string, key: keyof IncomeSource, val: unknown) => {
    setIncomes(incomes.map((i) => i.id === id ? { ...i, [key]: val } : i));
  };

  // Expenses Add / Remove
  const addExpenseRow = () => setExpenseItems([...expenseItems, EMPTY_EXPENSE()]);
  const removeExpenseRow = (id: string) => setExpenseItems(expenseItems.filter((e) => e.id !== id));
  const updateExpenseRow = (id: string, key: keyof ExpenseItem, val: unknown) => {
    setExpenseItems(expenseItems.map((e) => e.id === id ? { ...e, [key]: val } : e));
  };

  // Recharts overall timeline data
  const orderedEntries = [...entries].reverse();
  const windowedEntries = chartWindow > 0 ? orderedEntries.slice(-chartWindow) : orderedEntries;
  const chartData = windowedEntries.map((e) => ({
    month: monthLabel(e.month),
    salary: e.grossSalary,
    savings: e.savings,
    expenses: e.expenses,
  }));

  // Selected Entry Data parsing for visual breakdowns
  const activeEntry = entries.find((e) => e.id === selectedEntryId) || entries[0];
  const activeBreakdown = activeEntry ? computeIncomeBreakdown(activeEntry) : null;

  // All-time income by source, summed across every month — one pie for the whole history.
  const allTimeIncomeMap = new Map<string, { name: string; value: number; color: string }>();
  entries.forEach((e) => {
    const rows = e.incomes && e.incomes.length > 0
      ? e.incomes
      : [{ id: 'def', sourceName: 'Primary Salary', amount: e.grossSalary, type: 'primary' }];
    rows.forEach((inc) => {
      const key = (inc.sourceName || 'Primary Salary').trim() || 'Primary Salary';
      const color = incomeTypes.find((c) => c.id === inc.type)?.color || '#94a3b8';
      const existing = allTimeIncomeMap.get(key);
      if (existing) existing.value += inc.amount;
      else allTimeIncomeMap.set(key, { name: key, value: inc.amount, color });
    });
  });
  const allTimeIncomeData = [...allTimeIncomeMap.values()].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const allTimeIncomeTotal = allTimeIncomeData.reduce((s, d) => s + d.value, 0);

  // Format data for selected month's expense categories breakdown pie chart
  const activeExpensesData = activeEntry ? (activeEntry.expenseItems && activeEntry.expenseItems.length > 0 ? activeEntry.expenseItems : [
    { id: 'def', category: 'other', amount: activeEntry.expenses }
  ]).reduce((acc, exp) => {
    const existing = acc.find((item) => item.category === exp.category);
    if (existing) {
      existing.value += exp.amount;
    } else {
      acc.push({
        category: exp.category,
        name: expenseCategories.find((c) => c.id === exp.category)?.label.split(' ').slice(1).join(' ') || exp.category,
        value: exp.amount,
        color: expenseCategories.find(c => c.id === exp.category)?.color || '#94a3b8'
      });
    }
    return acc;
  }, [] as { category: string; name: string; value: number; color: string }[]) : [];

  const avgSavingsRate = entries.length > 0
    ? Math.round(entries.reduce((s, e) => { const th = computeTakeHome(e); return s + (th > 0 ? (e.savings / th) * 100 : 0); }, 0) / entries.length)
    : 0;
  const totalSaved = entries.reduce((s, e) => s + e.savings, 0);

  return (
    <div className="animate-fade">
      {/* Dialogs */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Delete Entry?"
        message="This monthly income entry will be permanently removed. This action cannot be undone."
        confirmLabel="Delete Entry"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <InputModal
        isOpen={!!showExpCatInput}
        title="New Expense Category"
        label="Category Name"
        placeholder="e.g. Pet Care, Subscriptions"
        confirmLabel="Add Category"
        onConfirm={(name) => showExpCatInput && handleExpCatConfirm(showExpCatInput, name)}
        onCancel={() => setShowExpCatInput(null)}
      />
      <InputModal
        isOpen={!!showIncTypeInput}
        title="New Income Stream"
        label="Stream Name"
        placeholder="e.g. YouTube, Consulting"
        confirmLabel="Add Stream"
        onConfirm={(name) => showIncTypeInput && handleIncTypeConfirm(showIncTypeInput, name)}
        onCancel={() => setShowIncTypeInput(null)}
      />

      <div className="section-header">
        <div>
          <h1>Income &amp; Cash Flow</h1>
          <div className="section-sub">Track multiple income sources and categorized monthly expenses</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Monthly Cash Flow</button>
      </div>

      {/* Summary Cards */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card stat-card-blue">
          <div className="stat-label">Total Income (Latest)</div>
          <div className="stat-value">{entries[0] ? formatCurrency(computeTakeHome(entries[0])) : '—'}</div>
          <div className="stat-sub">{entries[0] ? `In-hand · Gross ${formatCurrency(entries[0].grossSalary)}` : 'No data'}</div>
        </div>
        <div className="stat-card stat-card-green">
          <div className="stat-label">Avg Savings Rate</div>
          <div className="stat-value" style={{ color: avgSavingsRate >= 20 ? 'var(--green)' : 'var(--gold)' }}>
            {avgSavingsRate}%
          </div>
          <div className="stat-sub">{avgSavingsRate >= 20 ? '✅ On track' : '⚠️ Aim for 20%+'}</div>
        </div>
        <div className="stat-card stat-card-gold">
          <div className="stat-label">Total Saved</div>
          <div className="stat-value gradient-gold">{formatCurrency(totalSaved)}</div>
          <div className="stat-sub">Across {entries.length} months</div>
        </div>
        <div className="stat-card stat-card-red">
          <div className="stat-label">Total Expenses (Latest)</div>
          <div className="stat-value" style={{ color: 'var(--gold)' }}>
            {entries[0] ? formatCurrency(entries[0].expenses) : '—'}
          </div>
          <div className="stat-sub">Net take-home: {entries[0] ? formatCurrency(computeTakeHome(entries[0])) : '—'}</div>
        </div>
      </div>

      {/* Charts Section */}
      {chartData.length > 0 && (
        <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
          {/* Timeline History */}
          <div className="card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div className="section-title" style={{ fontSize: '1rem', margin: 0 }}>
                <TrendingUp size={16} style={{ display: 'inline', marginRight: '0.5rem', color: 'var(--blue)' }} />
                Monthly Budget History
              </div>
              <select
                className="input"
                value={chartWindow}
                onChange={(e) => setChartWindow(Number(e.target.value))}
                style={{ width: 'auto', fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                aria-label="Chart month range"
              >
                <option value={6}>Last 6 months</option>
                <option value={12}>Last 12 months</option>
                <option value={0}>All months</option>
              </select>
            </div>
            <div style={{ flex: 1, minHeight: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={20}>
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [typeof v === 'number' ? `₹${(v as number).toLocaleString('en-IN')}` : v, '']} />
                  <Bar dataKey="salary" fill="var(--blue)" radius={[4, 4, 0, 0]} name="Total Income" />
                  <Bar dataKey="savings" fill="var(--green)" radius={[4, 4, 0, 0]} name="Savings" />
                  <Bar dataKey="expenses" fill="var(--gold)" radius={[4, 4, 0, 0]} name="Expenses" opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {[['var(--blue)', 'Income'], ['var(--green)', 'Savings'], ['var(--gold)', 'Expenses']].map(([c, l]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} /> {l}
                </span>
              ))}
            </div>
          </div>

          {/* Breakdown Charts (Latest Month / Selected Month) */}
          <div className="card">
            <div className="section-title" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
              📊 Budget Breakdown
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Showing details for: <strong style={{ color: 'var(--text-primary)' }}>{activeEntry ? monthLabel(activeEntry.month) : '—'}</strong>
            </div>

            {activeEntry ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* 1. All-time income by source — the pie + %-legend, at the top */}
                {allTimeIncomeData.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      All Income by Source <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(all months)</span>
                    </div>
                    <div style={{ height: 180 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={allTimeIncomeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                            {allTimeIncomeData.map((d) => <Cell key={d.name} fill={d.color} />)}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                            formatter={(v) => {
                              const num = Number(v);
                              const pct = allTimeIncomeTotal > 0 ? Math.round((num / allTimeIncomeTotal) * 100) : 0;
                              return [`${formatCurrency(num)} (${pct}%)`, 'Total'];
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.75rem', justifyContent: 'center' }}>
                      {allTimeIncomeData.map((d) => {
                        const pct = allTimeIncomeTotal > 0 ? Math.round((d.value / allTimeIncomeTotal) * 100) : 0;
                        return (
                          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem' }}>
                            <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                            <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Salary vs other income — deductions apply to salary only (below the chart) */}
                {activeBreakdown && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Take-home Breakdown <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({monthLabel(activeEntry.month)})</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Salary (PF/tax-eligible)</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatCurrency(activeBreakdown.salaryIncome)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Other income</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatCurrency(activeBreakdown.otherIncome)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Deductions (on salary){activeBreakdown.salaryIncome > 0 ? ` · ${Math.round((activeBreakdown.deductions / activeBreakdown.salaryIncome) * 100)}% of salary` : ''}
                      </span>
                      <span style={{ color: 'var(--red)', fontWeight: 500 }}>−{formatCurrency(activeBreakdown.deductions)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.4rem', marginTop: '0.1rem' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Net take-home</span>
                      <span style={{ color: 'var(--green)', fontWeight: 600 }}>{formatCurrency(activeBreakdown.takeHome)}</span>
                    </div>
                    {activeBreakdown.legacy && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        This older entry has no income breakdown, so its full amount is treated as salary.
                      </div>
                    )}
                  </div>
                )}

                {/* 3. All income list — every source, all-time amount + share */}
                {allTimeIncomeData.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>All Income <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(all months)</span></div>
                    {allTimeIncomeData.map((d) => {
                      const pct = allTimeIncomeTotal > 0 ? Math.round((d.value / allTimeIncomeTotal) * 100) : 0;
                      return (
                        <div key={d.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatCurrency(d.value)} ({pct}%)</span>
                          </div>
                          <div style={{ height: 4, background: 'var(--track-bg)', borderRadius: 2 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: d.color, borderRadius: 2 }} />
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Total</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(allTimeIncomeTotal)}</span>
                    </div>
                  </div>
                )}

                {/* 4. Expense categories progress bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Expenses by Category <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({monthLabel(activeEntry.month)})</span></div>
                  {activeExpensesData.slice(0, 4).map((exp) => {
                    const pct = activeEntry.expenses > 0 ? Math.round((exp.value / activeEntry.expenses) * 100) : 0;
                    return (
                      <div key={exp.category}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{exp.name}</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatCurrency(exp.value)} ({pct}%)</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--track-bg)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: exp.color, borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  })}
                  {activeExpensesData.length === 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No expense data</div>}
                </div>
              </div>
            ) : (
              <div className="empty-state">No entry selected</div>
            )}
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="section-title" style={{ fontSize: '1rem', margin: 0 }}>Historical Monthly Budgets</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={exportToCSV} title="Export to CSV">
              <Download size={14} /> Export CSV
            </button>
            <button className="btn btn-ghost btn-sm" onClick={printReport} title="Print Report">
              <Printer size={14} /> Print PDF
            </button>
          </div>
        </div>
        {entries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💰</div>
            <div className="empty-state-title">No budget logs yet</div>
            <div className="empty-state-sub">Start by logging your monthly budget and expenses</div>
            <button className="btn btn-primary mt-2" onClick={openAdd}><Plus size={14} /> Log First Month</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Total Income</th>
                  <th>Income Streams</th>
                  <th>Deductions</th>
                  <th>Total Expenses</th>
                  <th>Monthly Savings</th>
                  <th>Savings Rate</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const deductions = e.pf + e.tax + e.otherDeductions;
                  const rate = Math.round((e.savings / e.grossSalary) * 100);
                  const incomeCount = e.incomes?.length || 1;
                  const expenseCount = e.expenseItems?.length || 1;
                  const isSelected = selectedEntryId === e.id;
                  
                  return (
                    <tr key={e.id} style={{ cursor: 'pointer', background: isSelected ? 'rgba(59,130,246,0.06)' : '' }} onClick={() => setSelectedEntryId(e.id)}>
                      <td><span style={{ fontWeight: 600 }}>{monthLabel(e.month)}</span></td>
                      <td style={{ color: 'var(--blue)', fontWeight: 500 }}>{formatCurrency(e.grossSalary)}</td>
                      <td>
                        <span className="badge badge-blue">{incomeCount} source{incomeCount !== 1 ? 's' : ''}</span>
                        <span className="badge badge-gray" style={{ marginLeft: '0.25rem' }}>{expenseCount} category{expenseCount !== 1 ? 'ies' : ''}</span>
                      </td>
                      <td style={{ color: 'var(--red)' }}>-{formatCurrency(deductions)}</td>
                      <td style={{ color: 'var(--gold)' }}>{formatCurrency(e.expenses)}</td>
                      <td style={{ color: 'var(--green)', fontWeight: 600 }}>{formatCurrency(e.savings)}</td>
                      <td>
                        <span className={`badge ${rate >= 20 ? 'badge-green' : 'badge-gold'}`}>{rate}%</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={(ev) => { ev.stopPropagation(); openEdit(e); }} title="Edit"><Eye size={14} /></button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={(ev) => { ev.stopPropagation(); del(e.id); }} title="Delete"><Trash2 size={14} /></button>
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
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Edit' : 'Add'} Monthly Cash Flow</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Month</label>
              <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>

            {/* Incomes Builder Section */}
            <div className="card-sm" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--blue)' }}>
                  <DollarSign size={16} /> Income Streams
                </h4>
                <button className="btn btn-ghost btn-sm" onClick={addIncomeRow}><Plus size={14} /> Add Stream</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {incomes.map((inc) => (
                  <div key={inc.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input className="input" style={{ flex: 2 }} placeholder="Source (e.g. Primary Job, Freelance)" value={inc.sourceName} onChange={(e) => updateIncomeRow(inc.id, 'sourceName', e.target.value)} />
                    <select className="select" style={{ flex: 1 }} value={inc.type} onChange={(e) => handleIncomeTypeChange(inc.id, e.target.value)}>
                      {incomeTypes.map((t) => <option key={t.id} value={t.id}>{t.label.split(' ').slice(1).join(' ')}</option>)}
                      <option value="+custom">➕ Add Custom Category...</option>
                    </select>
                    <input className="input" type="number" style={{ flex: 1 }} placeholder="Amount" value={inc.amount || ''} onChange={(e) => updateIncomeRow(inc.id, 'amount', Number(e.target.value))} />
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeIncomeRow(inc.id)} disabled={incomes.length <= 1}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Gross Income:</span>
                <span style={{ fontWeight: 600, color: 'var(--blue)' }}>{formatCurrency(totalIncomes)}</span>
              </div>
            </div>

            {/* Deductions grid */}
            <div className="card-sm" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', marginBottom: '1.25rem' }}>
              <h4 style={{ color: 'var(--red)', marginBottom: '0.75rem' }}>📉 Deductions & Taxes</h4>
              <div className="form-grid form-grid-3">
                <div className="form-group">
                  <label className="form-label">Tax Deduction (TDS)</label>
                  <input className="input" type="number" placeholder="Tax" value={tax || ''} onChange={(e) => setTax(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">PF Contribution</label>
                  <input className="input" type="number" placeholder="PF" value={pf || ''} onChange={(e) => setPf(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Other Deductions</label>
                  <input className="input" type="number" placeholder="Other" value={otherDeductions || ''} onChange={(e) => setOtherDeductions(Number(e.target.value))} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Net Monthly Take-Home:</span>
                <span style={{ fontWeight: 600, color: 'var(--blue)' }}>{formatCurrency(takeHome)}</span>
              </div>
            </div>

            {/* Expenses Builder Section */}
            <div className="card-sm" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--gold)', margin: 0 }}>
                  <Receipt size={16} /> Category-wise Expenses
                </h4>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => syncDailyExpensesForMonth(month)} style={{ color: 'var(--blue)', fontSize: '0.75rem' }}>
                    🔄 Sync Daily Tracker
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={addExpenseRow} style={{ fontSize: '0.75rem' }}><Plus size={12} /> Add Category</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {expenseItems.map((exp) => (
                  <div key={exp.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select className="select" style={{ flex: 1.5 }} value={exp.category} onChange={(e) => handleExpenseCategoryChange(exp.id, e.target.value)}>
                      {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      <option value="+custom">➕ Add Custom Category...</option>
                    </select>
                    <input className="input" type="number" style={{ flex: 1 }} placeholder="Amount" value={exp.amount || ''} onChange={(e) => updateExpenseRow(exp.id, 'amount', Number(e.target.value))} />
                    <input className="input" style={{ flex: 2 }} placeholder="Optional Notes (e.g., electricity, grocery shop)" value={exp.notes || ''} onChange={(e) => updateExpenseRow(exp.id, 'notes', e.target.value)} />
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeExpenseRow(exp.id)} disabled={expenseItems.length <= 1}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Expenses:</span>
                <span style={{ fontWeight: 600, color: 'var(--gold)' }}>{formatCurrency(totalExpenses)}</span>
              </div>
            </div>

            {/* Calculations preview box */}
            <div style={{ padding: '1rem', background: 'var(--green-glow)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Net Monthly Savings</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)' }}>{formatCurrency(totalSavings)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Savings Rate</div>
                  <span className={`badge ${totalIncomes > 0 && (totalSavings / totalIncomes) * 100 >= 20 ? 'badge-green' : 'badge-gold'}`} style={{ fontSize: '0.9rem', padding: '0.3rem 0.85rem' }}>
                    {totalIncomes > 0 ? Math.round((totalSavings / totalIncomes) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Notes</label>
              <textarea className="textarea" placeholder="Any general comments for this month..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={totalIncomes === 0}>
                {editId ? 'Update' : 'Save'} Monthly Flow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
