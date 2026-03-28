import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useParams } from 'react-router-dom';
import { getMemberStats } from '../../api';
import { useApp } from '../../context/AppContext';
import { DIFFICULTY_META } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const HEBREW_MONTHS = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
];

function StatCard({ emoji, label, value, sub }: { emoji: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
      <span style={{ fontSize: 32, lineHeight: 1 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function DifficultyBar({ easy, medium, hard }: { easy: number; medium: number; hard: number }) {
  const total = easy + medium + hard;
  if (total === 0) return null;

  const segments = [
    { key: 'easy',   count: easy,   ...DIFFICULTY_META.easy   },
    { key: 'medium', count: medium, ...DIFFICULTY_META.medium },
    { key: 'hard',   count: hard,   ...DIFFICULTY_META.hard   },
  ].filter((s) => s.count > 0);

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>פילוח לפי רמת קושי</div>
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 14, marginBottom: 10 }}>
        {segments.map((s) => (
          <div
            key={s.key}
            style={{ flex: s.count, background: s.color, transition: 'flex 0.3s' }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {segments.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: 3,
              background: s.color, flexShrink: 0,
            }} />
            <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
            <span style={{ fontWeight: 600 }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsScreen() {
  const { family, setActiveMemberId, familyCode } = useApp();
  const { familyCode: urlCode } = useParams<{ familyCode: string }>();
  const fc = familyCode || urlCode || '';
  const [searchParams] = useSearchParams();

  const memberParam = searchParams.get('member');
  const lockedMemberId = memberParam ? parseInt(memberParam, 10) : null;

  useEffect(() => {
    setActiveMemberId(lockedMemberId);
  }, [lockedMemberId, setActiveMemberId]);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [selectedMember, setSelectedMember] = useState<number | null>(lockedMemberId ?? (family[0]?.id ?? null));

  // If family loads after mount, default to first member
  useEffect(() => {
    if (!selectedMember && family.length > 0) {
      setSelectedMember(lockedMemberId ?? family[0].id);
    }
  }, [family, lockedMemberId, selectedMember]);

  const activeMember = family.find((m) => m.id === (lockedMemberId ?? selectedMember));

  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ['stats', fc, lockedMemberId ?? selectedMember, month, year],
    queryFn: () => getMemberStats(fc, (lockedMemberId ?? selectedMember)!, month, year),
    enabled: !!fc && !!(lockedMemberId ?? selectedMember),
  });

  function changeMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    // Don't go into the future
    const now = new Date();
    if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1)) return;
    setMonth(m);
    setYear(y);
  }

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  return (
    <div className="screen">
      <div className="sticky-header">
        <div style={{ marginBottom: 12 }}>
          <h1 className="page-title">📊 סטטיסטיקות</h1>
          {activeMember && (
            <p className="page-sub">{activeMember.avatar_emoji} {activeMember.name}</p>
          )}
        </div>

        {/* Member selector (unlocked only) */}
        {!lockedMemberId && family.length > 1 && (
          <div className="filter-row" style={{ marginBottom: 8 }}>
            {family.map((m) => (
              <button
                key={m.id}
                className={`filter-chip${selectedMember === m.id ? ' active' : ''}`}
                onClick={() => setSelectedMember(m.id)}
              >
                {m.avatar_emoji} {m.name}
              </button>
            ))}
          </div>
        )}

        {/* Month picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={() => changeMonth(-1)}
            style={{
              background: 'var(--primary-light)', border: 'none', borderRadius: 8,
              width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: 'var(--primary)',
            }}
          >
            ›
          </button>
          <span style={{ fontWeight: 600, fontSize: 15, minWidth: 110, textAlign: 'center' }}>
            {HEBREW_MONTHS[month - 1]} {year}
          </span>
          <button
            onClick={() => changeMonth(1)}
            disabled={isCurrentMonth}
            style={{
              background: isCurrentMonth ? 'var(--border)' : 'var(--primary-light)',
              border: 'none', borderRadius: 8, width: 32, height: 32,
              cursor: isCurrentMonth ? 'default' : 'pointer',
              fontSize: 16, color: isCurrentMonth ? 'var(--text-light)' : 'var(--primary)',
            }}
          >
            ‹
          </button>
        </div>
      </div>

      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message={error instanceof Error ? error.message : 'שגיאה'} onRetry={refetch} />}

      {stats && stats.totalChores === 0 && !isLoading && (
        <div className="empty-state">
          <div className="empty-state-emoji">📭</div>
          <div className="empty-state-text">אין נתונים לחודש זה</div>
          <div className="empty-state-sub">תיעוד מטלות יופיע כאן</div>
        </div>
      )}

      {stats && stats.totalChores > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatCard emoji="✅" label="מטלות שבוצעו" value={stats.totalChores} />
            <StatCard emoji="⭐" label="נקודות שנצברו" value={stats.totalPoints} />
          </div>

          {stats.mostCommonChore && (
            <StatCard
              emoji="🔁"
              label="המטלה הכי נפוצה"
              value={stats.mostCommonChore.name}
              sub={`בוצעה ${stats.mostCommonChore.count} פעמים`}
            />
          )}

          {stats.busiestDay && (
            <StatCard
              emoji="📅"
              label="היום הכי עמוס"
              value={`יום ${stats.busiestDay.day}`}
              sub={`${stats.busiestDay.count} מטלות ביום זה`}
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatCard emoji="🎯" label="מגוון מטלות" value={`${stats.uniqueChores} סוגים`} />
            {stats.bestWeek && (
              <StatCard
                emoji="🏅"
                label="השבוע הטוב ביותר"
                value={`${stats.bestWeek.points} נק׳`}
              />
            )}
          </div>

          <DifficultyBar
            easy={stats.byDifficulty.easy}
            medium={stats.byDifficulty.medium}
            hard={stats.byDifficulty.hard}
          />
        </div>
      )}
    </div>
  );
}
