interface Props {
  name: string;
  emoji: string;
  weeklyPoints: number;
  monthlyPoints: number;
  isLeading?: boolean;
  personalWeeklyTarget: number;
  personalWeeklyAchieved: boolean;
}

export default function ChildCard({
  name, emoji, weeklyPoints, monthlyPoints, isLeading,
  personalWeeklyTarget, personalWeeklyAchieved,
}: Props) {
  const personalPct = Math.min((weeklyPoints / Math.max(personalWeeklyTarget, 1)) * 100, 100);

  return (
    <div
      className="card"
      style={{
        flex: 1,
        textAlign: 'center',
        position: 'relative',
        border: isLeading ? '2px solid var(--secondary)' : undefined,
      }}
    >
      {isLeading && (
        <div style={{
          position: 'absolute',
          top: -10,
          right: '50%',
          transform: 'translateX(50%)',
          background: 'var(--secondary)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 999,
        }}>
          👑 מוביל/ה
        </div>
      )}
      <div style={{ fontSize: 48, marginBottom: 6 }}>{emoji}</div>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>{name}</div>

      {/* Weekly + Monthly totals */}
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--primary)' }}>{weeklyPoints}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>שבוע</div>
        </div>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--primary-dark)' }}>{monthlyPoints}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>חודש</div>
        </div>
      </div>

      {/* Personal weekly goal mini-bar */}
      <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: 'var(--text-muted)', marginBottom: 4,
        }}>
          <span>יעד אישי</span>
          <span style={{ color: personalWeeklyAchieved ? 'var(--success)' : 'inherit', fontWeight: 700 }}>
            {weeklyPoints}/{personalWeeklyTarget}{personalWeeklyAchieved ? ' ✅' : ''}
          </span>
        </div>
        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${personalPct}%`,
            background: personalWeeklyAchieved ? 'var(--success)' : 'var(--primary)',
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
    </div>
  );
}
