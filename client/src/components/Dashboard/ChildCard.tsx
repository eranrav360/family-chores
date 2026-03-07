interface Props {
  name: string;
  emoji: string;
  weeklyPoints: number;
  monthlyPoints: number;
  isLeading?: boolean;
}

export default function ChildCard({ name, emoji, weeklyPoints, monthlyPoints, isLeading }: Props) {
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
    </div>
  );
}
