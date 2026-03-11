import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useParams } from 'react-router-dom';
import { getLogs } from '../../api';
import { useApp } from '../../context/AppContext';
import { DIFFICULTY_META } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

type PeriodFilter = 'week' | 'month' | 'all';

function getISOWeek(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function HistoryScreen() {
  const { family, setActiveMemberId, familyCode } = useApp();
  const { familyCode: urlCode } = useParams<{ familyCode: string }>();
  const fc = familyCode || urlCode || '';
  const [searchParams] = useSearchParams();

  // Read the locked member directly from the URL — this is the primary source of truth.
  const memberParam = searchParams.get('member');
  const lockedMemberId = memberParam ? parseInt(memberParam, 10) : null;

  // Keep context in sync so BottomNav stays correct while on this tab
  useEffect(() => {
    setActiveMemberId(lockedMemberId);
  }, [lockedMemberId, setActiveMemberId]);

  const [memberFilter, setMemberFilter] = useState<number | 'all'>(lockedMemberId ?? 'all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('week');

  // If the URL param changes, update filter
  useEffect(() => {
    setMemberFilter(lockedMemberId ?? 'all');
  }, [lockedMemberId]);

  const now = new Date();
  const filters: Record<string, number> = {};
  if (memberFilter !== 'all') filters.member_id = memberFilter;
  if (periodFilter === 'week') {
    filters.week = getISOWeek(now);
    filters.year = now.getFullYear();
  } else if (periodFilter === 'month') {
    filters.month = now.getMonth() + 1;
    filters.year = now.getFullYear();
  }

  const { data: logs, isLoading, error, refetch } = useQuery({
    queryKey: ['logs', fc, memberFilter, periodFilter],
    queryFn: () => getLogs(fc, Object.keys(filters).length ? filters : undefined),
    enabled: !!fc,
  });

  const totalPoints = logs?.reduce((s, l) => s + l.points_earned, 0) ?? 0;

  const activeMember = lockedMemberId
    ? family.find((m) => m.id === lockedMemberId)
    : null;

  return (
    <div className="screen">
      <div className="sticky-header">
        <div style={{ marginBottom: 12 }}>
          <h1 className="page-title">📜 היסטוריה</h1>
          <p className="page-sub">
            {activeMember
              ? `${activeMember.avatar_emoji} ${activeMember.name}`
              : 'כל המשפחה'}
            {logs ? ` • ${logs.length} מטלות • ${totalPoints} נקודות` : ''}
          </p>
        </div>

        {/* Period filter — always visible */}
        <div className="filter-row">
          {(['week', 'month', 'all'] as PeriodFilter[]).map((p) => (
            <button
              key={p}
              className={`filter-chip${periodFilter === p ? ' active' : ''}`}
              onClick={() => setPeriodFilter(p)}
            >
              {p === 'week' ? 'השבוע' : p === 'month' ? 'החודש' : 'הכל'}
            </button>
          ))}
        </div>

        {/* Member filter — hidden when a child is identified via URL */}
        {!lockedMemberId && (
          <div className="filter-row">
            <button
              className={`filter-chip${memberFilter === 'all' ? ' active' : ''}`}
              onClick={() => setMemberFilter('all')}
            >
              כולם
            </button>
            {family.map((m) => (
              <button
                key={m.id}
                className={`filter-chip${memberFilter === m.id ? ' active' : ''}`}
                onClick={() => setMemberFilter(m.id)}
              >
                {m.avatar_emoji} {m.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message={error instanceof Error ? error.message : 'שגיאה'} onRetry={refetch} />}

      {logs && logs.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-emoji">🤷</div>
          <div className="empty-state-text">אין מטלות להצגה</div>
          <div className="empty-state-sub">עדיין לא תועדו מטלות בתקופה זו</div>
        </div>
      )}

      {logs?.map((log) => {
        const diff = log.difficulty as keyof typeof DIFFICULTY_META;
        const meta = DIFFICULTY_META[diff] ?? DIFFICULTY_META.easy;
        return (
          <div key={log.id} className="log-item">
            <span className="log-avatar">{log.avatar_emoji}</span>
            <div className="log-info">
              <div className="log-chore">{log.chore_name ?? '—'}</div>
              <div className="log-meta">
                <span
                  className="chip"
                  style={{ background: meta.bg, color: meta.color, marginLeft: 6 }}
                >
                  {meta.label}
                </span>
                {log.member_name} • {formatDate(log.logged_at)}
              </div>
            </div>
            <div className="log-pts">+{log.points_earned}</div>
          </div>
        );
      })}
    </div>
  );
}
