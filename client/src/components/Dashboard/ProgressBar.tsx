interface Props {
  current: number;
  target: number;
  label: string;
  achieved?: boolean;
}

export default function ProgressBar({ current, target, label, achieved }: Props) {
  const pct = Math.min((current / target) * 100, 100);

  return (
    <div className="progress-wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
        {achieved && (
          <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 700 }}>✅ הושג!</span>
        )}
      </div>
      <div className="progress-track">
        <div
          className={`progress-fill${achieved ? ' achieved' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="progress-labels">
        <span style={{ color: achieved ? 'var(--success)' : 'var(--text-muted)' }}>
          {current} נקודות
        </span>
        <span>יעד: {target}</span>
      </div>
    </div>
  );
}
