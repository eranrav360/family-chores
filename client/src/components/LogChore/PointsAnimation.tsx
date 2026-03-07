import { useEffect } from 'react';

interface Props {
  memberEmoji: string;
  memberName: string;
  choreName: string;
  points: number;
  newAchievements: string[];
  onDone: () => void;
}

const ACHIEVEMENT_LABELS: Record<string, string> = {
  weekly_goal: '🌟 שבוע מושלם! יעד שבועי הושג!',
  monthly_goal: '🏆 חודש מושלם! יעד חודשי הושג!',
  hard_worker: '💪 עמל רב! 5 מטלות השבוע!',
};

export default function PointsAnimation({ memberEmoji, memberName, choreName, points, newAchievements, onDone }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <>
      {/* Achievement toasts */}
      {newAchievements.map((a, i) => (
        <div
          key={a}
          className="achievement-toast"
          style={{ top: 20 + i * 72 }}
        >
          <div style={{ fontSize: 18, fontWeight: 800 }}>{ACHIEVEMENT_LABELS[a] ?? a}</div>
        </div>
      ))}

      {/* Main celebration overlay */}
      <div className="points-overlay" onClick={onDone}>
        <div className="points-overlay-emoji">{memberEmoji}</div>
        <div className="points-overlay-name">{memberName}</div>
        <div className="points-overlay-chore">{choreName}</div>
        <div className="points-overlay-pts">+{points}</div>
        <div className="points-overlay-label">נקודות! 🎊</div>
        <div style={{ marginTop: 28, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
          לחץ לסגירה
        </div>
      </div>
    </>
  );
}
