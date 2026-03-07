import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const { family } = useApp();
  const [memberFilter, setMemberFilter] = useState<number | 'all'>('all');

  const { data: achievements, isLoading, error, refetch } = useQuery({
    queryKey: ['achievements', memberFilter],
    queryFn: () => getAchievements(memberFilter !== 'all' ? memberFilter : undefined),
  });

  return (
    <div className="screen">
      <div className="sticky-header">
        <div style={{ marginBottom: 12 }}>
          <h1 className="page-title">🏆 הישגים</h1>
          <p className="page-sub">{achievements?.length ?? 0} הישגים נצברו</p>
        </div>

        {/* Member filter */}
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
