import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import BottomNav from './components/common/BottomNav';
import LoadingSpinner from './components/common/LoadingSpinner';
import ErrorMessage from './components/common/ErrorMessage';
import SetupScreen from './components/Setup/SetupScreen';
import DashboardScreen from './components/Dashboard/DashboardScreen';
import LogChoreScreen from './components/LogChore/LogChoreScreen';
import HistoryScreen from './components/History/HistoryScreen';
import AchievementsScreen from './components/Achievements/AchievementsScreen';
import AdminScreen from './components/Admin/AdminScreen';

const WAKE_MESSAGES = [
  { after: 0,  text: 'טוען מטלות הבית...' },
  { after: 5,  text: 'מתחבר לשרת...' },
  { after: 12, text: 'השרת מתעורר משינה 🥱' },
  { after: 20, text: 'זה לוקח קצת יותר מהרגיל...' },
  { after: 35, text: 'כמעט שם! Render מתעורר לאט 🐢' },
];

function AppRoutes() {
  const { family, loading, error, refreshFamily } = useApp();
  const [elapsed, setElapsed] = useState(0);

  // Tick every second while loading
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  if (loading) {
    // Pick the most recent message whose threshold has been passed
    const msg = [...WAKE_MESSAGES]
      .reverse()
      .find((m) => elapsed >= m.after)?.text ?? WAKE_MESSAGES[0].text;

    const isSlow = elapsed >= 12;

    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
        }}
      >
        <LoadingSpinner text={msg} />

        {isSlow && (
          <div
            style={{
              maxWidth: 300,
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--text-muted)',
              lineHeight: 1.6,
              background: 'var(--card-bg)',
              borderRadius: 12,
              padding: '12px 16px',
              border: '1px solid var(--border)',
            }}
          >
            השרת על Render ישן כשאין שימוש.<br />
            ההתעוררות לוקחת עד <strong>60 שניות</strong> — זה נורמלי 😴
          </div>
        )}

        {/* Progress bar that fills over 60 seconds */}
        {isSlow && (
          <div
            style={{
              width: '100%',
              maxWidth: 280,
              height: 4,
              background: 'var(--border)',
              borderRadius: 99,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min((elapsed / 65) * 100, 98)}%`,
                background: 'var(--primary)',
                borderRadius: 99,
                transition: 'width 1s linear',
              }}
            />
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ textAlign: 'center', fontSize: 48, marginBottom: 16 }}>😕</div>
          <ErrorMessage
            message={error}
            onRetry={refreshFamily}
          />
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', marginTop: 12 }}>
            ודא שהשרת רץ ושכתובת ה-API נכונה
          </p>
        </div>
      </div>
    );
  }

  // First-launch: no family members yet
  if (family.length === 0) {
    return (
      <Routes>
        <Route path="/setup" element={<SetupScreen />} />
        <Route path="*"      element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app">
      <Routes>
        <Route path="/"             element={<DashboardScreen />} />
        <Route path="/log"          element={<LogChoreScreen />} />
        <Route path="/history"      element={<HistoryScreen />} />
        <Route path="/achievements" element={<AchievementsScreen />} />
        <Route path="/admin"        element={<AdminScreen />} />
        <Route path="*"             element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
