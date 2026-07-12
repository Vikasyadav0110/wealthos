'use client';
import { useState, useEffect, useCallback } from 'react';
import { getSalaryEntries, saveSalaryEntry, deleteSalaryEntry, getDailyExpenses, getCustomIncomes, saveCustomIncomes, getCustomExpenses, saveCustomExpenses, CategoryItem } from '@/lib/storage';
import { formatCurrency, monthLabel, currentMonth, generateId } from '@/lib/formatters';
import { computeTakeHome, computeIncomeBreakdown } from '@/lib/income';
import type { SalaryEntry, IncomeSource, ExpenseItem } from '@/types';
import { Plus, Trash2, X, TrendingUp, DollarSign, Receipt, Eye, Download, Printer, ChevronDown, Copy, ArrowUp, ArrowDown } from 'lucide-react';
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
  // Which timeline month card is expanded
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Which series the combined trend chart shows
  const [trendSeries, setTrendSeries] = useState<{ income: boolean; savings: boolean; expenses: boolean }>({ income: true, savings: true, expenses: true });

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
    
    // Get existing manual expense items (non-empty, and not auto-compiled)
    const existingManual = expenseItems.filter(
      (e) => e.amount > 0 && e.notes !== 'Auto-compiled from daily tracker'
    );

    if (filtered.length === 0) {
      if (existingManual.length > 0) {
        setExpenseItems(existingManual);
      } else {
        setExpenseItems([EMPTY_EXPENSE()]);
      }
      info(`No daily expenses logged for ${m}. Preserved manual entries.`);
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

    // Merge: Keep compiled entries, and preserve manual entries for categories
    // that are NOT present in the compiled entries.
    const compiledCategories = new Set(compiled.map((c) => c.category));
    const preservedManual = existingManual.filter(
      (me) => !compiledCategories.has(me.category)
    );

    const merged = [...compiled, ...preservedManual];
    setExpenseItems(merged.length > 0 ? merged : [EMPTY_EXPENSE()]);
    info(`Imported ${compiled.length} categories from daily tracker. Preserved ${preservedManual.length} manual entries.`);
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

  // Prefill the (already-open) Add form from the most recent month, keeping the
  // current month. Income sources and deductions carry over; expenses reset.
  const copyLastMonth = () => {
    const prev = entries[0];
    if (!prev) { info('No previous month to copy from'); return; }
    setBasicSalary(prev.basicSalary);
    setHra(prev.hra);
    setPf(prev.pf);
    setTax(prev.tax);
    setOtherDeductions(prev.otherDeductions);
    setIncomes((prev.incomes && prev.incomes.length > 0 ? prev.incomes : [{ id: generateId(), sourceName: 'Primary Salary', amount: prev.grossSalary, type: 'primary' as const }])
      .map((i) => ({ ...i, id: generateId() })));
    info(`Copied income & deductions from ${monthLabel(prev.month)}`);
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

  // ── Hero (selected/latest month) ──
  const heroTakeHome = activeEntry ? computeTakeHome(activeEntry) : 0;
  const heroSavingsRate = heroTakeHome > 0 && activeEntry ? Math.round((activeEntry.savings / heroTakeHome) * 100) : 0;
  const heroTopExpense = activeExpensesData.slice().sort((a, b) => b.value - a.value)[0] || null;

  // ── S2: annualized projection + year-to-date (based on the latest month) ──
  const latestEntry = entries[0];
  const annualIncomeProjection = latestEntry ? computeTakeHome(latestEntry) * 12 : 0;
  const currentYear = new Date().toISOString().slice(0, 4);
  const ytdEntries = entries.filter((e) => e.month.startsWith(currentYear));
  const ytdIncome = ytdEntries.reduce((s, e) => s + computeTakeHome(e), 0);
  const ytdSaved = ytdEntries.reduce((s, e) => s + e.savings, 0);

  // ── S4: month-over-month deltas (latest vs previous) ──
  const prevEntry = entries[1];
  const incomeDelta = latestEntry && prevEntry ? computeTakeHome(latestEntry) - computeTakeHome(prevEntry) : null;
  const savingsDelta = latestEntry && prevEntry ? latestEntry.savings - prevEntry.savings : null;
  // Savings gauge geometry: a 270° arc, filled to the savings rate.
  const GAUGE = { r: 46, stroke: 9, sweep: 270 };
  const gaugeCirc = 2 * Math.PI * GAUGE.r;
  const gaugeArc = (GAUGE.sweep / 360) * gaugeCirc;
  const gaugeFill = Math.min(heroSavingsRate, 100) / 100 * gaugeArc;
  const gaugeColor = heroSavingsRate >= 20 ? 'var(--green)' : 'var(--gold)';

  // Per-entry savings rate over take-home (used by timeline cards)
  const entryRate = (e: SalaryEntry) => { const th = computeTakeHome(e); return th > 0 ? Math.round((e.savings / th) * 100) : 0; };

  // Income sources for one entry, with resolved colors (for the cash-flow diagram)
  const allTimeIncomeDataForEntry = (e: SalaryEntry) => {
    const rows = e.incomes && e.incomes.length > 0
      ? e.incomes
      : [{ id: 'def', sourceName: 'Primary Salary', amount: e.grossSalary, type: 'primary' }];
    return rows.filter((r) => r.amount > 0).map((r) => ({
      name: (r.sourceName || 'Primary Salary').trim() || 'Income',
      value: r.amount,
      color: incomeTypes.find((c) => c.id === r.type)?.color || '#3b82f6',
    }));
  };

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

      {/* ── Hero: this / selected month ── */}
      {activeEntry && (
        <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Savings gauge */}
          <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
            <svg width={120} height={120} style={{ transform: 'rotate(135deg)' }}>
              <circle cx={60} cy={60} r={GAUGE.r} fill="none" stroke="var(--track-bg)" strokeWidth={GAUGE.stroke}
                strokeDasharray={`${gaugeArc} ${gaugeCirc}`} strokeLinecap="round" />
              <circle cx={60} cy={60} r={GAUGE.r} fill="none" stroke={gaugeColor} strokeWidth={GAUGE.stroke}
                strokeDasharray={`${gaugeFill} ${gaugeCirc}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: gaugeColor }}>{heroSavingsRate}%</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>saved</div>
            </div>
          </div>

          {/* In-hand headline */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              In-hand income · {monthLabel(activeEntry.month)}
            </div>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, margin: '0.15rem 0' }}>
              {formatCurrency(heroTakeHome)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Gross {formatCurrency(activeEntry.grossSalary)}
              {heroSavingsRate < 20 && <span style={{ color: 'var(--gold)', marginLeft: '0.5rem' }}>· aim for 20%+ savings</span>}
              {heroSavingsRate >= 20 && <span style={{ color: 'var(--green)', marginLeft: '0.5rem' }}>· on track ✅</span>}
            </div>
            {/* S4: month-over-month deltas (only when viewing the latest month) */}
            {activeEntry.id === latestEntry?.id && incomeDelta !== null && savingsDelta !== null && (
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: incomeDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {incomeDelta >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                  {formatCurrency(Math.abs(incomeDelta))} income vs last month
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: savingsDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {savingsDelta >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                  {formatCurrency(Math.abs(savingsDelta))} savings vs last month
                </span>
              </div>
            )}
          </div>

          {/* Tiles */}
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Saved</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--green)' }}>{formatCurrency(activeEntry.savings)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Expenses</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--gold)' }}>{formatCurrency(activeEntry.expenses)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Top expense</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{heroTopExpense ? heroTopExpense.name : '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Slim KPI strip */}
      {entries.length > 0 && (
        <div className="card-sm" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1.5rem', padding: '0.75rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: avgSavingsRate >= 20 ? 'var(--green)' : 'var(--gold)' }}>{avgSavingsRate}%</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>avg savings rate</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatCurrency(totalSaved)}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>total saved</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{entries.length}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>months tracked</span>
          </div>
          {/* S2: annualized projection + YTD */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--blue)' }}>{formatCurrency(annualIncomeProjection)}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>projected annual income</span>
          </div>
          {ytdEntries.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--green)' }}>{formatCurrency(ytdSaved)}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>saved YTD (of {formatCurrency(ytdIncome)})</span>
            </div>
          )}
        </div>
      )}

      {/* Charts Section */}
      {chartData.length > 0 && (
        <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
          {/* Life Trend chart (left, spans 2) */}
          <div className="card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <div className="section-title" style={{ fontSize: '1rem', margin: 0 }}>
                <TrendingUp size={16} style={{ display: 'inline', marginRight: '0.5rem', color: 'var(--blue)' }} />
                Life Trend
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Series toggles */}
                {([['income', 'var(--blue)', 'Income'], ['savings', 'var(--green)', 'Savings'], ['expenses', 'var(--gold)', 'Expenses']] as const).map(([key, color, label]) => (
                  <button key={key} onClick={() => setTrendSeries((s) => ({ ...s, [key]: !s[key] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: 6, cursor: 'pointer',
                      border: '1px solid var(--border)', background: trendSeries[key] ? 'var(--bg-elevated)' : 'transparent', opacity: trendSeries[key] ? 1 : 0.45 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} /> {label}
                  </button>
                ))}
                <select className="input" value={chartWindow} onChange={(e) => setChartWindow(Number(e.target.value))}
                  style={{ width: 'auto', fontSize: '0.78rem', padding: '0.3rem 0.5rem' }} aria-label="Chart month range">
                  <option value={6}>Last 6</option>
                  <option value={12}>Last 12</option>
                  <option value={0}>All</option>
                </select>
              </div>
            </div>
            {/* Bar chart */}
            <div style={{ flex: 1, minHeight: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={18}>
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [typeof v === 'number' ? `₹${(v as number).toLocaleString('en-IN')}` : v, '']} />
                  {trendSeries.income && <Bar dataKey="salary" fill="var(--blue)" radius={[4, 4, 0, 0]} name="Income" />}
                  {trendSeries.savings && <Bar dataKey="savings" fill="var(--green)" radius={[4, 4, 0, 0]} name="Savings" />}
                  {trendSeries.expenses && <Bar dataKey="expenses" fill="var(--gold)" radius={[4, 4, 0, 0]} name="Expenses" opacity={0.8} />}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Compact numerical cash-flow summary */}
            {activeEntry && activeBreakdown && (
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  Cash Flow · {monthLabel(activeEntry.month)}
                </div>
                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                  {allTimeIncomeDataForEntry(activeEntry).map((src) => (
                    <div key={src.name} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: src.color, flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{src.name}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(src.value)}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: '0.78rem', color: 'var(--red)' }}>
                    Deductions <span style={{ fontWeight: 600 }}>−{formatCurrency(activeBreakdown.deductions)}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--blue)' }}>
                    In-hand <span style={{ fontWeight: 600 }}>{formatCurrency(heroTakeHome)}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--gold)' }}>
                    Spent <span style={{ fontWeight: 600 }}>{formatCurrency(activeEntry.expenses)}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--green)' }}>
                    Saved <span style={{ fontWeight: 600 }}>{formatCurrency(activeEntry.savings)}</span>
                  </div>
                </div>
              </div>
            )}
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

              </div>
            ) : (
              <div className="empty-state">No entry selected</div>
            )}
          </div>
        </div>
      )}

      {/* All Income & Expenses by Category — full-width row below charts */}
      {activeEntry && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* All Income (all months) */}
          {allTimeIncomeData.length > 0 && (
            <div className="card">
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>All Income <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(all months)</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {allTimeIncomeData.map((d) => {
                  const pct = allTimeIncomeTotal > 0 ? Math.round((d.value / allTimeIncomeTotal) * 100) : 0;
                  return (
                    <div key={d.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatCurrency(d.value)} ({pct}%)</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--track-bg)', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: d.color, borderRadius: 3, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.15rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Total</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(allTimeIncomeTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Expenses by Category */}
          <div className="card">
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Expenses by Category <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({monthLabel(activeEntry.month)})</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {activeExpensesData.map((exp) => {
                const pct = activeEntry.expenses > 0 ? Math.round((exp.value / activeEntry.expenses) * 100) : 0;
                return (
                  <div key={exp.category}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{exp.name}</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatCurrency(exp.value)} ({pct}%)</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--track-bg)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: exp.color, borderRadius: 3, transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                );
              })}
              {activeExpensesData.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No expense data</div>}
            </div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {entries.map((e) => {
              const deductions = e.pf + e.tax + e.otherDeductions;
              const rate = entryRate(e);
              const th = computeTakeHome(e);
              const incomeCount = e.incomes?.length || 1;
              const isSelected = selectedEntryId === e.id;
              const isExpanded = expandedId === e.id;
              // Mini sparkline bar: savings vs expenses split of take-home
              const savePct = th > 0 ? Math.round((e.savings / th) * 100) : 0;
              return (
                <div key={e.id} className="card-sm" style={{ border: `1px solid ${isSelected ? 'var(--blue)' : 'var(--border)'}`, background: isSelected ? 'rgba(59,130,246,0.05)' : 'var(--bg-card)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onClick={() => { setSelectedEntryId(e.id); setExpandedId(isExpanded ? null : e.id); }}>
                  {/* Collapsed row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
                    <div style={{ minWidth: 70 }}><span style={{ fontWeight: 700 }}>{monthLabel(e.month)}</span></div>
                    <div style={{ minWidth: 110 }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>In-hand</div>
                      <div style={{ fontWeight: 600 }}>{formatCurrency(th)}</div>
                    </div>
                    <div style={{ minWidth: 90 }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Saved</div>
                      <div style={{ fontWeight: 600, color: 'var(--green)' }}>{formatCurrency(e.savings)}</div>
                    </div>
                    {/* sparkline: proportion saved vs spent */}
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--track-bg)' }}>
                        <div style={{ width: `${savePct}%`, background: 'var(--green)' }} />
                        <div style={{ width: `${100 - savePct}%`, background: 'var(--gold)', opacity: 0.7 }} />
                      </div>
                    </div>
                    <span className={`badge ${rate >= 20 ? 'badge-green' : 'badge-gold'}`}>{rate}% saved</span>
                    <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={(ev) => { ev.stopPropagation(); openEdit(e); }} title="Edit"><Eye size={14} /></button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={(ev) => { ev.stopPropagation(); del(e.id); }} title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }} onClick={(ev) => ev.stopPropagation()}>
                      <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--blue)', marginBottom: '0.4rem' }}>Income Streams ({incomeCount})</div>
                        {(e.incomes && e.incomes.length > 0 ? e.incomes : [{ id: 'def', sourceName: 'Primary Salary', amount: e.grossSalary, type: 'primary' }]).map((inc, idx) => (
                          <div key={inc.id || idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '0.15rem 0' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{inc.sourceName || 'Primary Salary'}</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatCurrency(inc.amount)}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '0.15rem 0', color: 'var(--red)' }}>
                          <span>Deductions</span><span>−{formatCurrency(deductions)}</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--gold)', marginBottom: '0.4rem' }}>Expenses</div>
                        {(e.expenseItems && e.expenseItems.length > 0 ? e.expenseItems : [{ id: 'def', category: 'other', amount: e.expenses, notes: '' }]).map((exp, idx) => (
                          <div key={exp.id || idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '0.15rem 0' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{expenseCategories.find((c) => c.id === exp.category)?.label.split(' ').slice(1).join(' ') || exp.category}</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatCurrency(exp.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Edit' : 'Add'} Monthly Cash Flow</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {!editId && entries.length > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={copyLastMonth} title="Prefill from last month">
                    <Copy size={14} /> Copy last month
                  </button>
                )}
                <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
              </div>
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

            {/* Salary structure (optional) — Basic & HRA feed the Tax Planner */}
            <div className="card-sm" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', marginBottom: '1.25rem' }}>
              <h4 style={{ color: 'var(--blue)', marginBottom: '0.75rem' }}>🧾 Salary Structure <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>— optional, used for tax planning</span></h4>
              <div className="form-grid form-grid-3">
                <div className="form-group">
                  <label className="form-label">Basic Salary</label>
                  <input className="input" type="number" placeholder="Basic" value={basicSalary || ''} onChange={(e) => setBasicSalary(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">HRA Received</label>
                  <input className="input" type="number" placeholder="HRA" value={hra || ''} onChange={(e) => setHra(Number(e.target.value))} />
                </div>
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
