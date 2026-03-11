import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import BottomNav from './components/common/BottomNav';
import LoadingSpinner from './components/common/LoadingSpinner';
import ErrorMessage from './components/common/ErrorMessage';
import LandingScreen from './components/Landing/LandingScreen';
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

// Resolves /:familyCode from the URL, syncs to context, and renders the family app
function FamilyLoader() {
  const { familyCode: urlFamilyCode } = useParams<{ familyCode: string }>();
  const { familyCode: contextFamilyCode, setFamilyCode, loading, error, refreshFamily } = useApp();
  const [elapsed, setElapsed] = useState(0);

  // Sync URL familyCode → context (triggers refreshFamily via useEffect in context)
  useEffect(() => {
    if (urlFamilyCode && urlFamilyCode !== contextFamilyCode) {
      setFamilyCode(urlFamilyCode);
    }
  }, [urlFamilyCode, contextFamilyCode, setFamilyCode]);

  // Loading timer for progressive messages
  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  if (loading) {
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
          <ErrorMessage message={error} onRetry={refreshFamily} />
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', marginTop: 12 }}>
            ודא שהשרת רץ ושכתובת ה-API נכונה
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Routes>
        <Route index element={<DashboardScreen />} />
        <Route path="log"          element={<LogChoreScreen />} />
        <Route path="history"      element={<HistoryScreen />} />
        <Route path="achievements" element={<AchievementsScreen />} />
        <Route path="admin"        element={<AdminScreen />} />
        <Route path="*"            element={<Navigate to="" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"              element={<LandingScreen />} />
      <Route path="/create"        element={<SetupScreen />} />
      <Route path="/:familyCode/*" element={<FamilyLoader />} />
    </Routes>
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
