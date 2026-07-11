'use client';
import { useState, useEffect } from 'react';
import {
  getCustomIncomes, saveCustomIncomes,
  getCustomExpenses, saveCustomExpenses,
  getCustomInvestments, saveCustomInvestments,
  CategoryItem
} from '@/lib/storage';
import { Plus, Trash2, Tag, Wallet, PieChart, Lock, Sparkles, Layers, Search, LayoutGrid } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/Dialogs';
import { useToast } from '@/components/ui/Toast';


/* ───── Default Data ───── */
const DEFAULT_INCOMES: CategoryItem[] = [
  { id: 'primary', label: '💼 Primary Job', color: '#3b82f6' },
  { id: 'side_hustle', label: '🚀 Side Hustle', color: '#10b981' },
  { id: 'investment', label: '📈 Investment', color: '#fbbf24' },
  { id: 'rental', label: '🏠 Rental Income', color: '#ec4899' },
  { id: 'other', label: '💰 Other', color: '#94a3b8' },
];

const DEFAULT_EXPENSES: CategoryItem[] = [
  { id: 'rent', label: '🏠 Rent / Housing', color: '#ec4899' },
  { id: 'groceries', label: '🛒 Groceries / Food', color: '#10b981' },
  { id: 'utilities', label: '🔌 Bills / Utilities', color: '#3b82f6' },
  { id: 'entertainment', label: '🎬 Fun / Leisure', color: '#8b5cf6' },
  { id: 'transport', label: '🚗 Transport / Fuel', color: '#06b6d4' },
  { id: 'emi_car', label: '🚗 EMI - Car', color: '#f59e0b' },
  { id: 'emi_phone', label: '📱 EMI - Phone', color: '#14b8a6' },
  { id: 'healthcare', label: '🏥 Medical / Health', color: '#ef4444' },
  { id: 'education', label: '📚 Study / Kids', color: '#a855f7' },
  { id: 'other', label: '🛍️ Other Expenses', color: '#94a3b8' },
];

const DEFAULT_INVESTMENTS: CategoryItem[] = [
  { id: 'stock', label: '📈 Stocks', color: '#3b82f6' },
  { id: 'mutual_fund', label: '💼 Mutual Funds', color: '#10b981' },
  { id: 'fd', label: '🏦 Fixed Deposits', color: '#fbbf24' },
  { id: 'gold', label: '🏅 Gold / SGB', color: '#f59e0b' },
  { id: 'ppf', label: '💳 PPF / EPF', color: '#8b5cf6' },
  { id: 'real_estate', label: '🏠 Real Estate', color: '#ec4899' },
  { id: 'crypto', label: '🪙 Crypto', color: '#06b6d4' },
  { id: 'other', label: '🏷️ Other Assets', color: '#94a3b8' },
];

const COLOR_PALETTE = [
  '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#f59e0b',
  '#ef4444', '#06b6d4', '#14b8a6', '#fbbf24', '#a855f7', '#94a3b8',
];

const EMOJI_GRID = [
  '🛍️', '💼', '🚀', '🏠', '🚗', '📱', '🏥', '🔌',
  '🛒', '🎬', '📚', '🏅', '🪙', '✈️', '🐶', '❤️',
  '🎮', '🏋️', '🍕', '💻', '🎵', '👕', '🔧', '💡',
];

type Tab = 'expense' | 'income' | 'investment';

const TAB_CONFIG: { key: Tab; label: string; Icon: typeof Tag; color: string; glow: string }[] = [
  { key: 'expense', label: 'Expenses', Icon: Tag, color: 'var(--red)', glow: 'var(--red-glow)' },
  { key: 'income', label: 'Income', Icon: Wallet, color: 'var(--green)', glow: 'var(--green-glow)' },
  { key: 'investment', label: 'Investments', Icon: PieChart, color: 'var(--gold)', glow: 'var(--gold-glow)' },
];

