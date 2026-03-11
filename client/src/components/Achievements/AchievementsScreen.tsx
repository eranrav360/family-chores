import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useParams } from 'react-router-dom';
import { getAchievements } from '../../api';
import { useApp } from '../../context/AppContext';
import { ACHIEVEMENT_META } from '../../types';
import type { AchievementType } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

function formatPeriodKey(key: string) {
  if (!key) return '';
  if (key.includes('-W')) {
    const [year, week] = key.split('-W');
    return `שבוע ${parseInt(week)}, ${year}`;
  }
  const [year, month] = key.split('-');
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  return `${months[parseInt(month) - 1]} ${year}`;
}

export default function AchievementsScreen() {
  const { family, setActiveMemberId, familyCode } = useApp();
  const { familyCode: urlCode } = useParams<{ familyCode: string }>();
  const fc = familyCode || urlCode || '';
  const [searchParams] = useSearchParams();

  // Read the locked member directly from the URL — primary source of truth.
  const memberParam = searchParams.get('member');
  const lockedMemberId = memberParam ? parseInt(memberParam, 10) : null;

  // Keep context in sync so BottomNav stays correct while on this tab
  useEffect(() => {
    setActiveMemberId(lockedMemberId);
  }, [lockedMemberId, setActiveMemberId]);

  const [memberFilter, setMemberFilter] = useState<number | 'all'>(lockedMemberId ?? 'all');

  // If the URL param changes, update filter
  useEffect(() => {
    setMemberFilter(lockedMemberId ?? 'all');
  }, [lockedMemberId]);

  const { data: achievements, isLoading, error, refetch } = useQuery({
    queryKey: ['achievements', fc, memberFilter],
    queryFn: () => getAchievements(fc, memberFilter !== 'all' ? memberFilter : undefined),
    enabled: !!fc,
  });

  const activeMember = lockedMemberId
    ? family.find((m) => m.id === lockedMemberId)
    : null;

  return (
    <div className="screen">
      <div className="sticky-header">
        <div style={{ marginBottom: 12 }}>
          <h1 className="page-title">🏆 הישגים</h1>
          <p className="page-sub">
            {activeMember
              ? `${activeMember.avatar_emoji} ${activeMember.name} • `
              : ''}
            {achievements?.length ?? 0} הישגים נצברו
          </p>
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

      {/* Achievement type legend */}
      {!isLoading && !error && (
        <div style={{ marginBottom: 16 }}>
          <div className="section-title">🎖 סוגי הישגים</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {(Object.entries(ACHIEVEMENT_META) as [AchievementType, typeof ACHIEVEMENT_META[AchievementType]][]).map(([type, meta]) => (
              <div
                key={type}
                className="chip"
                style={{ background: 'var(--secondary-light)', color: '#92400E', padding: '6px 12px', borderRadius: 999 }}
              >
                {meta.emoji} {meta.label}
              </div>
            ))}
          </div>
          <div className="divider" />
        </div>
      )}

      {achievements && achievements.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-emoji">🌱</div>
          <div className="empty-state-text">עוד אין הישגים</div>
          <div className="empty-state-sub">התחילו לתעד מטלות כדי לצבור הישגים!</div>
        </div>
      )}

      {achievements?.map((achievement) => {
        const meta = ACHIEVEMENT_META[achievement.type as AchievementType];
        if (!meta) return null;
        return (
          <div key={achievement.id} className="badge-card">
            <span className="badge-emoji">{meta.emoji}</span>
            <div className="badge-info">
              <div className="badge-title">{meta.label}</div>
              <div className="badge-desc">{meta.desc}</div>
              <div className="badge-who">
                {achievement.avatar_emoji} {achievement.member_name}
                {achievement.period_key && (
                  <span style={{ marginRight: 8, opacity: 0.8 }}>
                    • {formatPeriodKey(achievement.period_key)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
