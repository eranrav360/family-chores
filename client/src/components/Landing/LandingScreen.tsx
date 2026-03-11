import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkFamilyCode } from '../../api';

export default function LandingScreen() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnter = async () => {
    const normalized = code.trim().toLowerCase();
    if (!normalized) { setError('יש להזין קוד משפחה'); return; }
    setLoading(true);
    setError(null);
    try {
      await checkFamilyCode(normalized);
      navigate(`/${normalized}`);
    } catch {
      setError('משפחה לא נמצאה — בדוק את הקוד ונסה שוב');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>🏠</div>
          <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 900, marginBottom: 8 }}>
            מטלות הבית
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16 }}>
            הזינו את קוד המשפחה שלכם כדי להיכנס
          </p>
        </div>

        {/* Login card */}
        <div className="card" style={{ padding: 28, marginBottom: 16 }}>
          <label className="label" style={{ marginBottom: 8, display: 'block', fontSize: 15 }}>
            קוד המשפחה
          </label>
          <input
            className="input"
            type="text"
            placeholder="לדוגמה: cohen"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && handleEnter()}
            autoFocus
            dir="ltr"
            style={{ marginBottom: 16, textAlign: 'left' }}
          />
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              ⚠️ {error}
            </div>
          )}
          <button
            className="btn btn-primary btn-full"
            onClick={handleEnter}
            disabled={loading}
            style={{ fontSize: 17 }}
          >
            {loading ? '⏳ מחפש...' : '🚪 כניסה'}
          </button>
        </div>

        {/* Create new family */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginBottom: 12 }}>
            אין לכם עדיין חשבון?
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/create')}
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}
          >
            🏠 יצירת משפחה חדשה
          </button>
        </div>
      </div>
    </div>
  );
}
