import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentPeriods, setReward } from '../../api';
import { useApp } from '../../context/AppContext';
import ProgressBar from './ProgressBar';
import ChildCard from './ChildCard';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import { useState } from 'react';

const REWARD_OPTIONS = [
  { id: 'takeaway', icon: '🍕', title: 'בחירת אוכל לבית', desc: 'תבחרו מאיפה מזמינים ארוחה' },
  { id: 'boardgame', icon: '🎲', title: 'משחק קופסה משפחתי', desc: 'ערב משחקים לכל המשפחה' },
  { id: 'movie',    icon: '🎬', title: 'בחירת סרט', desc: 'תבחרו סרט לצפייה המשפחתית' },
];

export default function DashboardScreen() {
  const { family } = useApp();
  const queryClient = useQueryClient();
  const [rewardModal, setRewardModal] = useState<'weekly' | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['current-periods'],
    queryFn: getCurrentPeriods,
    refetchInterval: 30_000,
  });

  const rewardMutation = useMutation({
    mutationFn: ({ period_key, reward }: { period_key: string; reward: string }) =>
      setReward('weekly', period_key, reward),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-periods'] });
      setRewardModal(null);
    },
  });

  if (isLoading) return <div className="screen"><LoadingSpinner /></div>;
  if (error || !data) return (
    <div className="screen">
      <ErrorMessage message={error instanceof Error ? error.message : 'שגיאה בטעינת הנתונים'} onRetry={refetch} />
    </div>
  );

  const { weekly, monthly } = data;
  type MemberEntry = typeof weekly.members[0];

  // Find leading child (most weekly points)
  const leadingId = weekly.members.reduce((best: MemberEntry, m: MemberEntry) =>
    parseInt(m.weekly_points ?? '0') > parseInt(best.weekly_points ?? '0') ? m : best,
    weekly.members[0]
  )?.id;

  const now = new Date();
  const monthNames = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">🏠 מטלות הבית</h1>
        <p className="page-sub">שבוע {weekly.week_num} • {monthNames[monthly.month - 1]} {monthly.year}</p>
      </div>

      {/* Children cards */}
      {family.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {monthly.members.map((m: MemberEntry) => {
            const wPts = parseInt(weekly.members.find((x: MemberEntry) => x.id === m.id)?.weekly_points ?? '0');
            const mPts = parseInt(m.monthly_points ?? '0');
            return (
              <ChildCard
                key={m.id}
                name={m.name}
                emoji={m.avatar_emoji}
                weeklyPoints={wPts}
                monthlyPoints={mPts}
                isLeading={m.id === leadingId && wPts > 0 && family.length > 1}
              />
            );
          })}
        </div>
      )}

      {/* Weekly goal card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>⭐ יעד שבועי</h2>
          {weekly.achieved && !weekly.reward_chosen && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setRewardModal('weekly')}
            >
              🎁 בחרו פרס
            </button>
          )}
        </div>
        <ProgressBar
          current={weekly.current}
          target={weekly.target}
          label={`${weekly.current} / ${weekly.target} נקודות`}
          achieved={weekly.achieved}
        />
        {weekly.achieved && weekly.reward_chosen && (
          <div className="alert alert-success" style={{ marginTop: 12, fontSize: 14 }}>
            🎉 הפרס הנבחר: {weekly.reward_chosen}
          </div>
        )}
        {!weekly.achieved && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
            נותרו עוד {weekly.target - weekly.current} נקודות להשלמת היעד השבועי
          </div>
        )}
      </div>

      {/* Monthly goal card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="section-title">🏆 יעד חודשי</h2>
        <ProgressBar
          current={monthly.current}
          target={monthly.target}
          label={`${monthly.current} / ${monthly.target} נקודות`}
          achieved={monthly.achieved}
        />
        {monthly.achieved && (
          <div className="alert alert-success" style={{ marginTop: 12, fontSize: 14 }}>
            🎊 הגעתם ליעד החודשי! מגיע לכם פרס! 🎁
          </div>
        )}
      </div>

      {/* Quick tip */}
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 8, padding: '8px 0' }}>
        לחצו על ✅ תיעוד כדי לתעד מטלה חדשה
      </div>

      {/* Reward modal */}
      {rewardModal === 'weekly' && (
        <div className="modal-backdrop" onClick={() => setRewardModal(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <h2 className="modal-title">🎉 כל הכבוד! בחרו את הפרס</h2>
            <div className="reward-cards">
              {REWARD_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className="reward-card"
                  onClick={() => rewardMutation.mutate({ period_key: weekly.period_key, reward: opt.title })}
                  disabled={rewardMutation.isPending}
                >
                  <span className="reward-icon">{opt.icon}</span>
                  <div className="reward-text">
                    <div className="reward-title">{opt.title}</div>
                    <div className="reward-desc">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
