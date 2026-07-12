'use client';
import { useState, useEffect } from 'react';
import { getGoals, saveGoal, deleteGoal, getCustomInvestments, getInvestments } from '@/lib/storage';
import { formatCurrency, generateId } from '@/lib/formatters';
import type { Goal, Investment } from '@/types';
import { Plus, Trash2, Edit2, X, Target, Calendar, Calculator, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/Dialogs';
import { useToast } from '@/components/ui/Toast';

const DEFAULT_GOAL_CATEGORIES = [
  { id: 'retirement', label: '🌴 Retirement' },
  { id: 'house', label: '🏠 Dream Home' },
  { id: 'car', label: '🚗 Car / Vehicle' },
  { id: 'education', label: '🎓 Education' },
  { id: 'travel', label: '✈️ Travel / Vacation' },
  { id: 'emergency', label: '🛡️ Emergency Fund' },
  { id: 'general', label: '💰 General Wealth' },
];

const EMPTY_GOAL: Omit<Goal, 'id' | 'createdAt'> = {
  name: '',
  targetAmount: 0,
  currentAmount: 0,
  targetDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
  category: 'general',
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [categories, setCategories] = useState(DEFAULT_GOAL_CATEGORIES);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_GOAL });
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { success } = useToast();

  // Return rate for SIP helper (assumed default 12% p.a.)
  const [expectedRate, setExpectedRate] = useState(12);

  // Current value of investments linked to a goal (I3)
  const linkedValue = (goalId: string) => investments.filter((i) => i.goalId === goalId).reduce((s, i) => s + i.currentValue, 0);

  const reload = () => {
    setGoals(getGoals());
    setInvestments(getInvestments());
    const custom = getCustomInvestments();
    const compiled = [
      ...DEFAULT_GOAL_CATEGORIES,
      ...custom.map((c) => ({
        id: c.id,
        label: c.label,
      })),
    ];
    setCategories(compiled);
  };

  useEffect(() => {
    reload();
  }, []);

  const openAdd = () => {
    setForm({ ...EMPTY_GOAL });
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (g: Goal) => {
    setForm({
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      targetDate: g.targetDate,
      category: g.category,
    });
    setEditId(g.id);
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.targetAmount <= 0) return;

    const g: Goal = {
      id: editId || generateId(),
      name: form.name.trim(),
      targetAmount: Number(form.targetAmount),
      currentAmount: Number(form.currentAmount),
      targetDate: form.targetDate,
      category: form.category,
      createdAt: new Date().toISOString(),
    };

    saveGoal(g);
    reload();
    setShowModal(false);
    success(editId ? 'Goal updated successfully' : 'Goal created!');
  };

  const handleDelete = (id: string) => setConfirmDeleteId(id);
  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    deleteGoal(confirmDeleteId);
    reload();
    setConfirmDeleteId(null);
    success('Goal deleted');
  };

  // Helper: calculate months remaining
  const getMonthsRemaining = (targetDateStr: string): number => {
    const diff = new Date(targetDateStr).getTime() - Date.now();
    const months = Math.ceil(diff / (30 * 24 * 3600 * 1000));
    return Math.max(months, 1);
  };

  // Helper: required SIP calculator (FV based math)
  const calcRequiredSIP = (g: Goal): number => {
    const months = getMonthsRemaining(g.targetDate);
    const target = g.targetAmount;
    const current = g.currentAmount;
    const rate = expectedRate;

    const i = rate / 12 / 100; // monthly interest rate
    
    // Future value of current savings
    const fvCurrent = current * Math.pow(1 + i, months);
    const remainingTarget = target - fvCurrent;

    if (remainingTarget <= 0) return 0;
    if (i === 0) return Math.round(remainingTarget / months);

    // SIP formula: PMT = FV * i / ((1 + i)^n - 1)
    const sip = (remainingTarget * i) / (Math.pow(1 + i, months) - 1);
    return Math.round(sip);
  };

  // Totals for metrics
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const overallProgress = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  return (
    <div className="animate-fade">
      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Delete Goal?"
        message="This financial goal and all its data will be permanently removed. This action cannot be undone."
        confirmLabel="Delete Goal"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* Header */}
      <div className="section-header">
        <div>
          <h1>Goals Tracker</h1>
          <div className="section-sub">Define, visualize, and calculate plans to reach your savings targets</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Create Goal</button>
      </div>

      {/* Metrics Row */}
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card stat-card-blue">
          <div className="stat-icon" style={{ background: 'var(--blue-glow)', color: 'var(--blue)' }}><Target size={18} /></div>
          <div className="stat-label">Total Target</div>
          <div className="stat-value">{formatCurrency(totalTarget)}</div>
          <div className="stat-sub">{goals.length} active goals</div>
        </div>
        <div className="stat-card stat-card-green">
          <div className="stat-icon" style={{ background: 'var(--green-glow)', color: 'var(--green)' }}><TrendingUp size={18} /></div>
          <div className="stat-label">Total Saved</div>
          <div className="stat-value">{formatCurrency(totalSaved)}</div>
          <div className="stat-sub">Remaining: {formatCurrency(Math.max(totalTarget - totalSaved, 0))}</div>
        </div>
        <div className="stat-card stat-card-purple">
          <div className="stat-icon" style={{ background: 'rgba(124,58,237,0.15)', color: 'var(--purple)' }}><Sparkles size={18} /></div>
          <div className="stat-label">Overall Completion</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{overallProgress}%</div>
          <div style={{ height: 6, background: 'var(--track-bg)', borderRadius: 3, marginTop: '0.4rem', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${overallProgress}%`, background: 'linear-gradient(90deg, var(--blue), var(--purple))', borderRadius: 3 }} />
          </div>
        </div>
      </div>

      {/* Parameters Controls */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calculator size={16} color="var(--gold)" /> Smart Plan rate</h4>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Expected investment rate to compute monthly SIP needs</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label className="form-label" style={{ margin: 0 }}>Expected Return Rate:</label>
          <select className="select" style={{ width: 120, padding: '0.35rem 0.75rem' }} value={expectedRate} onChange={(e) => setExpectedRate(Number(e.target.value))}>
            <option value={6}>6% (Debt/FD)</option>
            <option value={8}>8% (Conservative)</option>
            <option value={10}>10% (Balanced)</option>
            <option value={12}>12% (Equity SIP)</option>
            <option value={15}>15% (Aggressive)</option>
          </select>
        </div>
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
          <h2>No savings goals defined yet</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>Define a target corpus (e.g. buying a house, vacation fund, emergency reserves) and track your path.</p>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add First Goal</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {goals.map((g) => {
            const months = getMonthsRemaining(g.targetDate);
            const linked = linkedValue(g.id);
            const effectiveCurrent = g.currentAmount + linked;
            const effGoal = { ...g, currentAmount: effectiveCurrent };
            const progress = Math.min(Math.round((effectiveCurrent / g.targetAmount) * 100), 100);
            const reqSip = calcRequiredSIP(effGoal);
            const cat = categories.find((c) => c.id === g.category) || { label: '💰 Goal' };
            const yearsText = months >= 12 ? ` (${(months / 12).toFixed(1)} years)` : '';
            const isOverdue = new Date(g.targetDate) < new Date() && effectiveCurrent < g.targetAmount;

            return (
              <div className="card" key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{g.name}</h3>
                    <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-blue" style={{ textTransform: 'capitalize' }}>{cat.label}</span>
                      {isOverdue && (
                        <span className="badge badge-red" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <AlertTriangle size={10} /> Overdue
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(g)} title="Edit"><Edit2 size={13} /></button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(g.id)} title="Delete"><Trash2 size={13} /></button>
                  </div>
                </div>

                {/* Progress Visual */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Target Progress</span>
                    <span style={{ fontWeight: 600, color: 'var(--blue)' }}>{progress}%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--track-bg)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--blue), var(--green))', borderRadius: 4, transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                {/* Financial breakdown values */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'var(--inner-card)', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Current Saved</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--green)' }}>{formatCurrency(effectiveCurrent)}</div>
                    {linked > 0 && <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>incl. {formatCurrency(linked)} linked investments</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Target corpus</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(g.targetAmount)}</div>
                  </div>
                </div>

                {/* Due details & Required Monthly SIP projection */}
                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    <Calendar size={13} />
                    <span>Target Date: <strong>{g.targetDate}</strong> ({months}m remaining{yearsText})</span>
                  </div>

                  {reqSip > 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--blue-glow)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-accent)' }}>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Required Monthly SIP</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--blue)' }}>{formatCurrency(reqSip)}/mo</div>
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textAlign: 'right' }}>Calculated at {expectedRate}%</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', background: 'var(--green-glow)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.75rem', color: 'var(--green)', fontWeight: 600 }}>
                      🎉 Goal Achieved!
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Goal Modal (Create/Edit) */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Modify Saving Goal' : 'Create Saving Goal'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Goal Title</label>
                <input className="input" placeholder="e.g. Buying a Tesla, Child's Education Fund" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Goal Category</label>
                <select className="select" value={form.category} onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Target Corpus (₹)</label>
                  <input className="input" type="number" placeholder="500000" value={form.targetAmount || ''} onChange={(e) => setForm(p => ({ ...p, targetAmount: Number(e.target.value) }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Current Savings (₹)</label>
                  <input className="input" type="number" placeholder="50000" value={form.currentAmount || ''} onChange={(e) => setForm(p => ({ ...p, currentAmount: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Target Date</label>
                <input className="input" type="date" value={form.targetDate} onChange={(e) => setForm(p => ({ ...p, targetDate: e.target.value }))} required />
              </div>
              <button className="btn btn-primary w-full" type="submit">
                {editId ? 'Save Changes' : 'Create Goal'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
