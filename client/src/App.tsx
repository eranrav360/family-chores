import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function AppRoutes() {
  const { family, loading, error, refreshFamily } = useApp();

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner text="טוען מטלות הבית..." />
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