export default function CategoriesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('expense');
  const [customIncomes, setCustomIncomes] = useState<CategoryItem[]>([]);
  const [customExpenses, setCustomExpenses] = useState<CategoryItem[]>([]);
  const [customInvestments, setCustomInvestments] = useState<CategoryItem[]>([]);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [emoji, setEmoji] = useState('🛍️');
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { success, warning } = useToast();


  const reload = () => {
    setCustomIncomes(getCustomIncomes());
    setCustomExpenses(getCustomExpenses());
    setCustomInvestments(getCustomInvestments());
  };
  useEffect(() => { reload(); }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    // Check unique constraint across defaults and custom categories
    const isDuplicate = defaults.some(d => d.label.split(' ').slice(1).join(' ').toLowerCase() === label.trim().toLowerCase()) ||
                        custom.some(c => c.label.split(' ').slice(1).join(' ').toLowerCase() === label.trim().toLowerCase());
    if (isDuplicate) {
      warning(`Category "${label.trim()}" already exists in ${typeLabel}s.`);
      return;
    }

    const newId = 'custom_' + Date.now();
    const cleanLabel = `${emoji} ${label.trim()}`;
    if (activeTab === 'income') {
      saveCustomIncomes([...customIncomes, { id: newId, label: cleanLabel, color }]);
    } else if (activeTab === 'expense') {
      saveCustomExpenses([...customExpenses, { id: newId, label: cleanLabel, color }]);
    } else {
      saveCustomInvestments([...customInvestments, { id: newId, label: cleanLabel, color }]);
    }
    setLabel('');
    setEmoji('🛍️');
    reload();
    success('Category added!');
  };

  const handleDelete = (id: string) => setConfirmDeleteId(id);
  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    if (activeTab === 'income') {
      saveCustomIncomes(customIncomes.filter((i) => i.id !== confirmDeleteId));
    } else if (activeTab === 'expense') {
      saveCustomExpenses(customExpenses.filter((i) => i.id !== confirmDeleteId));
    } else {
      saveCustomInvestments(customInvestments.filter((i) => i.id !== confirmDeleteId));
    }
    reload();
    setConfirmDeleteId(null);
    success('Category deleted');
  };


  const getActiveData = () => {
    const map: Record<Tab, { defaults: CategoryItem[]; custom: CategoryItem[]; label: string }> = {
      expense: { defaults: DEFAULT_EXPENSES, custom: customExpenses, label: 'Expense' },
      income: { defaults: DEFAULT_INCOMES, custom: customIncomes, label: 'Income' },
      investment: { defaults: DEFAULT_INVESTMENTS, custom: customInvestments, label: 'Investment' },
    };
    return map[activeTab];
  };

  const { defaults, custom, label: typeLabel } = getActiveData();
  const allItems = [...defaults.map((d) => ({ ...d, isDefault: true })), ...custom.map((c) => ({ ...c, isDefault: false }))];
  const filtered = search
    ? allItems.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
    : allItems;


  const tabConfig = TAB_CONFIG.find((t) => t.key === activeTab)!;


  return (
    <div className="animate-fade">
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Delete Category?"
        message="Deleting this custom category will not erase its existing entries in your tracker, but they will show without the custom label styling. Are you sure?"
        confirmLabel="Delete Category"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* ─── Page Header ─── */}
      <div className="section-header">
        <div>
          <h1>Category Manager</h1>
          <div className="section-sub">
            Organize and manage all categories used across Income, Expenses, and Investments
          </div>
        </div>
      </div>


      {/* ─── Tab Selector with inline counts ─── */}
      <div className="tabs" style={{ marginBottom: '0.75rem' }}>
        {TAB_CONFIG.map(({ key, label: tabLabel, Icon }) => {
          const d = key === 'expense' ? DEFAULT_EXPENSES : key === 'income' ? DEFAULT_INCOMES : DEFAULT_INVESTMENTS;
          const cu = key === 'expense' ? customExpenses : key === 'income' ? customIncomes : customInvestments;
          const count = d.length + cu.length;
          return (
            <button
              key={key}
              className={`tab-btn${activeTab === key ? ' active' : ''}`}
              onClick={() => { setActiveTab(key); setSearch(''); }}
            >
              <Icon size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              {tabLabel}
              <span style={{
                marginLeft: 6, fontSize: '0.7rem', fontWeight: 700,
                background: activeTab === key ? 'rgba(255,255,255,0.2)' : 'var(--bg-glass)',
                padding: '1px 7px', borderRadius: 100, minWidth: 20, textAlign: 'center',
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Compact Info Strip ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        marginBottom: '1.25rem', padding: '0.5rem 0.85rem',
        background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-secondary)',
        flexWrap: 'wrap',
      }}>
        <Layers size={14} style={{ color: tabConfig.color, flexShrink: 0 }} />
        <span><strong style={{ color: 'var(--text-primary)' }}>{defaults.length}</strong> defaults</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span><strong style={{ color: 'var(--text-primary)' }}>{custom.length}</strong> custom</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>{defaults.length + custom.length} total {typeLabel.toLowerCase()} categories</span>
      </div>


      {/* ─── Main Content: Form + Table ─── */}
      <div className="grid-3">
        {/* ─── Add Category Card ─── */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--radius-sm)',
              background: tabConfig.glow, color: tabConfig.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Plus size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>New {typeLabel} Category</h3>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Custom categories sync everywhere</div>
            </div>
          </div>

          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Emoji Selector */}
            <div className="form-group">
              <label className="form-label">Icon</label>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px',
                background: 'var(--bg-glass)', padding: '0.4rem',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              }}>
                {EMOJI_GRID.map((em) => (
                  <button
                    key={em} type="button"
                    onClick={() => setEmoji(em)}
                    style={{
                      fontSize: '1.1rem', background: emoji === em ? 'var(--blue)' : 'transparent',
                      border: 'none', borderRadius: 4, width: '100%', aspectRatio: '1',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s', opacity: emoji === em ? 1 : 0.7,
                    }}
                  >{em}</button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="form-group">
              <label className="form-label">Category Name</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                  background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.15rem', flexShrink: 0,
                }}>{emoji}</span>
                <input
                  className="input"
                  placeholder="e.g. Gym, Freelance, Crypto"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Color */}
            <div className="form-group">
              <label className="form-label">Color Tag</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c} type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: 26, height: 26, borderRadius: '50%', background: c,
                      border: color === c ? '2.5px solid var(--text-primary)' : '2px solid transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                      transform: color === c ? 'scale(1.2)' : 'scale(1)',
                      boxShadow: color === c ? `0 0 12px ${c}50` : 'none',
                    }}
                  />
                ))}
                {/* Native Custom Color Picker */}
                <label style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'linear-gradient(45deg, red, orange, yellow, green, blue, purple)',
                  border: !COLOR_PALETTE.includes(color) ? '2.5px solid var(--text-primary)' : '2px solid transparent',
                  cursor: 'pointer', display: 'inline-block', position: 'relative',
                  transform: !COLOR_PALETTE.includes(color) ? 'scale(1.2)' : 'scale(1)',
                  boxShadow: !COLOR_PALETTE.includes(color) ? `0 0 12px ${color}50` : 'none',
                }}>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
                  />
                </label>
              </div>
            </div>

            {/* Preview */}
            {label.trim() && (
              <div style={{
                padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)',
                background: `${color}10`, border: `1px dashed ${color}40`,
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                fontSize: '0.82rem', color: 'var(--text-secondary)',
              }}>
                <span style={{ fontSize: '1.1rem' }}>{emoji}</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{label.trim()}</span>
                <div style={{ marginLeft: 'auto', width: 10, height: 10, borderRadius: '50%', background: color }} />
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full">
              <Plus size={15} /> Create Category
            </button>
          </form>
        </div>

        {/* ─── Category Table ─── */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          {/* Table Header Bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '1.25rem', gap: '0.75rem', flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <tabConfig.Icon size={18} style={{ color: tabConfig.color }} />
              <h3 style={{ margin: 0 }}>{typeLabel} Categories</h3>
              <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>
                {filtered.length}
              </span>
            </div>
            <div style={{ position: 'relative', minWidth: 200 }}>
              <Search size={14} style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }} />
              <input
                className="input"
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '2rem', fontSize: '0.8rem' }}
              />
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="inv-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Category</th>
                  <th>Color</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state" style={{ padding: '2rem' }}>
                        <div className="empty-state-icon">🔍</div>
                        <div className="empty-state-title">
                          {search ? 'No categories match your search' : 'No custom categories yet'}
                        </div>
                        <div className="empty-state-sub">
                          {search ? 'Try a different keyword' : 'Use the form on the left to add your first custom category.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, idx) => (
                    <tr key={item.id + idx}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{idx + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{
                            width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                            background: `${item.color || '#3b82f6'}15`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1rem', flexShrink: 0,
                          }}>
                            {item.label.split(' ')[0]}
                          </span>
                          <span style={{ fontWeight: 500, fontSize: '0.88rem' }}>
                            {item.label.split(' ').slice(1).join(' ')}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: 12, height: 12, borderRadius: '50%',
                            background: item.color || '#3b82f6',
                            boxShadow: `0 0 8px ${item.color || '#3b82f6'}40`,
                          }} />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {item.color || '#3b82f6'}
                          </span>
                        </div>
                      </td>
                      <td>
                        {item.isDefault ? (
                          <span className="badge badge-blue">
                            <Lock size={9} /> Default
                          </span>
                        ) : (
                          <span className="badge badge-gold">
                            <Sparkles size={9} /> Custom
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {item.isDefault ? (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Protected</span>
                        ) : (
                          <button
                            className="btn btn-danger btn-sm btn-icon"
                            onClick={() => handleDelete(item.id)}
                            title="Delete category"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Info */}
          <div style={{
            marginTop: '1rem', padding: '0.65rem 0.85rem',
            background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            fontSize: '0.75rem', color: 'var(--text-muted)',
          }}>
            <LayoutGrid size={13} />
            <span>
              {defaults.length} system defaults <span style={{ opacity: 0.4 }}>·</span>{' '}
              {custom.length} custom categories <span style={{ opacity: 0.4 }}>·</span>{' '}
              Changes auto-sync across all modules
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
