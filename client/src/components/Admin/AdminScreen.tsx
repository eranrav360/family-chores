import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getGoals, updateGoal, getChores, createChore, updateChore, deleteChore,
  changePin, resetPeriod, getCurrentPeriods, updateMember, deleteMember, createMember,
} from '../../api';
import { useApp } from '../../context/AppContext';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { DIFFICULTY_META } from '../../types';
import type { Chore, FamilyMember } from '../../types';
import PinModal from './PinModal';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const AVATAR_OPTIONS = ['🦁','🐯','🐼','🐸','🦊','🐶','🐱','🦄','🐻','🐨','🐰','🦋','🌸','⭐','🌈','🎮','⚽','🎨','🚀','🦸','🧸','🎪','🏆','🐲'];

type AdminTab = 'goals' | 'chores' | 'members' | 'security' | 'links';

export default function AdminScreen() {
  const { isAdminAuthenticated, authenticate, logout, verifying, pinError, setPinError } = useAdminAuth();
  const { family, refreshFamily } = useApp();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminTab>('goals');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  // ── Data queries ─────────────────────────────────────────────────────────
  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: getGoals,
    enabled: isAdminAuthenticated,
  });
  const { data: chores, isLoading: choresLoading } = useQuery({
    queryKey: ['chores-all'],
    queryFn: () => getChores(),
    enabled: isAdminAuthenticated,
  });
  const { data: periods } = useQuery({
    queryKey: ['current-periods'],
    queryFn: getCurrentPeriods,
    enabled: isAdminAuthenticated,
  });

  // ── Goals mutations ──────────────────────────────────────────────────────
  const [weeklyTarget, setWeeklyTarget] = useState('');
  const [monthlyTarget, setMonthlyTarget] = useState('');
  const [personalWeeklyTarget, setPersonalWeeklyTarget] = useState('');
  const [personalMonthlyTarget, setPersonalMonthlyTarget] = useState('');
  const goalMutation = useMutation({
    mutationFn: ({ type, val }: {
      type: 'weekly' | 'monthly' | 'personal_weekly' | 'personal_monthly';
      val: number;
    }) => updateGoal(type, val),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['current-periods'] });
      flash('success', 'היעד עודכן בהצלחה ✅');
    },
    onError: (e: Error) => flash('error', e.message),
  });

  // ── Chore mutations ──────────────────────────────────────────────────────
  const [newChore, setNewChore] = useState({ name: '', difficulty: 'easy', points: 5 });
  const [editChore, setEditChore] = useState<Chore | null>(null);

  const createChoreMutation = useMutation({
    mutationFn: createChore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chores-all'] });
      queryClient.invalidateQueries({ queryKey: ['chores-active'] });
      setNewChore({ name: '', difficulty: 'easy', points: 5 });
      flash('success', 'מטלה נוספה ✅');
    },
    onError: (e: Error) => flash('error', e.message),
  });
  const updateChoreMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Chore> }) => updateChore(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chores-all'] });
      queryClient.invalidateQueries({ queryKey: ['chores-active'] });
      setEditChore(null);
      flash('success', 'מטלה עודכנה ✅');
    },
    onError: (e: Error) => flash('error', e.message),
  });
  const deleteChoreMutation = useMutation({
    mutationFn: deleteChore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chores-all'] });
      queryClient.invalidateQueries({ queryKey: ['chores-active'] });
      flash('success', 'מטלה הוסרה ✅');
    },
    onError: (e: Error) => flash('error', e.message),
  });

  // ── Member mutations ─────────────────────────────────────────────────────
  const [editMember, setEditMember] = useState<FamilyMember | null>(null);
  const [newMember, setNewMember] = useState({ name: '', avatar_emoji: '🦁' });
  const [showNewMember, setShowNewMember] = useState(false);

  const updateMemberMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; avatar_emoji: string } }) =>
      updateMember(id, data),
    onSuccess: () => {
      refreshFamily();
      queryClient.invalidateQueries({ queryKey: ['current-periods'] });
      setEditMember(null);
      flash('success', 'פרטי הילד עודכנו ✅');
    },
    onError: (e: Error) => flash('error', e.message),
  });
  const deleteMemberMutation = useMutation({
    mutationFn: deleteMember,
    onSuccess: () => { refreshFamily(); flash('success', 'הילד הוסר ✅'); },
    onError: (e: Error) => flash('error', e.message),
  });
  const createMemberMutation = useMutation({
    mutationFn: createMember,
    onSuccess: () => {
      refreshFamily();
      setNewMember({ name: '', avatar_emoji: '🦁' });
      setShowNewMember(false);
      flash('success', 'ילד נוסף ✅');
    },
    onError: (e: Error) => flash('error', e.message),
  });

  // ── PIN change ───────────────────────────────────────────────────────────
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const pinMutation = useMutation({
    mutationFn: () => changePin(oldPin, newPin),
    onSuccess: () => { setOldPin(''); setNewPin(''); flash('success', 'קוד PIN שונה ✅'); },
    onError: (e: Error) => flash('error', e.message),
  });

  // ── Reset mutations ──────────────────────────────────────────────────────
  const resetMutation = useMutation({
    mutationFn: ({ type, pk }: { type: string; pk: string }) => resetPeriod(type, pk),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-periods'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      flash('success', 'התקופה אופסה ✅');
    },
    onError: (e: Error) => flash('error', e.message),
  });

  // ── Flash helper ─────────────────────────────────────────────────────────
  const flash = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') { setGlobalSuccess(msg); setTimeout(() => setGlobalSuccess(null), 3000); }
    else { setGlobalError(msg); setTimeout(() => setGlobalError(null), 4000); }
  };

  // ── Guard: PIN ───────────────────────────────────────────────────────────
  if (!isAdminAuthenticated) {
    return <PinModal onVerify={authenticate} verifying={verifying} error={pinError} onClearError={() => setPinError(null)} />;
  }

  const TABS: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'goals',   label: 'מטרות',  icon: '🎯' },
    { id: 'chores',  label: 'מטלות',  icon: '📋' },
    { id: 'members', label: 'ילדים',  icon: '👨‍👩‍👧‍👦' },
    { id: 'security',label: 'אבטחה',  icon: '🔐' },
    { id: 'links',   label: 'קישורים',icon: '🔗' },
  ];

  const weeklyGoal          = goals?.find((g) => g.type === 'weekly');
  const monthlyGoal         = goals?.find((g) => g.type === 'monthly');
  const personalWeeklyGoal  = goals?.find((g) => g.type === 'personal_weekly');
  const personalMonthlyGoal = goals?.find((g) => g.type === 'personal_monthly');

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">⚙️ הגדרות</h1>
          <p className="page-sub">ניהול הורים</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout}>יציאה 🔒</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--card)', padding: 4, borderRadius: 12, border: '1px solid var(--border)' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '10px 4px', border: 'none', borderRadius: 10, cursor: 'pointer',
              background: tab === t.id ? 'var(--primary)' : 'transparent',
              color: tab === t.id ? '#fff' : 'var(--text-muted)',
              fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}
          >
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {globalError   && <div className="alert alert-error"   style={{ marginBottom: 12 }}>⚠️ {globalError}</div>}
      {globalSuccess && <div className="alert alert-success" style={{ marginBottom: 12 }}>✅ {globalSuccess}</div>}

      {/* ── GOALS TAB ─────────────────────────────────────────────── */}
      {tab === 'goals' && (
        <>
          {goalsLoading ? <LoadingSpinner /> : (
            <>
              <div className="settings-group">
                <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ marginBottom: 8, width: '100%' }}>
                    <div className="settings-row-label">⭐ יעד נקודות שבועי</div>
                    <div className="settings-row-sub">כיום: {weeklyGoal?.target_points ?? '—'} נקודות</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    <input
                      className="input"
                      type="number"
                      placeholder="יעד חדש..."
                      value={weeklyTarget}
                      onChange={(e) => setWeeklyTarget(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!weeklyTarget || goalMutation.isPending}
                      onClick={() => goalMutation.mutate({ type: 'weekly', val: parseInt(weeklyTarget) })}
                    >
                      שמור
                    </button>
                  </div>
                </div>
                <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ marginBottom: 8, width: '100%' }}>
                    <div className="settings-row-label">🏆 יעד נקודות חודשי</div>
                    <div className="settings-row-sub">כיום: {monthlyGoal?.target_points ?? '—'} נקודות</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    <input
                      className="input"
                      type="number"
                      placeholder="יעד חדש..."
                      value={monthlyTarget}
                      onChange={(e) => setMonthlyTarget(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!monthlyTarget || goalMutation.isPending}
                      onClick={() => goalMutation.mutate({ type: 'monthly', val: parseInt(monthlyTarget) })}
                    >
                      שמור
                    </button>
                  </div>
                </div>
              </div>

              {/* Personal goals */}
              <div className="settings-group">
                <div style={{ padding: '6px 0 10px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                  👤 יעדים אישיים — כל ילד חייב לעמוד ביעד האישי שלו ובנוסף ביעד האחים כדי לקבל הישג
                </div>
                <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ marginBottom: 8, width: '100%' }}>
                    <div className="settings-row-label">📅 יעד אישי שבועי</div>
                    <div className="settings-row-sub">כיום: {personalWeeklyGoal?.target_points ?? '—'} נקודות לילד</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    <input
                      className="input"
                      type="number"
                      placeholder="יעד חדש..."
                      value={personalWeeklyTarget}
                      onChange={(e) => setPersonalWeeklyTarget(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!personalWeeklyTarget || goalMutation.isPending}
                      onClick={() => goalMutation.mutate({ type: 'personal_weekly', val: parseInt(personalWeeklyTarget) })}
                    >
                      שמור
                    </button>
                  </div>
                </div>
                <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ marginBottom: 8, width: '100%' }}>
                    <div className="settings-row-label">🗓 יעד אישי חודשי</div>
                    <div className="settings-row-sub">כיום: {personalMonthlyGoal?.target_points ?? '—'} נקודות לילד</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    <input
                      className="input"
                      type="number"
                      placeholder="יעד חדש..."
                      value={personalMonthlyTarget}
                      onChange={(e) => setPersonalMonthlyTarget(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!personalMonthlyTarget || goalMutation.isPending}
                      onClick={() => goalMutation.mutate({ type: 'personal_monthly', val: parseInt(personalMonthlyTarget) })}
                    >
                      שמור
                    </button>
                  </div>
                </div>
              </div>

              {/* Reset periods */}
              {periods && (
                <div className="settings-group">
                  <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div className="settings-row-label">🔄 איפוס תקופה</div>
                      <div className="settings-row-sub">מחיקת כל הנקודות לתקופה הנוכחית</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={resetMutation.isPending}
                        onClick={() => {
                          if (confirm('האם לאפס את השבוע הנוכחי? פעולה זו בלתי הפיכה!')) {
                            resetMutation.mutate({ type: 'weekly', pk: periods.weekly.period_key });
                          }
                        }}
                      >
                        אפס שבוע נוכחי
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={resetMutation.isPending}
                        onClick={() => {
                          if (confirm('האם לאפס את החודש הנוכחי? פעולה זו בלתי הפיכה!')) {
                            resetMutation.mutate({ type: 'monthly', pk: periods.monthly.period_key });
                          }
                        }}
                      >
                        אפס חודש נוכחי
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── CHORES TAB ────────────────────────────────────────────── */}
      {tab === 'chores' && (
        <>
          {/* Add new chore */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">➕ הוסף מטלה חדשה</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                className="input"
                placeholder="שם המטלה..."
                value={newChore.name}
                onChange={(e) => setNewChore((c) => ({ ...c, name: e.target.value }))}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  className="input"
                  value={newChore.difficulty}
                  onChange={(e) => {
                    const d = e.target.value as 'easy' | 'medium' | 'hard';
                    const pts = d === 'easy' ? 5 : d === 'medium' ? 15 : 30;
                    setNewChore((c) => ({ ...c, difficulty: d, points: pts }));
                  }}
                  style={{ flex: 1 }}
                >
                  <option value="easy">קל</option>
                  <option value="medium">בינוני</option>
                  <option value="hard">קשה</option>
                </select>
                <input
                  className="input"
                  type="number"
                  value={newChore.points}
                  onChange={(e) => setNewChore((c) => ({ ...c, points: parseInt(e.target.value) || 0 }))}
                  style={{ width: 80 }}
                  placeholder="נק׳"
                />
              </div>
              <button
                className="btn btn-primary"
                disabled={!newChore.name.trim() || createChoreMutation.isPending}
                onClick={() => createChoreMutation.mutate(newChore)}
              >
                {createChoreMutation.isPending ? 'מוסיף...' : '➕ הוסף מטלה'}
              </button>
            </div>
          </div>

          {choresLoading ? <LoadingSpinner /> : (
            <>
              {(['easy', 'medium', 'hard'] as const).map((diff) => {
                const group = chores?.filter((c) => c.difficulty === diff) ?? [];
                if (group.length === 0) return null;
                const meta = DIFFICULTY_META[diff];
                return (
                  <div key={diff} style={{ marginBottom: 16 }}>
                    <div className="section-title">
                      <span className="chip" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                    </div>
                    {group.map((chore) => (
                      <div key={chore.id}>
                        {editChore?.id === chore.id ? (
                          <div className="card" style={{ marginBottom: 8, padding: 14 }}>
                            <input
                              className="input"
                              value={editChore.name}
                              onChange={(e) => setEditChore((c) => c ? { ...c, name: e.target.value } : c)}
                              style={{ marginBottom: 8 }}
                            />
                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                              <select
                                className="input"
                                value={editChore.difficulty}
                                onChange={(e) => setEditChore((c) => c ? { ...c, difficulty: e.target.value as Chore['difficulty'] } : c)}
                                style={{ flex: 1 }}
                              >
                                <option value="easy">קל</option>
                                <option value="medium">בינוני</option>
                                <option value="hard">קשה</option>
                              </select>
                              <input
                                className="input"
                                type="number"
                                value={editChore.points}
                                onChange={(e) => setEditChore((c) => c ? { ...c, points: parseInt(e.target.value) || 0 } : c)}
                                style={{ width: 80 }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => updateChoreMutation.mutate({ id: editChore.id, data: editChore })}
                                disabled={updateChoreMutation.isPending}
                                style={{ flex: 1 }}
                              >
                                שמור
                              </button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditChore(null)} style={{ flex: 1 }}>ביטול</button>
                            </div>
                          </div>
                        ) : (
                          <div className="chore-item" style={{ cursor: 'default' }}>
                            <span className="chore-item-name" style={{ opacity: chore.active ? 1 : 0.45 }}>
                              {chore.name}
                              {!chore.active && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 6 }}>(מוסתר)</span>}
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <span className="chore-pts">{chore.points}</span>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => setEditChore(chore)}
                                style={{ padding: '4px 10px', minHeight: 'auto' }}
                              >✏️</button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => {
                                  if (confirm('להסיר מטלה זו?')) deleteChoreMutation.mutate(chore.id);
                                }}
                                style={{ padding: '4px 10px', minHeight: 'auto' }}
                              >🗑</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {/* ── MEMBERS TAB ───────────────────────────────────────────── */}
      {tab === 'members' && (
        <>
          {family.map((m) => (
            <div key={m.id}>
              {editMember?.id === m.id ? (
                <div className="card" style={{ marginBottom: 12, padding: 20 }}>
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 52 }}>{editMember.avatar_emoji}</div>
                  </div>
                  <label className="label">שם</label>
                  <input
                    className="input"
                    value={editMember.name}
                    onChange={(e) => setEditMember((mm) => mm ? { ...mm, name: e.target.value } : mm)}
                    style={{ marginBottom: 12 }}
                  />
                  <label className="label">אמוג׳י</label>
                  <div className="emoji-grid" style={{ marginBottom: 16 }}>
                    {AVATAR_OPTIONS.map((em) => (
                      <button
                        key={em}
                        className={`emoji-btn${editMember.avatar_emoji === em ? ' selected' : ''}`}
                        onClick={() => setEditMember((mm) => mm ? { ...mm, avatar_emoji: em } : mm)}
                        type="button"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      disabled={updateMemberMutation.isPending}
                      onClick={() => updateMemberMutation.mutate({ id: editMember.id, data: { name: editMember.name, avatar_emoji: editMember.avatar_emoji } })}
                    >שמור</button>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditMember(null)}>ביטול</button>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 44 }}>{m.avatar_emoji}</span>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 18 }}>{m.name}</span>
                  <button className="btn btn-sm btn-secondary" onClick={() => setEditMember(m)}>✏️ ערוך</button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      if (confirm(`למחוק את ${m.name}? הנתונים שלהם יימחקו!`)) {
                        deleteMemberMutation.mutate(m.id);
                      }
                    }}
                  >🗑</button>
                </div>
              )}
            </div>
          ))}

          {!showNewMember ? (
            <button className="btn btn-secondary btn-full" onClick={() => setShowNewMember(true)}>
              ➕ הוסף ילד
            </button>
          ) : (
            <div className="card" style={{ padding: 20 }}>
              <div className="section-title">➕ ילד חדש</div>
              <label className="label">שם</label>
              <input
                className="input"
                value={newMember.name}
                onChange={(e) => setNewMember((m) => ({ ...m, name: e.target.value }))}
                style={{ marginBottom: 12 }}
                placeholder="הכנס שם..."
              />
              <label className="label">אמוג׳י</label>
              <div className="emoji-grid" style={{ marginBottom: 16 }}>
                {AVATAR_OPTIONS.map((em) => (
                  <button
                    key={em}
                    className={`emoji-btn${newMember.avatar_emoji === em ? ' selected' : ''}`}
                    onClick={() => setNewMember((m) => ({ ...m, avatar_emoji: em }))}
                    type="button"
                  >
                    {em}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={!newMember.name.trim() || createMemberMutation.isPending}
                  onClick={() => createMemberMutation.mutate(newMember)}
                >הוסף</button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowNewMember(false)}>ביטול</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── SECURITY TAB ──────────────────────────────────────────── */}
      {tab === 'security' && (
        <div className="settings-group">
          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <div className="settings-row-label">🔐 שינוי קוד PIN</div>
              <div className="settings-row-sub">קוד ברירת מחדל: 1234</div>
            </div>
            <input
              className="input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="קוד נוכחי"
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value)}
            />
            <input
              className="input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="קוד חדש (4 ספרות)"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
            />
            <button
              className="btn btn-primary btn-full"
              disabled={oldPin.length < 4 || newPin.length < 4 || pinMutation.isPending}
              onClick={() => pinMutation.mutate()}
            >
              {pinMutation.isPending ? 'משנה...' : 'שנה קוד PIN'}
            </button>
          </div>
        </div>
      )}

      {/* ── LINKS TAB ─────────────────────────────────────────────── */}
      {tab === 'links' && (
        <LinksTab family={family} />
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}

// ── Links tab component ──────────────────────────────────────────────────────
function LinksTab({ family }: { family: import('../../types').FamilyMember[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const base = window.location.origin;

  const copy = (url: string, key: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const LinkCard = ({
    emoji, label, sub, url, linkKey,
  }: {
    emoji: string; label: string; sub: string; url: string; linkKey: string;
  }) => (
    <div className="card" style={{ marginBottom: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 36 }}>{emoji}</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{label}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sub}</div>
        </div>
      </div>
      <div style={{
        background: 'var(--bg)', borderRadius: 8, padding: '8px 12px',
        fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all',
        marginBottom: 10, fontFamily: 'monospace', direction: 'ltr', textAlign: 'left',
      }}>
        {url}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary btn-sm"
          style={{ flex: 1 }}
          onClick={() => copy(url, linkKey)}
        >
          {copied === linkKey ? '✅ הועתק!' : '📋 העתק קישור'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary btn-sm"
          style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
        >
          🔗 פתח
        </a>
      </div>
    </div>
  );

  return (
    <div>
      <div className="section-title" style={{ marginBottom: 12 }}>👧👦 קישורים לילדים</div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        שלח לכל ילד את הקישור שלו — יציג את היעדים האישיים שלו ויאפשר תיעוד מטלה
      </p>
      {family.map((m) => (
        <LinkCard
          key={m.id}
          emoji={m.avatar_emoji}
          label={m.name}
          sub={`דף הבית האישי עם היעדים של ${m.name}`}
          url={`${base}/?member=${m.id}`}
          linkKey={`member-${m.id}`}
        />
      ))}

      <div className="section-title" style={{ marginBottom: 12, marginTop: 8 }}>👨‍👩‍👧 קישור להורים</div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        כניסה לפאנל הניהול — ידרוש קוד PIN
      </p>
      <LinkCard
        emoji="⚙️"
        label="פאנל הורים"
        sub="ניהול מטלות, יעדים, ילדים ואבטחה"
        url={`${base}/admin`}
        linkKey="admin"
      />

      <div className="card" style={{ background: 'var(--warning-bg, #fff8e1)', border: '1px solid var(--warning, #ffd54f)', marginTop: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
          <strong>💡 טיפ:</strong> שמור את קישורי הילדים כסימניות בדפדפן שלהם, או הוסף לדף הבית של הטלפון שלהם (Add to Home Screen) לגישה מהירה כמו אפליקציה.
        </div>
      </div>
    </div>
  );
}
